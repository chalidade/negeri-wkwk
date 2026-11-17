// Emas Antum: toko kosmetik dan misi harian. Semuanya tersimpan di perangkat.
import { h, modal, toast } from "./dom.ts";
import { getStats, ubahEmas } from "./help.ts";
import { ic } from "./icons.ts";
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
  return { selesai: beres.length, total: daftar.length, adaHadiah: beres.some((m) => !hr.klaim.includes(m.id)) };
}

export function showMisi(onChange: () => void): void {
  const isi = h("div", { class: "col", style: "gap:9px" });
  const lukis = () => {
    const hr = getHarian();
    isi.replaceChildren(
      h("div", { class: "sheet-title" }, ic("bintang"), "Misi hari ini"),
      h("div", { class: "muted" }, "Tiga misi baru tiap hari. Hadiahnya Emas Antum buat belanja di toko."),
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
