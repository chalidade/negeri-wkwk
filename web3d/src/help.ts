// "Cara Main": lima kartu singkat. Muncul otomatis di game pertama.
import { h, modal } from "./dom.ts";
import { ic, rezimAva } from "./icons.ts";
import { BABAK_FITUR, MAX_ROUNDS, type Fitur } from "./shared.ts";
import { sfx } from "./sfx.ts";

/** Slide dasar: cukup ini untuk mulai main. Sisanya dijelaskan lewat tips saat kejadiannya muncul. */
const DASAR: [string, string, string][] = [
  ["rezim", "Tumbangkan Rezim", `Semua warga satu tim. Habiskan Kekuasaan Rezim (batang merah di atas) sebelum Pemilu di ronde ${MAX_ROUNDS}. Kalau telat, Rezim menang lagi.`],
  ["dadu", "Tahan dadu, atur tenaga", "Tahan tombol dadu, lalu lepas di Pelan, Sedang, atau Kencang. Petak yang menyala itu tempat kamu bisa mendarat: incar usaha kosong, hindari pungli."],
  ["toko", "Beli usaha, lalu upgrade", "Tiap lewat petak Gajian kamu dapat gaji ditambah omzet semua usahamu. Mendarat lagi di usahamu, atau ketuk panah kuning di atasnya, buat upgrade."],
  ["toa", "Isi Semangat Demo", "Beli usaha, bikin petisi, bahkan kena pungli bikin warga makin marah dan massa berkumpul di depan Istana. Batang kuning penuh berarti Demo Akbar: Kekuasaan Rezim rontok."],
];

/** Mekanik yang terbuka bertahap. Dikenalkan lewat kartu "Baru di babak ini". */
export const FITUR_BARU: { fitur: Fitur; ikon: string; judul: string; isi: string }[] = [
  { fitur: "pelicin", ikon: "tangan", judul: "Uang pelicin", isi: "Beli dan upgrade bisa lewat jalur pelicin: lebih murah, tapi 1 dari 4 kena OTT (denda dan ditahan), dan tiap suap bikin Rezim pulih." },
  { fitur: "aparat", ikon: "dadu", judul: "Aparat menghadang demo", isi: "Hasil Demo Akbar ditentukan dadu: angka kecil barikade jebol, angka besar massa dibubarkan gas air mata dan satu warga diamankan." },
  { fitur: "pinjol", ikon: "pinjol", judul: "Pinjol dan bantu warga", isi: "Kepepet? Pinjol cair seketika, tapi bunganya 20% di depan dan 10% tiap ronde. Warga lain bisa bantu melunasi lewat tombol Aksi." },
  { fitur: "buzzer", ikon: "kaca", judul: "Buzzer dan Sidang Warga", isi: "Rezim bisa menyuap satu warga, dan bisa juga menyodorkan amplop ke kamu. Buzzer main seperti biasa tapi diam-diam menyabotase. Sabotase dan jejak juga bisa ulah Rezim sendiri, dan buzzer yang tertangkap bisa diganti. Yakin? Panggil Sidang Warga: suara terbanyak diusir." },
  { fitur: "anggaran", ikon: "uang", judul: "Anggaran dan pengalihan isu", isi: "Pungutan yang kamu bayar masuk Kas Rezim, lalu dihamburkan jadi pencitraan. Semangat tinggi di akhir ronde bisa digembosi Pengalihan Isu." },
];

const LAINNYA: [string, string, string][] = [
  ["petir", "Jurus profesi", "Tiap profesi punya jurus pamungkas yang terisi tiap beberapa giliran. Pakai lewat tombol Aksi di saat yang pas, lalu rebut gelar MVP."],
  ["mobil", "Awas mobil pejabat", "Tiap akhir ronde Rezim bikin kebijakan, lalu mobilnya mencaplok petak kosong. Tapi kalau mampir ke usahamu, dia yang bayar dan Kekuasaannya turun."],
  ["kartu", "Dadu Nasib", "Sebagian kartu dan bencana ditentukan lemparan dadu: angka kecil mujur, angka besar apes."],
  ["karung", "Saling jaga", "Lumbung Bersama otomatis menalangi warga yang nggak sanggup bayar. Kalau 2 warga bangkrut, semua kalah."],
];

export const HELP_SEEN = "wkwk.help.v5";

/**
 * "Cara main". `ringkas`: hanya slide dasar (dipakai sebelum game pertama).
 * Dari tombol tanya di beranda: semua slide, termasuk mekanik yang baru terbuka di babak lanjut.
 */
