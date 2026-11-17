// Saluran antar-HP untuk mode bermain bareng. Tidak ada server milik kita:
// - "internet": WebRTC, dipertemukan lewat relay publik Nostr (pustaka trystero). Relay hanya
//   dipakai untuk saling kenal; data permainan mengalir langsung antar-HP.
// - "lokal": WebRTC tanpa internet. HP saling kenal lewat kode QR (penawaran dan jawaban),
//   lalu tersambung langsung di Wi-Fi atau hotspot yang sama.
// - "uji": BroadcastChannel antar-tab di satu peramban, hanya untuk pengujian (?uji di URL).

/** Isi pesan: objek JSON biasa. */
export type Pesan = { t: string } & Record<string, unknown>;

export interface Saluran {
  /** Kirim ke satu rekan (`ke`), atau ke semua kalau `ke` kosong. */
  kirim(pesan: Pesan, ke?: string): void;
  onPesan(cb: (pesan: Pesan, dari: string) => void): void;
  onMasuk(cb: (rekan: string) => void): void;
  onKeluar(cb: (rekan: string) => void): void;
  tutup(): void;
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

// ------------------------------------------------------------------ internet

/** Bergabung ke "ruang" bernama `nama` lewat internet. Semua HP di ruang yang sama saling tersambung. */
export async function saluranInternet(nama: string): Promise<Saluran> {
  if (modeUji()) return saluranUji(nama);
  // dimuat hanya saat dibutuhkan, supaya beranda tetap ringan
  const { joinRoom } = await import("trystero");
  const room = joinRoom({ appId: APP_ID }, nama);
  // dikirim sebagai teks JSON: sederhana, dan sama persis dengan saluran lokal
  const aksi = room.makeAction<string>("g");
  const e = pemancar();
  aksi.onMessage((data, ctx) => {
    try {
      e.pesan(JSON.parse(data) as Pesan, ctx.peerId);
    } catch {
      /* bukan pesan kita */
    }
  });
  room.onPeerJoin((ctx) => e.masuk(ctx.peerId));
  room.onPeerLeave((ctx) => e.keluar(ctx.peerId));
  return {
    kirim: (p, ke) => void aksi.send(JSON.stringify(p), ke ? { target: ke } : undefined).catch(() => undefined),
    ...e.api,
    tutup: () => void room.leave().catch(() => undefined),
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
