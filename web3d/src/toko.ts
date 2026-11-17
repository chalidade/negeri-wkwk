// Emas Antum: toko kosmetik, misi harian, bansos harian, dan album stiker. Semuanya tersimpan di perangkat.
import { h, modal, nodes, toast } from "./dom.ts";
import { getStats, ubahEmas } from "./help.ts";
import { ava, ic, rezimAva } from "./icons.ts";
import { sfx } from "./sfx.ts";

// ------------------------------------------------------------------ toko

type Jenis = "kartu" | "dadu" | "bingkai";
interface Barang {
  id: string;
  jenis: Jenis;
  nama: string;
  harga: number;
  warna: string;
}

const JENIS: [Jenis, string][] = [
  ["kartu", "Warna kartu warga"],
  ["dadu", "Warna mata dadu"],
  ["bingkai", "Bingkai avatarmu"],
];
const BARANG: Barang[] = [
  { id: "kartu_biru", jenis: "kartu", nama: "Biru langit", harga: 0, warna: "#bee3f8" },
  { id: "kartu_hijau", jenis: "kartu", nama: "Hijau pupus", harga: 30, warna: "#c8eccf" },
  { id: "kartu_pink", jenis: "kartu", nama: "Merah jambu", harga: 30, warna: "#ffd3e0" },
  { id: "kartu_emas", jenis: "kartu", nama: "Emas sultan", harga: 120, warna: "#ffe08a" },
  { id: "dadu_merah", jenis: "dadu", nama: "Merah", harga: 0, warna: "#e5432f" },
  { id: "dadu_biru", jenis: "dadu", nama: "Biru", harga: 25, warna: "#2f6fe4" },
  { id: "dadu_hijau", jenis: "dadu", nama: "Hijau", harga: 25, warna: "#18a66a" },
  { id: "dadu_ungu", jenis: "dadu", nama: "Ungu", harga: 60, warna: "#7a4fd6" },
  { id: "bingkai_polos", jenis: "bingkai", nama: "Tinta", harga: 0, warna: "#1b2440" },
  { id: "bingkai_merah", jenis: "bingkai", nama: "Merah berani", harga: 50, warna: "#e5432f" },
  { id: "bingkai_emas", jenis: "bingkai", nama: "Emas", harga: 80, warna: "#e9a800" },
];

interface Toko {
  punya: string[];
  pakai: Record<Jenis, string>;
}
const TOKO_KEY = "wkwk.toko";
const AWAL: Toko = { punya: ["kartu_biru", "dadu_merah", "bingkai_polos"], pakai: { kartu: "kartu_biru", dadu: "dadu_merah", bingkai: "bingkai_polos" } };

function getToko(): Toko {
  try {
    const t = JSON.parse(localStorage.getItem(TOKO_KEY) ?? "null") as Toko | null;
    if (t) return { punya: [...new Set([...AWAL.punya, ...t.punya])], pakai: { ...AWAL.pakai, ...t.pakai } };
  } catch {
    // data rusak: mulai dari awal
  }
  return structuredClone(AWAL);
}
const simpanToko = (t: Toko) => localStorage.setItem(TOKO_KEY, JSON.stringify(t));

/** Pasang kosmetik yang sedang dipakai ke seluruh tampilan (lewat variabel CSS). */
export function terapkanKosmetik(): void {
  const t = getToko();
  const warna = (j: Jenis) => BARANG.find((b) => b.id === t.pakai[j])?.warna ?? "";
  const root = document.documentElement.style;
  root.setProperty("--ktp", warna("kartu"));
  root.setProperty("--pip", warna("dadu"));
  root.setProperty("--bingkai", warna("bingkai"));
}