export function showHelp(onDone?: () => void, ringkas = false): void {
  const SLIDES: [string, string, string][] = ringkas
    ? DASAR
    : [...DASAR, ...LAINNYA, ...FITUR_BARU.map((f): [string, string, string] => [f.ikon, `${f.judul} (babak ${BABAK_FITUR[f.fitur]})`, f.isi])];
  let i = 0;
  const icon = h("div", { class: "help-icon" });
  const title = h("div", { class: "sheet-title" });
  const text = h("div", { class: "help-text" });
  const dots = h("div", { class: "dots" });
  const next = h("button", { class: "btn" });
  const render = () => {
    const [ikon, t, body] = SLIDES[i];
    icon.replaceChildren(ikon === "rezim" ? rezimAva() : ic(ikon));
    title.textContent = t;
    text.textContent = body;
    dots.replaceChildren(...SLIDES.map((_, k) => h("i", { class: k === i ? "on" : "" })));
    next.textContent = i === SLIDES.length - 1 ? (ringkas ? "Gas main" : "Tutup") : "Lanjut";
  };
  next.onclick = () => {
    sfx.click();
    if (i < SLIDES.length - 1) {
      i++;
      render();
    } else close();
  };
  render();
  const close = modal(h("div", { class: "sheet col help" }, icon, title, text, dots, next), () => {
    if (ringkas) localStorage.setItem(HELP_SEEN, "1");
    onDone?.();
  });
}

// ------------------------------------------------------------------ statistik lokal

export interface Stats {
  main: number;
  menang: number;
  streak: number;
  /** ronde tercepat menumbangkan Rezim */
  rekor: number | null;
  /** babak tertinggi yang sudah terbuka (solo) */
  babak: number;
  /** bintang terbaik tiap babak */
  bintang: Record<string, number>;
  xp: number;
  /** Emas Antum hasil main (mata uang kosmetik) */
  emas: number;
}

export interface Hadiah {
  bintang: number;
  xp: number;
  emas: number;
  /** babak yang baru terbuka gara-gara kemenangan ini */
  babakBaru: number | null;
}

const STATS_KEY = "wkwk.stats";
const KOSONG: Stats = { main: 0, menang: 0, streak: 0, rekor: null, babak: 1, bintang: {}, xp: 0, emas: 0 };

export function getStats(): Stats {
  try {
    return { ...KOSONG, ...JSON.parse(localStorage.getItem(STATS_KEY) ?? "{}") };
  } catch {
    return { ...KOSONG };
  }
}

/** Tambah atau kurangi Emas Antum (belanja di toko, hadiah misi). */
export function ubahEmas(delta: number): number {
  const s = getStats();
  s.emas = Math.max(0, s.emas + delta);
  localStorage.setItem(STATS_KEY, JSON.stringify(s));
  return s.emas;
}

/** Catat hasil satu permainan dan hitung hadiahnya. */
export function recordGame(o: {
  win: boolean;
  round: number;
  maxRounds: number;
  level: number;
  mvp: boolean;
  jasa: number;
  solo: boolean;
  maxBabak: number;
}): { stats: Stats; hadiah: Hadiah } {
  const s = getStats();
  // ★ menang, ★★ menang dengan sisa 3 ronde atau lebih, ★★★ sekaligus jadi MVP
  const bintang = o.win ? 1 + (o.round <= o.maxRounds - 3 ? 1 : 0) + (o.mvp ? 1 : 0) : 0;
  const pertama = o.solo && o.win && !s.bintang[o.level];
  const hadiah: Hadiah = {
    bintang,
    xp: 20 + (o.win ? 40 : 0) + bintang * 15 + Math.min(60, Math.round(o.jasa / 3)) + (o.mvp ? 20 : 0),
    emas: bintang * 5 + (pertama ? 15 : 0),
    babakBaru: null,
  };
  s.main += 1;
  s.xp += hadiah.xp;
  s.emas += hadiah.emas;
  if (o.win) {
    s.menang += 1;
    s.streak += 1;
    s.rekor = s.rekor === null ? o.round : Math.min(s.rekor, o.round);
    if (o.solo) {
      s.bintang[o.level] = Math.max(s.bintang[o.level] ?? 0, bintang);
      if (o.level >= s.babak && o.level < o.maxBabak) {
        s.babak = o.level + 1;
        hadiah.babakBaru = s.babak;
      }
    }
  } else s.streak = 0;
  localStorage.setItem(STATS_KEY, JSON.stringify(s));
  return { stats: s, hadiah };
}
