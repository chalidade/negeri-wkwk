// Otak bot untuk main solo. Fungsi murni: lihat state, pilih SATU aksi.
// Server memanggil ini berulang-ulang sampai giliran bot selesai, satu aksi per panggilan,
// supaya klien sempat menganimasikan tiap langkah.
import { TILES } from "./core.ts";
import * as R from "./rules.ts";
import type { Action, GameState, PlayerSecret } from "./types.ts";

export const BOT_NAMES = [
  "Pak Joko",
  "Bu Sri",
  "Mas Agus",
  "Mbak Rina",
  "Bang Ucok",
  "Cak Mamat",
  "Teh Euis",
  "Uda Rizal",
  "Om Yohan",
  "Kak Nining",
] as const;

/**
 * Pilih aksi berikutnya untuk bot yang sedang giliran.
 * - Rakyat di mode Rakyat Bersatu: bantu gerakan (liputan, petisi, donasi) sambil tetap berusaha.
 * - Buzzer & mode Juragan: serakah, fokus menimbun dan beli usaha.
 * Aksi opsional selalu dicek dulu syaratnya, jadi engine tidak akan menolak.
 */
export function decideBotAction(s: GameState, botId: string, role: PlayerSecret["role"] = "rakyat"): Action {
  const p = s.players[botId];
  const inf = s.inflationLevel;
  const coop = s.mode === "rakyat_bersatu" && role === "rakyat";
  // Cadangan supaya tidak bangkrut kena sewa/kebijakan. Bot serakah berani lebih tipis.
  const reserve = R.scaled(coop ? 220 : 160, inf);

  if (s.phase === "awaiting_buy") {
    const idx = s.pendingTile ?? -1;
    const price = R.scaled(TILES[idx]?.price ?? 0, inf);
    return price > 0 && p.cuan - price >= reserve ? { type: "buy" } : { type: "skip_buy" };
  }

  if (s.phase !== "awaiting_roll" && s.phase !== "awaiting_end") return { type: "end_turn" };

  // 1. Aksi gerakan (sekali per giliran).
  if (coop && !s.aksiDipakai) {
    if (s.lumbung >= R.LIPUTAN_BIAYA_LUMBUNG) return { type: "liputan_media" };
    const petisi = R.scaled(R.PETISI_BIAYA, inf);
    const semangat = s.gerakan >= 40 || p.profession === "kreator" || s.round % 2 === 0;
    if (semangat && p.cuan - petisi >= reserve) return { type: "petisi" };
  }

  if (s.phase === "awaiting_roll") {
    // 2. Kena tilang dan punya uang: bayar denda biar bisa jalan.
    const denda = R.scaled(R.DENDA_TILANG, inf);
    if (p.jailTurns > 0 && p.cuan - denda >= reserve) return { type: "bayar_denda" };
    return { type: "roll" };
  }

  // 3. Akhir giliran: upgrade usaha termurah yang masih bisa naik level.
  let best = -1;
  let bestCost = Infinity;
  s.tiles.forEach((t, i) => {
    const def = TILES[i];
    if (t.owner !== botId || def.type !== "property" || t.level >= R.MAX_LEVEL) return;
    const cost = R.scaled((def.price ?? 0) * R.BIAYA_UPGRADE, inf);
    if (cost < bestCost) {
      best = i;
      bestCost = cost;
    }
  });
  if (best >= 0 && p.cuan - bestCost >= reserve * 1.5) return { type: "upgrade", tile: best };

  // 4. Rakyat yang kelebihan uang menyumbang ke Lumbung Bersama.
  if (coop && p.cuan > reserve * 4) {
    const amount = Math.floor((p.cuan - reserve * 3) / R.DONASI_PER_SUARA) * R.DONASI_PER_SUARA;
    if (amount >= R.DONASI_PER_SUARA) return { type: "donasi_lumbung", amount };
  }

  return { type: "end_turn" };
}