export function showToko(onChange: () => void): void {
  const isi = h("div", { class: "col", style: "gap:10px" });
  const lukis = () => {
    const t = getToko();
    const emas = getStats().emas;
    isi.replaceChildren(
      h("div", { class: "sheet-title" }, ic("koin"), "Toko"),
      h("div", { class: "muted" }, `Emas Antum kamu: ${emas}. Semua barang cuma hiasan, tidak bikin menang lebih gampang.`),
      ...JENIS.flatMap(([jenis, label]) => [
        h("label", {}, label),
        h(
          "div",
          { class: "toko-grid" },
          ...BARANG.filter((b) => b.jenis === jenis).map((b) => {
            const punya = t.punya.includes(b.id);
            const dipakai = t.pakai[jenis] === b.id;
            return h(
              "button",
              {
                class: `barang${dipakai ? " on" : ""}`,
                onclick: () => {
                  if (!punya) {
                    if (emas < b.harga) return toast(`Emas Antum kurang ${b.harga - emas}. Kumpulkan lewat misi dan kemenangan.`);
                    ubahEmas(-b.harga);
                    t.punya.push(b.id);
                    sfx.coin();
                  } else sfx.click();
                  t.pakai[jenis] = b.id;
                  simpanToko(t);
                  terapkanKosmetik();
                  onChange();
                  lukis();
                },
              },
              h("i", { class: "swatch", style: `background:${b.warna}` }),
              h("b", {}, b.nama),
              h("small", {}, dipakai ? "dipakai" : punya ? "pakai" : null, !punya ? ic("koin") : null, !punya ? String(b.harga) : null),
            );
          }),
        ),
      ]),
      h("button", { class: "btn grey", onclick: () => close() }, "Tutup"),
    );
  };
  lukis();
  const close = modal(h("div", { class: "sheet" }, isi));
}

// ------------------------------------------------------------------ misi harian

interface Misi {
  id: string;
  teks: string;
  target: number;
  hadiah: number;
}
const MISI: Misi[] = [
  { id: "main", teks: "Tamatkan 1 permainan", target: 1, hadiah: 5 },
  { id: "menang", teks: "Tumbangkan Rezim", target: 1, hadiah: 12 },
  { id: "demo", teks: "Saksikan 2 Demo Akbar", target: 2, hadiah: 8 },
  { id: "upgrade", teks: "Upgrade usaha 3 kali", target: 3, hadiah: 8 },
  { id: "beli", teks: "Beli 4 usaha", target: 4, hadiah: 6 },
  { id: "jurus", teks: "Pakai jurus 2 kali", target: 2, hadiah: 6 },
  { id: "petisi", teks: "Bikin 2 petisi", target: 2, hadiah: 6 },
  { id: "mvp", teks: "Jadi MVP", target: 1, hadiah: 12 },
];
interface Harian {
  tgl: string;
  maju: Record<string, number>;
  klaim: string[];
}
const MISI_KEY = "wkwk.misi";
const hariIni = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

function getHarian(): Harian {
  try {
    const m = JSON.parse(localStorage.getItem(MISI_KEY) ?? "null") as Harian | null;
    if (m && m.tgl === hariIni()) return m;
  } catch {
    // data rusak: mulai hari baru
  }
  return { tgl: hariIni(), maju: {}, klaim: [] };
}

/** Tiga misi untuk hari ini: sama sepanjang hari, berganti besok. */
function misiHariIni(): Misi[] {
  let benih = [...hariIni()].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const sisa = [...MISI];
  const pilih: Misi[] = [MISI[0]]; // "tamatkan 1 permainan" selalu ada: gampang dan bikin mulai main
  sisa.shift();
  while (pilih.length < 3) {
    benih = (benih * 1103515245 + 12345) >>> 0;
    pilih.push(sisa.splice(benih % sisa.length, 1)[0]);
  }
  return pilih;
}

/** Catat kemajuan misi (dipanggil dari layar permainan). */
export function catatMisi(id: string, n = 1): void {
  if (!misiHariIni().some((m) => m.id === id)) return;
  const hr = getHarian();
  hr.maju[id] = (hr.maju[id] ?? 0) + n;
  localStorage.setItem(MISI_KEY, JSON.stringify(hr));
}

/** Ringkasan untuk tombol di beranda: berapa yang selesai dan apakah ada hadiah belum diambil. */
export function ringkasMisi(): { selesai: number; total: number; adaHadiah: boolean } {
  const hr = getHarian();
  const daftar = misiHariIni();
  const beres = daftar.filter((m) => (hr.maju[m.id] ?? 0) >= m.target);
  return { selesai: beres.length, total: daftar.length, adaHadiah: beres.some((m) => !hr.klaim.includes(m.id)) || statusBansos().bisa };
}

