// Saluran antar-HP untuk mode bermain bareng. Tidak ada server milik kita:
// - "internet": pesan dititipkan lewat server penghubung (broker MQTT, lihat RELAY_URLS).
//   Tidak ada sambungan langsung antar-HP, jadi tetap jalan walau tiap HP di jaringan berbeda
//   (data seluler, Wi-Fi kantor, dan sebagainya). Isi pesan dienkripsi sebelum dikirim.
// - "lokal": WebRTC tanpa internet. HP saling kenal lewat kode QR (penawaran dan jawaban),
//   lalu tersambung langsung di Wi-Fi atau hotspot yang sama.
// - "uji": BroadcastChannel antar-tab di satu peramban, hanya untuk pengujian (?uji di URL).

import { deflateSync, inflateSync } from "fflate";
import { RELAY_URLS } from "./config.ts";
import { sambungMqtt, type KlienMqtt } from "./mqtt.ts";

/** Isi pesan: objek JSON biasa. */
export type Pesan = { t: string } & Record<string, unknown>;

export interface Saluran {
  /** Kirim ke satu rekan (`ke`), atau ke semua kalau `ke` kosong. */
  kirim(pesan: Pesan, ke?: string): void;
  onPesan(cb: (pesan: Pesan, dari: string) => void): void;
  onMasuk(cb: (rekan: string) => void): void;
  onKeluar(cb: (rekan: string) => void): void;
  tutup(): void;
  /** Hanya saluran internet: apakah sedang tersambung ke server penghubung. */
  terhubung?(): boolean;
  /** Hanya saluran internet: berapa server penghubung yang tersambung, dari berapa. */
  server?(): { hidup: number; total: number };
  /** Dipanggil tiap sambungan ke salah satu server penghubung berubah (tersambung atau putus). */
  onSambungan?(cb: () => void): void;
}

const APP_ID = "negeri-wkwk.chalidade.v1";

/** Pemancar kejadian kecil, dipakai semua jenis saluran. */
function pemancar() {
  const pesan = new Set<(p: Pesan, dari: string) => void>();
  const masuk = new Set<(r: string) => void>();
  const keluar = new Set<(r: string) => void>();
  return {
    pesan: (p: Pesan, dari: string) => pesan.forEach((cb) => cb(p, dari)),
    masuk: (r: string) => masuk.forEach((cb) => cb(r)),
    keluar: (r: string) => keluar.forEach((cb) => cb(r)),
    api: {
      onPesan: (cb: (p: Pesan, dari: string) => void) => void pesan.add(cb),
      onMasuk: (cb: (r: string) => void) => void masuk.add(cb),
      onKeluar: (cb: (r: string) => void) => void keluar.add(cb),
    },
  };
}

export const modeUji = (): boolean => new URLSearchParams(location.search).has("uji");

// ------------------------------------------------------------------ internet (lewat server penghubung)

const enk = new TextEncoder();
const dek = new TextDecoder();
const b64 = (b: Uint8Array): string => {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
};
const unb64 = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const sha = async (t: string): Promise<Uint8Array<ArrayBuffer>> => new Uint8Array(await crypto.subtle.digest("SHA-256", enk.encode(t)));

/** Amplop yang lewat di server penghubung. Hanya alamat yang terbaca; isinya (`c`) terenkripsi. */
interface Amplop {
  v: 1;
  /** pengirim */
  d: string;
  /** penerima; kosong berarti untuk semua */
  k?: string;
  /** nomor urut pengirim, untuk membuang kiriman ganda dari beberapa server */
  n: number;
  /** detak: tanda masih hidup, tanpa isi */
  q?: 1;
  /** kunci yang dipakai: "r" kunci ruang, "p" kunci pasangan (hanya pengirim dan penerima) */
  s?: "r" | "p";
  /** isi dipadatkan sebelum dienkripsi */
  z?: 1;
  c?: string;
}
/** Isi amplop setelah dibuka. */
interface Isi {
  /** salam perkenalan: membawa kunci publik pengirim */
  h?: 1;
  p?: string;
  /** pengirim baru saja tersambung (lagi): perkenalkan diri ulang ke dia */
  segar?: 1;
  /** minta dibalas dengan salam */
  m?: 1;
  /** pamit */
  b?: 1;
  /** pesan permainan */
  i?: Pesan;
}

