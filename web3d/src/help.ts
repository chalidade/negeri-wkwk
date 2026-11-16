// "Cara Main": lima kartu singkat. Muncul otomatis di game pertama.
import { h, modal } from "./dom.ts";
import { sfx } from "./sfx.ts";

const SLIDES: [string, string, string][] = [
  ["🎯", "Tumbangkan Rezim", "Semua warga satu tim. Habiskan ❤️ Kekuasaan Rezim sebelum Pemilu di ronde 20. Kalau telat, Rezim menang lagi."],
  ["🎲", "Tahan dadu, atur tenaga", "Tahan tombol dadu, lalu lepas di Pelan, Sedang, atau Kencang. Petak yang menyala itu tempat kamu bisa mendarat: incar usaha kosong, hindari pungli."],
  ["🏪", "Cari duit dulu", "Beli usaha. Tiap lewat petak Gajian kamu dapat gaji + omzet dari semua usahamu."],
  ["✊", "Isi Semangat Demo", "Beli usaha, bikin petisi, bahkan kena pungli bikin warga makin marah. Meter penuh = DEMO AKBAR dan Kekuasaan Rezim rontok."],
  ["⚡", "Jurus profesi", "Tiap profesi punya jurus pamungkas yang terisi tiap beberapa giliran. Pakai di saat yang pas, lalu rebut gelar MVP."],
  ["🚘", "Awas mobil pejabat", "Tiap akhir ronde Rezim bikin kebijakan ngawur, lalu mobilnya mencaplok petak kosong. Tapi kalau mampir ke usahamu, dia yang bayar dan Kekuasaannya turun."],
  ["🎴", "Dadu Nasib", "Sebagian kartu dan bencana ditentukan lemparan dadu: angka kecil mujur, angka besar apes. Kamu sendiri yang melempar."],
  ["🕵️", "Awas buzzer", "Rezim bisa menyuap warga yang kepepet kapan saja. Buzzer menyabotase tiap ronde tanpa nama. Jejak digital sering mengarah ke dia, tapi kadang dipalsukan buat memfitnah. Yakin dulu, baru tuduh: cuma satu kesempatan."],
  ["🌾", "Saling jaga", "Lumbung Bersama otomatis menalangi warga yang nggak sanggup bayar. Kalau 2 warga bangkrut, semua kalah."],
];

export const HELP_SEEN = "wkwk.help.v3";

export function showHelp(onDone?: () => void): void {
  let i = 0;
  const icon = h("div", { class: "help-icon" });
  const title = h("div", { class: "sheet-title" });
  const text = h("div", { class: "help-text" });
  const dots = h("div", { class: "dots" });
  const next = h("button", { class: "btn" });
  const render = () => {
    const [ic, t, body] = SLIDES[i];
    icon.textContent = ic;
    title.textContent = t;
    text.textContent = body;
    dots.replaceChildren(...SLIDES.map((_, k) => h("i", { class: k === i ? "on" : "" })));
    next.textContent = i === SLIDES.length - 1 ? "Gas Main! 🎲" : "Lanjut ▶";
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
    localStorage.setItem(HELP_SEEN, "1");
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