export function showMisi(onChange: () => void): void {
  const isi = h("div", { class: "col", style: "gap:9px" });
  const lukis = () => {
    const hr = getHarian();
    isi.replaceChildren(
      h("div", { class: "sheet-title" }, ic("bintang"), "Misi hari ini"),
      h("div", { class: "muted" }, "Tiga misi baru tiap hari. Hadiahnya Emas Antum buat belanja di toko."),
      (() => {
        const b = statusBansos();
        return h(
          "button",
          { class: "arow", onclick: () => showBansos(() => (onChange(), lukis())) },
          h("span", { class: "a-icon" }, ic(b.bisa ? "bantu" : "centang")),
          h("span", { class: "a-main" }, h("b", {}, "Bansos harian"), h("small", {}, b.bisa ? `Jatah hari ke-${b.ke} belum diambil` : `Hari ke-${b.ke} sudah diambil, besok lagi`)),
          h("span", { class: "a-label" }, b.bisa ? ic("koin") : null, b.bisa ? `+${b.hadiah}` : null),
        );
      })(),
      ...misiHariIni().map((m) => {
        const n = Math.min(m.target, hr.maju[m.id] ?? 0);
        const beres = n >= m.target;
        const sudah = hr.klaim.includes(m.id);
        return h(
          "div",
          { class: "arow" },
          h("span", { class: "a-icon" }, ic(sudah ? "centang" : "bintang")),
          h("span", { class: "a-main" }, h("b", {}, m.teks), h("small", {}, `${n} dari ${m.target}`)),
          beres && !sudah
            ? h(
                "button",
                {
                  class: "btn small",
                  onclick: () => {
                    hr.klaim.push(m.id);
                    localStorage.setItem(MISI_KEY, JSON.stringify(hr));
                    ubahEmas(m.hadiah);
                    sfx.coin();
                    onChange();
                    lukis();
                  },
                },
                `Ambil +${m.hadiah}`,
              )
            : h("span", { class: "a-label" }, sudah ? "diambil" : null, sudah ? null : ic("koin"), sudah ? null : String(m.hadiah)),
        );
      }),
      h("button", { class: "btn grey", onclick: () => close() }, "Tutup"),
    );
  };
  lukis();
  const close = modal(h("div", { class: "sheet" }, isi));
}

// ------------------------------------------------------------------ bansos harian

/** Jatah Emas Antum untuk hari ke-1 sampai ke-7. Hari ke-7 ditambah satu amplop stiker, lalu balik ke hari 1. */
const BANSOS = [5, 5, 8, 8, 10, 12, 25];
interface Absen {
  /** nomor hari terakhir mengambil */
  hari: number;
  /** posisi di putaran 7 hari */
  ke: number;
  beruntun: number;
}
const ABSEN_KEY = "wkwk.harian";
/** Nomor hari menurut jam HP pemain: berganti tepat tengah malam waktu setempat. */
const nomorHari = (): number => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60_000) / 86_400_000);

function getAbsen(): Absen {
  try {
    const a = JSON.parse(localStorage.getItem(ABSEN_KEY) ?? "null") as Absen | null;
    if (a && Number.isFinite(a.hari)) return a;
  } catch {
    // data rusak: mulai dari hari 1
  }
  return { hari: -9, ke: 0, beruntun: 0 };
}

export function statusBansos(): { bisa: boolean; ke: number; beruntun: number; hadiah: number } {
  const a = getAbsen();
  const kini = nomorHari();
  // sudah ambil hari ini (atau jam HP dimundurkan): tidak bisa ambil lagi
  if (a.hari >= kini) return { bisa: false, ke: a.ke, beruntun: a.beruntun, hadiah: BANSOS[a.ke - 1] };
  const lanjut = a.hari === kini - 1;
  const ke = lanjut ? (a.ke % BANSOS.length) + 1 : 1;
  return { bisa: true, ke, beruntun: lanjut ? a.beruntun + 1 : 1, hadiah: BANSOS[ke - 1] };
}