async function segel(kunci: CryptoKey, a: Amplop, isi: Isi): Promise<Uint8Array> {
  let data = enk.encode(JSON.stringify(isi)) as Uint8Array<ArrayBuffer>;
  if (data.length > 256) {
    // dipadatkan seketika (fflate), bukan lewat CompressionStream: jalur aliran butuh banyak
    // giliran di utas utama, dan itu terasa lambat saat HP sibuk menggambar papan 3D
    data = deflateSync(data, { level: 6 }) as Uint8Array<ArrayBuffer>;
    a.z = 1;
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  // alamat ikut ditandatangani, supaya amplop tidak bisa dialihkan ke orang lain
  const additionalData = enk.encode(`${a.d}|${a.k ?? ""}|${a.n}`);
  const sandi = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData }, kunci, data));
  const gabung = new Uint8Array(iv.length + sandi.length);
  gabung.set(iv);
  gabung.set(sandi, iv.length);
  a.c = b64(gabung);
  return enk.encode(JSON.stringify(a));
}

async function bukaSegel(kunci: CryptoKey, a: Amplop): Promise<Isi> {
  const gabung = unb64(a.c ?? "");
  const additionalData = enk.encode(`${a.d}|${a.k ?? ""}|${a.n}`);
  let data = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: gabung.subarray(0, 12), additionalData }, kunci, gabung.subarray(12)));
  if (a.z) data = inflateSync(data) as Uint8Array<ArrayBuffer>;
  return JSON.parse(dek.decode(data)) as Isi;
}

/** Rekan dianggap pergi kalau tidak terdengar selama ini. Detak dikirim tiap DETAK_MS. */
const BATAS_SEPI_MS = 15_000;
const DETAK_MS = 4000;

/**
 * Bergabung ke "ruang" bernama `nama` lewat internet. Semua HP di ruang yang sama saling terhubung
 * lewat server penghubung, tanpa sambungan langsung.
 *
 * Keamanan: nama ruang (kode room) menjadi kunci ruang, jadi orang luar yang menyadap server
 * hanya melihat teks acak. Pesan untuk satu orang (misalnya state yang menyembunyikan peran)
 * dienkripsi dengan kunci pasangan hasil pertukaran ECDH, jadi anggota lain pun tidak bisa membacanya.
 */
