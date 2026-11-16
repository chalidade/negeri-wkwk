// Tipe dan data papan dipakai bersama dengan server (satu sumber kebenaran).
import boardJson from "../../supabase/functions/_shared/board.json";
import type {
  Action,
  GameState,
  PlayerState,
  TileDef,
  TileState,
} from "../../supabase/functions/_shared/engine/types.ts";
import * as rules from "../../supabase/functions/_shared/engine/rules.ts";

export type { Action, GameState, PlayerState, TileDef, TileState };
export { rules };

export const TILES: TileDef[] = (boardJson as { tiles: TileDef[] }).tiles;
export const GOV = "pemerintah";

export const PROFESSION_LABEL: Record<string, string> = {
  buruh: "Buruh Pabrik",
  pedagang: "Pedagang UMKM",
  ojol: "Ojol / Kurir",
  kreator: "Kreator Konten",
  jurnalis: "Jurnalis",
  mahasiswa: "Mahasiswa",
};

export const PROFESSION_EMOJI: Record<string, string> = {
  buruh: "🏭",
  pedagang: "🏪",
  ojol: "🛵",
  kreator: "📱",
  jurnalis: "📰",
  mahasiswa: "🎓",
};

export const MIMPI_LABEL: Record<string, string> = {
  beli_rumah: "Beli rumah",
  naik_haji: "Naik haji",
  nyekolahin_adik: "Nyekolahin adik",
  buka_cabang_ketiga: "Buka cabang ke-3",
  pensiun_tenang: "Pensiun tenang",
  nikah_tanpa_utang: "Nikah tanpa utang",
};

export const LEVEL_LABEL = ["Lapak", "Toko", "Cabang", "Brand Lokal"];

export const PLAYER_COLORS = ["#e63946", "#3a86ff", "#2dbe6c", "#ff9f1c", "#9b5de5", "#00bbf9"];
export const colorForSeat = (seat: number) => PLAYER_COLORS[seat % PLAYER_COLORS.length];

export function scaled(state: GameState, amount: number): number {
  return rules.scaled(amount, state.inflationLevel);
}

export function playersInOrder(state: GameState): PlayerState[] {
  return state.order.map((id) => state.players[id]);
}