export function showBansos(onChange: () => void): void {
  const isi = h("div", { class: "col", style: "gap:10px" });
  const lukis = () => {
    const b = statusBansos();
    isi.replaceChildren(...nodes(
      h("div", { class: "sheet-title" }, ic("bantu"), "Bansos harian"),
      h(
        "div",
        { class: "muted" },
        b.bisa ? "Yang ini beneran cair. Datang tiap hari, jatahnya makin besar." : `Jatah hari ini sudah diambil. Besok giliran hari ke-${(b.ke % BANSOS.length) + 1}.`,
      ),
      h(
        "div",
        { class: "bansos" },
        ...BANSOS.map((n, i) => {
          const hari = i + 1;
          const sudah = hari < b.ke || (hari === b.ke && !b.bisa);
          return h(
            "div",
            { class: `hari${sudah ? " sudah" : ""}${hari === b.ke && b.bisa ? " kini" : ""}${hari === BANSOS.length ? " puncak" : ""}` },
            h("small", {}, `Hari ${hari}`),
            ic(sudah ? "centang" : "koin"),
            h("b", {}, hari === BANSOS.length ? `+${n} dan amplop stiker` : `+${n}`),
          );
        }),
      ),
      h("div", { class: "muted small" }, "Bolong sehari, hitungan balik ke hari 1."),
      b.bisa
        ? h(
            "button",
            {
              class: "btn big green",
              onclick: () => {
                localStorage.setItem(ABSEN_KEY, JSON.stringify({ hari: nomorHari(), ke: b.ke, beruntun: b.beruntun } satisfies Absen));
                ubahEmas(b.hadiah);
                if (b.ke === BANSOS.length) tambahAmplop(1);
                sfx.coin();
                onChange();
                lukis();
              },
            },
            `Ambil +${b.hadiah} emas`,
          )
        : null,
      h("button", { class: "btn grey", onclick: () => close() }, b.bisa ? "Nanti saja" : "Tutup"),
    ));
  };
  lukis();
  const close = modal(h("div", { class: "sheet" }, isi));
}

// ------------------------------------------------------------------ album stiker

type Langka = "biasa" | "langka" | "sultan";
interface Stiker {
  id: string;
  nama: string;
  ket: string;
  /** halaman album */
  hal: number;
  langka: Langka;
  /** nama ikon, atau profesi untuk stiker warga */
  ikon?: string;
  profesi?: string;
}
const HALAMAN = ["Warga", "Rezim", "Perlawanan"];
const STIKER: Stiker[] = [
  { id: "buruh", hal: 0, langka: "biasa", profesi: "buruh", nama: "Buruh", ket: "Gaji UMR, cicilan sultan." },
  { id: "pedagang", hal: 0, langka: "biasa", profesi: "pedagang", nama: "Pedagang", ket: "Untung tipis, pungli tebal." },
  { id: "ojol", hal: 0, langka: "biasa", profesi: "ojol", nama: "Ojol", ket: "Bintang lima, bensin sendiri." },
  { id: "kreator", hal: 0, langka: "langka", profesi: "kreator", nama: "Kreator", ket: "Kontennya viral, endorse belum cair." },
  { id: "jurnalis", hal: 0, langka: "langka", profesi: "jurnalis", nama: "Jurnalis", ket: "Nulis fakta, dituduh hoaks." },
  { id: "mahasiswa", hal: 0, langka: "langka", profesi: "mahasiswa", nama: "Mahasiswa", ket: "Skripsi nanti, demo dulu." },
  { id: "mobil", hal: 1, langka: "biasa", ikon: "mobil", nama: "Mobil Pejabat", ket: "Lampu merah bukan urusannya." },
  { id: "pelicin", hal: 1, langka: "biasa", ikon: "uang", nama: "Uang Pelicin", ket: "Biar urusan lancar jaya." },
  { id: "buzzer", hal: 1, langka: "langka", ikon: "robot", nama: "Buzzer", ket: "Akun baru, opini seragam." },
  { id: "aparat", hal: 1, langka: "langka", ikon: "sirene", nama: "Aparat", ket: "Mengayomi, katanya." },
  { id: "kursi", hal: 1, langka: "langka", ikon: "kursi", nama: "Kursi Empuk", ket: "Sekali duduk, ogah berdiri." },
  { id: "rezim", hal: 1, langka: "sultan", nama: "Sang Rezim", ket: "Senyumnya ada di semua baliho." },
  { id: "toa", hal: 2, langka: "biasa", ikon: "toa", nama: "Toa Demo", ket: "Suara rakyat, volume penuh." },
  { id: "petisi", hal: 2, langka: "biasa", ikon: "petisi", nama: "Petisi", ket: "Tanda tangan dulu, viral kemudian." },
  { id: "koran", hal: 2, langka: "biasa", ikon: "koran", nama: "Koran Pagi", ket: "Berita utama: warga masih sabar." },
  { id: "palu", hal: 2, langka: "langka", ikon: "palu", nama: "Palu Sidang", ket: "Tok! Yang salah siapa, ya." },
  { id: "lumbung", hal: 2, langka: "langka", ikon: "karung", nama: "Lumbung", ket: "Patungan warga, bukan anggaran." },
  { id: "mahkota", hal: 2, langka: "sultan", ikon: "mahkota", nama: "Mahkota Rakyat", ket: "Kedaulatan balik ke pemiliknya." },
];
const LABEL_LANGKA: Record<Langka, string> = { biasa: "biasa", langka: "langka", sultan: "sultan" };
/** Stiker dobel ditukar jadi Emas Antum. */
const NILAI_DOBEL: Record<Langka, number> = { biasa: 2, langka: 5, sultan: 15 };
const BONUS_HALAMAN = 30;
const BONUS_TAMAT = 100;
export const HARGA_AMPLOP = 20;