export async function saluranInternet(nama: string, opsi: { siaran?: boolean } = {}): Promise<Saluran> {
  if (modeUji()) return saluranUji(nama);
  /** Mode siaran (dipakai daftar room publik): semua pesan untuk semua, tanpa perkenalan dan detak. */
  const siaran = !!opsi.siaran;
  if (!globalThis.crypto?.subtle) throw new Error("Peramban ini belum mendukung sambungan aman. Perbarui peramban atau aplikasinya.");
  const aku = Array.from(crypto.getRandomValues(new Uint8Array(9)), (x) => x.toString(36).padStart(2, "0")).join("").slice(0, 14);
  const kunciRuang = await crypto.subtle.importKey("raw", await sha(`kunci|${APP_ID}|${nama}`), "AES-GCM", false, ["encrypt", "decrypt"]);
  const topik = "nw1/" + Array.from((await sha(`topik|${APP_ID}|${nama}`)).subarray(0, 16), (x) => x.toString(16).padStart(2, "0")).join("");
  const pasangan = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveKey"]);
  const kunciPublik = b64(new Uint8Array(await crypto.subtle.exportKey("raw", pasangan.publicKey)));
  const kunciPasangan = async (publik: string): Promise<CryptoKey> =>
    crypto.subtle.deriveKey(
      { name: "ECDH", public: await crypto.subtle.importKey("raw", unb64(publik), { name: "ECDH", namedCurve: "P-256" }, false, []) },
      pasangan.privateKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );

  const e = pemancar();
  const sambungan = new Set<() => void>();
  const rekan = new Map<string, { kunci: CryptoKey; terakhir: number }>();
  /** kiriman yang sudah diproses ("pengirim:nomor"): tiap pesan datang sekali dari tiap server */
  const lihat = new Set<string>();
  /** pesan dari rekan yang salamnya belum tiba: ditahan sebentar */
  const tunda = new Map<string, { a: Amplop; kapan: number }[]>();
  let urut = 0;
  let hidup = 0;
  let mati = false;
  let kirimTerakhir = 0;
  let antreKirim: Promise<void> = Promise.resolve();
  let antreTerima: Promise<void> = Promise.resolve();

  const terbitkan = (bytes: Uint8Array) => {
    kirimTerakhir = Date.now();
    for (const k of klien) k.terbit(topik, bytes);
  };
  /** Enkripsi tidak seketika, jadi kiriman diantrekan supaya urutannya terjaga. */
  const antre = (kerja: () => Promise<void>): Promise<void> => (antreKirim = antreKirim.then(kerja).catch(() => undefined));
  const salam = (ke?: string, tambahan: Isi = {}) =>
    antre(async () => {
      const a: Amplop = { v: 1, d: aku, n: ++urut, s: "r" };
      if (ke) a.k = ke;
      terbitkan(await segel(kunciRuang, a, { h: 1, p: kunciPublik, ...tambahan }));
    });

  async function proses(a: Amplop): Promise<void> {
    const r = rekan.get(a.d);
    let isi: Isi;
    try {
      isi = await bukaSegel(a.s === "p" ? r!.kunci : kunciRuang, a);
    } catch {
      return; // bukan dari ruang ini, atau rusak di jalan
    }
    if (siaran) {
      if (isi.i) e.pesan(isi.i, a.d);
      return;
    }
    if (isi.h) {
      if (typeof isi.p !== "string") return;
      let kunci: CryptoKey;
      try {
        kunci = await kunciPasangan(isi.p);
      } catch {
        return;
      }
      rekan.set(a.d, { kunci, terakhir: Date.now() });
      lupa.delete(a.d);
      // salam terbuka (atau yang minta dibalas): balas, supaya dia juga mengenal kita
      if (!a.k || isi.m) void salam(a.d);
      if (!r || isi.segar) e.masuk(a.d);
      const tertahan = tunda.get(a.d);
      tunda.delete(a.d);
      for (const t of tertahan ?? []) if (Date.now() - t.kapan < 6000) await proses(t.a);
      return;
    }
    if (!r) {
      // pesan dari rekan yang belum kita kenal: tahan, dan minta dia memperkenalkan diri
      tahan(a);
      return;
    }
    if (isi.b) {
      rekan.delete(a.d);
      e.keluar(a.d);
    } else if (isi.i) e.pesan(isi.i, a.d);
  }

  /**
   * Ada kabar dari rekan yang tidak kita kenal: minta dia memperkenalkan diri.
   * Kalau dia rekan yang sudah kita anggap pergi karena lama diam (`lupa`), tanda `segar` membuat dia
   * juga memperlakukan kita sebagai rekan yang baru masuk, jadi kedua sisi mengulang perkenalan di
   * lapisan permainan. Tanpa ini, satu sisi bisa menganggap sisi lain pergi sementara sisi lain
   * merasa baik-baik saja, dan permainannya macet diam-diam.
   */
  const lupa = new Set<string>();
  const ditanya = new Map<string, number>();
  function kenalan(id: string): void {
    const kini = Date.now();
    if (kini - (ditanya.get(id) ?? 0) < 3000) return;
    ditanya.set(id, kini);
    if (ditanya.size > 200) for (const [k, t] of ditanya) if (kini - t > 60_000) ditanya.delete(k);
    void salam(id, lupa.has(id) ? { m: 1, segar: 1 } : { m: 1 });
  }

  function tahan(a: Amplop): void {
    const daftar = tunda.get(a.d) ?? [];
    kenalan(a.d);
    daftar.push({ a, kapan: Date.now() });
    if (daftar.length > 30) daftar.shift();
    tunda.set(a.d, daftar);
  }

  async function terima(bytes: Uint8Array): Promise<void> {
    let a: Amplop;
    try {
      a = JSON.parse(dek.decode(bytes)) as Amplop;
    } catch {
      return;
    }
    if (mati || !a || a.v !== 1 || typeof a.d !== "string" || typeof a.n !== "number" || a.d === aku) return;
    const r = rekan.get(a.d);
    if (r) r.terakhir = Date.now();
    if (a.q) {
      // detak dari rekan yang tidak kita kenal: dia masih hidup, ajak kenalan ulang
      if (!r && !siaran) kenalan(a.d);
      return;
    }
    if (a.k && a.k !== aku) return;
    const tanda = `${a.d}:${a.n}`;
    if (lihat.has(tanda)) return;
    lihat.add(tanda);
    if (lihat.size > 4000) for (const lama of [...lihat].slice(0, 2000)) lihat.delete(lama);
    if (a.s === "p" && (siaran || !r)) return siaran ? undefined : tahan(a);
    await proses(a);
  }

  const kabari = () => sambungan.forEach((cb) => cb());
  const klien: KlienMqtt[] = RELAY_URLS.map((url) =>
    sambungMqtt(url, {
      topik,
      onPesan: (bytes) => void (antreTerima = antreTerima.then(() => terima(bytes)).catch(() => undefined)),
      onBuka: () => {
        if (mati) return;
        hidup += 1;
        // server pertama yang tersambung (atau tersambung lagi setelah putus total): minta semua kenalan ulang
        if (!siaran) void salam(undefined, hidup === 1 ? { segar: 1 } : {});
        kabari();
      },
      onTutup: () => {
        if (mati) return;
        hidup = Math.max(0, hidup - 1);
        if (hidup > 0) return kabari();
        // putus dari semua server: semua rekan dianggap pergi sampai tersambung lagi
        for (const id of [...rekan.keys()]) {
          rekan.delete(id);
          e.keluar(id);
        }
        kabari();
      },
    }),
  );

  let jagaTerakhir = Date.now();
  const jaga = setInterval(() => {
    if (siaran) return;
    const kini = Date.now();
    // HP ini sendiri baru saja macet (layar mati, sibuk memuat papan): kabar dari rekan belum sempat
    // dibaca, jadi jangan menuduh mereka diam. Beri semua rekan waktu baru.
    const macet = kini - jagaTerakhir > 6000;
    jagaTerakhir = kini;
    if (macet) for (const r of rekan.values()) r.terakhir = kini;
    for (const [id, r] of rekan) {
      if (kini - r.terakhir <= BATAS_SEPI_MS) continue;
      rekan.delete(id);
      lupa.add(id);
      if (lupa.size > 200) lupa.delete(lupa.values().next().value!);
      e.keluar(id);
    }
    for (const [id, daftar] of tunda) if (daftar.every((t) => kini - t.kapan > 6000)) tunda.delete(id);
    if (hidup > 0 && kini - kirimTerakhir >= DETAK_MS) void antre(async () => terbitkan(enk.encode(JSON.stringify({ v: 1, d: aku, n: ++urut, q: 1 } satisfies Amplop))));
  }, 2000);

  return {
    kirim(isi, ke) {
      void antre(async () => {
        const a: Amplop = { v: 1, d: aku, n: ++urut, s: "r" };
        if (!ke || siaran) return terbitkan(await segel(kunciRuang, a, { i: isi }));
        const r = rekan.get(ke);
        if (!r) return; // rekannya sudah pergi
        a.k = ke;
        a.s = "p";
        terbitkan(await segel(r.kunci, a, { i: isi }));
      });
    },
    ...e.api,
    terhubung: () => hidup > 0,
    server: () => ({ hidup, total: klien.length }),
    onSambungan: (cb) => void sambungan.add(cb),
    tutup() {
      if (mati) return;
      mati = true;
      clearInterval(jaga);
      // pamit dulu, baru menutup sambungan
      void antre(async () => {
        if (!siaran) terbitkan(await segel(kunciRuang, { v: 1, d: aku, n: ++urut, s: "r" }, { b: 1 }));
      }).finally(() => klien.forEach((k) => k.tutup()));
    },
  };
}

