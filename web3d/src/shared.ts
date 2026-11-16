// Aturan, tipe, dan data papan dipakai bersama dengan server (satu sumber kebenaran).
export * from "../../supabase/functions/_shared/engine/mod.ts";
import type { Gaya, GameState, PlayerState } from "../../supabase/functions/_shared/engine/mod.ts";

export const PROFESSION_LABEL: Record<string, string> = {
  buruh: "Buruh Pabrik",
  pedagang: "Pedagang",
  ojol: "Ojol",
  kreator: "Kreator Konten",
  jurnalis: "Jurnalis",
  mahasiswa: "Mahasiswa",
};

export const PROFESSION_EMOJI: Record<string, string> = {
  buruh: "👷",
  pedagang: "🧑‍🍳",
  ojol: "🛵",
  kreator: "🤳",
  jurnalis: "🕵️",
  mahasiswa: "🎓",
};

/** Keahlian tiap profesi, satu kalimat. */
export const PROFESSION_SKILL: Record<string, string> = {
  buruh: "Gaji paling besar tiap gajian.",
  pedagang: "Mulai dengan 1 lapak gratis, omzet usaha +50%.",
  ojol: "Dapat tip DR 200 rb tiap jalan.",
  kreator: "Petisinya viral: Semangat Demo naik hampir 2x.",
  jurnalis: "Liputan Media lebih tajam ke Rezim.",
  mahasiswa: "Tiap Demo Akbar makin sakit buat Rezim.",
};

export const LEVEL_LABEL = ["Lapak", "Toko", "Cabang", "Brand Lokal"];

export const GROUP_COLOR: Record<string, string> = {
  coklat: "#b07a4a",
  biru: "#2fb4ee",
  pink: "#ff6fae",
  oranye: "#ff962e",
  merah: "#ef4a4a",
  kuning: "#f2b90f",
  hijau: "#35bf68",
  ungu: "#9a6af5",
};

export const GROUP_LABEL: Record<string, string> = {
  coklat: "Coklat",
  biru: "Biru",
  pink: "Pink",
  oranye: "Oranye",
  merah: "Merah",
  kuning: "Kuning",
  hijau: "Hijau",
  ungu: "Ungu",
};

export const TILE_ICON: Record<string, string> = {
  start: "💰",
  jail: "🚓",
  go_to_jail: "🚨",
  card_wa: "💬",
  card_nasib: "🎴",
  tax: "🧾",
  gov_seat: "🪑",
  demo: "✊",
  lumbung: "🌾",
  property: "🏪",
};

export const PLAYER_COLORS = ["#ff4d5e", "#2f8bff", "#22c06b", "#ffa51f", "#a35cf0", "#00c2c7"];
export const colorForSeat = (seat: number) => PLAYER_COLORS[seat % PLAYER_COLORS.length];

/** 1500000 -> "1,5 jt", 750000 -> "750 rb" */
export function drPendek(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  const fmt = (v: number) => (Math.round(v * 100) / 100).toLocaleString("id-ID", { maximumFractionDigits: 2 });
  if (a >= 1e9) return `${sign}${fmt(a / 1e9)} M`;
  if (a >= 1e6) return `${sign}${fmt(a / 1e6)} jt`;
  if (a >= 1e3) return `${sign}${fmt(a / 1e3)} rb`;
  return `${sign}${a}`;
}

/** Uang dalam DR (Duit Rakyat). */
export const dr = (n: number): string => `DR ${drPendek(n)}`;

export function playersInOrder(state: GameState): PlayerState[] {
  return state.order.map((id) => state.players[id]);
}

/** Jurus pamungkas tiap profesi (efeknya dihitung di engine). */
export const JURUS: Record<string, { nama: string; efek: string; emoji: string }> = {
  buruh: { nama: "Mogok Massal", efek: "Semangat Demo +18", emoji: "🪧" },
  pedagang: { nama: "Cuci Gudang", efek: "Omzet semua usahamu cair sekarang dua kali lipat, minimal DR 1,5 jt", emoji: "🛍️" },
  ojol: { nama: "Jalan Tikus", efek: "Lempar dadu sekali lagi", emoji: "🛵" },
  kreator: { nama: "Konten Viral", efek: "Dapat DR 1,5 jt dan Semangat Demo +12", emoji: "📱" },
  jurnalis: { nama: "Bongkar Skandal", efek: "Kekuasaan Rezim −7", emoji: "📰" },
  mahasiswa: { nama: "Orasi Akbar", efek: "Semangat Demo +22", emoji: "📣" },
};

/** Tenaga lemparan dadu, urut dari kiri ke kanan di meteran. */
export const GAYA: { id: Gaya; label: string; kisaran: [number, number]; warna: string }[] = [
  { id: "pelan", label: "PELAN", kisaran: [2, 5], warna: "#22c06b" },
  { id: "sedang", label: "SEDANG", kisaran: [6, 8], warna: "#ffa51f" },
  { id: "kencang", label: "KENCANG", kisaran: [9, 12], warna: "#f04457" },
];

/** Rezim tiap babak: makin tinggi makin tebal nyawanya dan makin rakus. */
export const BABAK: { nama: string; emoji: string }[] = [
  { nama: "Lurah Tukang Pungli", emoji: "🧾" },
  { nama: "Camat Hobi Proyek", emoji: "🚧" },
  { nama: "Bupati Dinasti", emoji: "👨‍👩‍👦" },
  { nama: "Wali Kota Pencitraan", emoji: "📸" },
  { nama: "Gubernur Baliho", emoji: "🪧" },
  { nama: "Menteri Rangkap Jabatan", emoji: "🪑" },
  { nama: "Ketua Partai Abadi", emoji: "🎩" },
  { nama: "Jenderal Bisnis", emoji: "🎖️" },
  { nama: "Oligark Tambang", emoji: "⛏️" },
  { nama: "Presiden Tiga Periode", emoji: "👑" },
];

const PANGKAT: [number, string][] = [
  [0, "Warga Biasa"],
  [120, "Warga Kritis"],
  [350, "Aktivis Kampung"],
  [800, "Koordinator Lapangan"],
  [1600, "Tokoh Rakyat"],
  [3000, "Legenda Reformasi"],
];

/** Pangkat warga dari total XP, plus kemajuan menuju pangkat berikutnya (0..1). */
export function pangkat(xp: number): { nama: string; maju: number; berikut: string | null } {
  let i = 0;
  while (i + 1 < PANGKAT.length && xp >= PANGKAT[i + 1][0]) i++;
  const next = PANGKAT[i + 1];
  return {
    nama: PANGKAT[i][1],
    maju: next ? (xp - PANGKAT[i][0]) / (next[0] - PANGKAT[i][0]) : 1,
    berikut: next ? next[1] : null,
  };
}