interface Album {
  /** berapa kali tiap stiker didapat */
  punya: Record<string, number>;
  /** amplop yang belum dibuka */
  amplop: number;
  /** halaman yang bonusnya sudah diberikan */
  hal: number[];
  tamat: boolean;
}
const ALBUM_KEY = "wkwk.album";

function getAlbum(): Album {
  try {
    const a = JSON.parse(localStorage.getItem(ALBUM_KEY) ?? "null") as Album | null;
    if (a) return { punya: a.punya ?? {}, amplop: a.amplop ?? 0, hal: a.hal ?? [], tamat: !!a.tamat };
  } catch {
    // data rusak: album kosong
  }
  return { punya: {}, amplop: 0, hal: [], tamat: false };
}
const simpanAlbum = (a: Album) => localStorage.setItem(ALBUM_KEY, JSON.stringify(a));

/** Jatah amplop sehabis satu permainan: kalah 1, menang 2, menang bintang tiga 3. */
export const jatahAmplop = (menang: boolean, bintang: number): number => (menang ? (bintang >= 3 ? 3 : 2) : 1);

export function tambahAmplop(n: number): void {
  const a = getAlbum();
  a.amplop += n;
  simpanAlbum(a);
}

export function ringkasAlbum(): { punya: number; total: number; amplop: number } {
  const a = getAlbum();
  return { punya: STIKER.filter((s) => a.punya[s.id]).length, total: STIKER.length, amplop: a.amplop };
}

interface Tarikan {
  stiker: Stiker;
  baru: boolean;
  /** Emas Antum pengganti kalau dobel */
  emas: number;
}

/** Ambil satu stiker. Yang belum dipunya sedikit diutamakan, biar album tidak mustahil dilengkapi. */
function tarik(a: Album): Stiker {
  const r = Math.random();
  const langka: Langka = r < 0.08 ? "sultan" : r < 0.38 ? "langka" : "biasa";
  const kolam = STIKER.filter((s) => s.langka === langka);
  const belum = kolam.filter((s) => !a.punya[s.id]);
  const dari = belum.length > 0 && Math.random() < 0.55 ? belum : kolam;
  return dari[Math.floor(Math.random() * dari.length)];
}

/** Buka semua amplop yang tersimpan. Stiker dobel dan bonus halaman langsung jadi Emas Antum. */
export function bukaAmplop(): { tarikan: Tarikan[]; bonus: string[] } {
  const a = getAlbum();
  const tarikan: Tarikan[] = [];
  const bonus: string[] = [];
  let emas = 0;
  while (a.amplop > 0) {
    a.amplop -= 1;
    const stiker = tarik(a);
    const baru = !a.punya[stiker.id];
    a.punya[stiker.id] = (a.punya[stiker.id] ?? 0) + 1;
    const ganti = baru ? 0 : NILAI_DOBEL[stiker.langka];
    emas += ganti;
    tarikan.push({ stiker, baru, emas: ganti });
  }
  HALAMAN.forEach((nama, hal) => {
    if (a.hal.includes(hal) || !STIKER.filter((s) => s.hal === hal).every((s) => a.punya[s.id])) return;
    a.hal.push(hal);
    emas += BONUS_HALAMAN;
    bonus.push(`Halaman ${nama} lengkap, +${BONUS_HALAMAN} emas`);
  });
  if (!a.tamat && STIKER.every((s) => a.punya[s.id])) {
    a.tamat = true;
    emas += BONUS_TAMAT;
    bonus.push(`Album tamat, +${BONUS_TAMAT} emas`);
  }
  simpanAlbum(a);
  if (emas > 0) ubahEmas(emas);
  return { tarikan, bonus };
}