// ------------------------------------------------------------------ uji (satu peramban)

function saluranUji(nama: string): Saluran {
  const aku = Math.random().toString(36).slice(2, 10);
  const bc = new BroadcastChannel(`wkwk-uji-${nama}`);
  const e = pemancar();
  const kenal = new Set<string>();
  const kenalan = (r: string) => {
    if (kenal.has(r)) return;
    kenal.add(r);
    e.masuk(r);
  };
  bc.onmessage = (ev) => {
    const m = ev.data as { dari: string; ke?: string; halo?: boolean; bye?: boolean; isi?: Pesan };
    if (m.dari === aku || (m.ke && m.ke !== aku)) return;
    if (m.bye) {
      kenal.delete(m.dari);
      return e.keluar(m.dari);
    }
    if (m.halo) {
      if (!kenal.has(m.dari)) bc.postMessage({ dari: aku, ke: m.dari, halo: true });
      return kenalan(m.dari);
    }
    kenalan(m.dari);
    if (m.isi) e.pesan(m.isi, m.dari);
  };
  setTimeout(() => bc.postMessage({ dari: aku, halo: true }), 50);
  return {
    kirim: (isi, ke) => bc.postMessage({ dari: aku, ke, isi }),
    ...e.api,
    tutup: () => {
      bc.postMessage({ dari: aku, bye: true });
      bc.close();
    },
  };
}

// ------------------------------------------------------------------ lokal (tanpa internet, lewat QR)

/** Tanpa server STUN: hanya alamat di jaringan lokal (Wi-Fi atau hotspot yang sama). */
const RTC_LOKAL: RTCConfiguration = { iceServers: [] };

