// "Cara Main": lima kartu singkat. Muncul otomatis di game pertama.
import { h, modal } from "./dom.ts";
import { sfx } from "./sfx.ts";

const SLIDES: [string, string, string][] = [
  ["🎯", "Tumbangkan Rezim", "Semua warga satu tim. Habiskan ❤️ Kekuasaan Rezim sebelum Pemilu di ronde 20. Kalau telat, Rezim menang lagi."],
  ["🏪", "Cari duit dulu", "Lempar dadu, beli usaha. Tiap lewat petak Gajian kamu dapat gaji + omzet dari semua usahamu."],
  ["✊", "Isi Semangat Demo", "Beli usaha, bikin petisi, bahkan kena pungli bikin warga makin marah. Meter penuh = DEMO AKBAR dan Kekuasaan Rezim rontok."],
  ["🚘", "Awas mobil pejabat", "Tiap akhir ronde Rezim bikin kebijakan ngawur, lalu mobilnya mencaplok petak kosong. Tapi kalau mampir ke usahamu, dia yang bayar dan Kekuasaannya turun."],
  ["🌾", "Saling jaga", "Lumbung Bersama otomatis menalangi warga yang nggak sanggup bayar. Kalau 2 warga bangkrut, semua kalah."],
];

export const HELP_SEEN = "wkwk.help";

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
}

const STATS_KEY = "wkwk.stats";

export function getStats(): Stats {
  try {
    return { main: 0, menang: 0, streak: 0, rekor: null, ...JSON.parse(localStorage.getItem(STATS_KEY) ?? "{}") };
  } catch {
    return { main: 0, menang: 0, streak: 0, rekor: null };
  }
}

export function recordResult(win: boolean, round: number): Stats {
  const s = getStats();
  s.main += 1;
  if (win) {
    s.menang += 1;
    s.streak += 1;
    s.rekor = s.rekor === null ? round : Math.min(s.rekor, round);
  } else s.streak = 0;
  localStorage.setItem(STATS_KEY, JSON.stringify(s));
  return s;
}