function kartuStiker(s: Stiker, punya: number, tanda?: string): HTMLElement {
  const gambar = punya > 0 ? (s.profesi ? ava(s.profesi, STIKER.indexOf(s)) : s.ikon ? ic(s.ikon) : rezimAva()) : ic("tanya");
  return h(
    "div",
    { class: `stiker ${s.langka}${punya > 0 ? "" : " kosong"}`, title: punya > 0 ? s.ket : "Belum punya" },
    tanda ? h("span", { class: "tanda" }, tanda) : null,
    h("span", { class: "gambar" }, gambar),
    h("b", {}, punya > 0 ? s.nama : "???"),
    h("small", {}, punya > 0 ? s.ket : LABEL_LANGKA[s.langka]),
  );
}

/** Deretan stiker hasil buka amplop, muncul satu per satu. */
export function hasilAmplop(): HTMLElement {
  const { tarikan, bonus } = bukaAmplop();
  sfx.coin();
  return h(
    "div",
    { class: "col", style: "gap:7px" },
    h(
      "div",
      { class: "stiker-baris" },
      ...tarikan.map((t, i) => {
        const el = kartuStiker(t.stiker, 1, t.baru ? "baru" : `dobel +${t.emas}`);
        el.classList.add("muncul");
        if (!t.baru) el.classList.add("dobel");
        el.style.animationDelay = `${i * 0.22}s`;
        return el;
      }),
    ),
    ...bonus.map((b) => h("div", { class: "unlock" }, ic("bintang"), b)),
  );
}

export function showAlbum(onChange: () => void): void {
  const isi = h("div", { class: "col", style: "gap:10px" });
  const lukis = (hasil?: HTMLElement) => {
    const a = getAlbum();
    const r = ringkasAlbum();
    const emas = getStats().emas;
    isi.replaceChildren(...nodes(
      h("div", { class: "sheet-title" }, ic("kartu"), "Album stiker"),
      h("div", { class: "muted" }, `${r.punya} dari ${r.total} stiker. Tiap habis main dapat amplop: kalah 1, menang 2, bintang tiga 3.`),
      hasil ?? null,
      a.amplop > 0
        ? h("button", { class: "btn big green", onclick: () => (lukis(hasilAmplop()), onChange()) }, ic("kartu"), `Buka ${a.amplop} amplop`)
        : null,
      ...HALAMAN.flatMap((nama, hal) => {
        const daftar = STIKER.filter((s) => s.hal === hal);
        const n = daftar.filter((s) => a.punya[s.id]).length;
        return [
          h("label", {}, `${nama}, ${n} dari ${daftar.length}${a.hal.includes(hal) ? " (lengkap)" : ""}`),
          h("div", { class: "stiker-grid" }, ...daftar.map((s) => kartuStiker(s, a.punya[s.id] ?? 0))),
        ];
      }),
      h("div", { class: "muted small" }, `Stiker dobel ditukar Emas Antum. Satu halaman lengkap +${BONUS_HALAMAN} emas, album tamat +${BONUS_TAMAT} emas.`),
      !a.tamat && h(
        "button",
        {
          class: "btn grey",
          onclick: () => {
            if (emas < HARGA_AMPLOP) return toast(`Emas Antum kurang ${HARGA_AMPLOP - emas}. Kumpulkan lewat misi, bansos, dan kemenangan.`);
            ubahEmas(-HARGA_AMPLOP);
            tambahAmplop(1);
            lukis(hasilAmplop());
            onChange();
          },
        },
        ic("koin"),
        `Beli 1 amplop, ${HARGA_AMPLOP} emas`,
      ),
      h("button", { class: "btn grey", onclick: () => close() }, "Tutup"),
    ));
    if (hasil) isi.parentElement?.scrollTo({ top: 0 });
  };
  lukis();
  const close = modal(h("div", { class: "sheet" }, isi));
}