async function tungguIce(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === "complete") return;
  await new Promise<void>((ok) => {
    const t = setTimeout(ok, 3000); // cukup untuk alamat lokal
    pc.addEventListener("icegatheringstatechange", () => {
      if (pc.iceGatheringState === "complete") {
        clearTimeout(t);
        ok();
      }
    });
  });
}

/** SDP dipadatkan (deflate + base64url) supaya muat di satu kode QR. */
async function bungkus(desc: RTCSessionDescriptionInit): Promise<string> {
  const teks = JSON.stringify({ t: desc.type === "offer" ? "o" : "a", s: desc.sdp });
  const aliran = new Blob([teks]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  const bytes = new Uint8Array(await new Response(aliran).arrayBuffer());
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return "WK1" + btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function buka(kode: string): Promise<RTCSessionDescriptionInit> {
  const k = kode.trim();
  if (!k.startsWith("WK1")) throw new Error("Kode tidak dikenali. Pastikan memindai kode dari Negeri Wkwk.");
  const b64 = k.slice(3).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const aliran = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const j = JSON.parse(await new Response(aliran).text()) as { t: string; s: string };
  return { type: j.t === "o" ? "offer" : "answer", sdp: j.s };
}

/**
 * Sisi tuan rumah tanpa internet: satu saluran yang menampung banyak tamu.
 * Tiap tamu diundang lewat `undang()`: tampilkan kodenya, lalu masukkan jawaban tamu.
 */
export interface TuanLokal extends Saluran {
  undang(): Promise<{ kode: string; terima(jawaban: string): Promise<void>; batal(): void }>;
}

function pasangKanal(dc: RTCDataChannel, id: string, e: ReturnType<typeof pemancar>, kanal: Map<string, RTCDataChannel>): void {
  dc.onopen = () => {
    kanal.set(id, dc);
    e.masuk(id);
  };
  dc.onclose = () => {
    if (kanal.get(id) !== dc) return;
    kanal.delete(id);
    e.keluar(id);
  };
  dc.onmessage = (ev) => {
    try {
      e.pesan(JSON.parse(String(ev.data)) as Pesan, id);
    } catch {
      /* bukan pesan kita */
    }
  };
}

export function tuanLokal(): TuanLokal {
  const e = pemancar();
  const kanal = new Map<string, RTCDataChannel>();
  const koneksi = new Set<RTCPeerConnection>();
  let urut = 0;
  return {
    kirim(p, ke) {
      const data = JSON.stringify(p);
      for (const [id, dc] of kanal) if (!ke || ke === id) dc.readyState === "open" && dc.send(data);
    },
    ...e.api,
    tutup() {
      koneksi.forEach((pc) => pc.close());
      kanal.clear();
    },
    async undang() {
      const pc = new RTCPeerConnection(RTC_LOKAL);
      koneksi.add(pc);
      const id = `lokal-${++urut}`;
      pasangKanal(pc.createDataChannel("g", { ordered: true }), id, e, kanal);
      await pc.setLocalDescription(await pc.createOffer());
      await tungguIce(pc);
      return {
        kode: await bungkus(pc.localDescription!),
        async terima(jawaban) {
          const desc = await buka(jawaban);
          if (desc.type !== "answer") throw new Error("Itu kode undangan, bukan kode jawaban dari tamu.");
          await pc.setRemoteDescription(desc);
        },
        batal() {
          pc.close();
          koneksi.delete(pc);
        },
      };
    },
  };
}

/** Sisi tamu tanpa internet: baca undangan tuan rumah, hasilkan kode jawaban, lalu tunggu tersambung. */
export async function tamuLokal(undangan: string): Promise<{ jawaban: string; saluran: Saluran }> {
  const desc = await buka(undangan);
  if (desc.type !== "offer") throw new Error("Itu kode jawaban. Pindai kode undangan di HP tuan rumah.");
  const pc = new RTCPeerConnection(RTC_LOKAL);
  const e = pemancar();
  const kanal = new Map<string, RTCDataChannel>();
  pc.ondatachannel = (ev) => pasangKanal(ev.channel, "tuan", e, kanal);
  await pc.setRemoteDescription(desc);
  await pc.setLocalDescription(await pc.createAnswer());
  await tungguIce(pc);
  return {
    jawaban: await bungkus(pc.localDescription!),
    saluran: {
      kirim: (p) => kanal.get("tuan")?.readyState === "open" && kanal.get("tuan")!.send(JSON.stringify(p)),
      ...e.api,
      tutup: () => pc.close(),
    },
  };
}
