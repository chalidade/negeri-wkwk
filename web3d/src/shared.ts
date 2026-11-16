// Aturan, tipe, dan data papan dipakai bersama dengan server (satu sumber kebenaran).
export * from "../../supabase/functions/_shared/engine/mod.ts";
import type { GameState, PlayerState } from "../../supabase/functions/_shared/engine/mod.ts";

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
