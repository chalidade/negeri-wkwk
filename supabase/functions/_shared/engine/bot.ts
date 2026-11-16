// Otak bot. Fungsi murni: lihat state, pilih SATU aksi.
// Dipanggil berulang-ulang sampai giliran bot selesai, satu aksi per panggilan,
// supaya klien sempat menganimasikan tiap langkah.
import { TILES, biayaUpgrade, coop, hargaBeli, kampungMandiri, panik } from "./core.ts";
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
 * - Rakyat di mode Rakyat Bersatu: beli usaha, lalu pakai sisa uang buat melawan Rezim.
 * - Buzzer & mode Juragan: serakah, fokus menimbun dan beli usaha.
 * Aksi opsional selalu dicek dulu syaratnya, jadi engine tidak akan menolak.
 */
export function decideBotAction(s: GameState, botId: string, role: PlayerSecret["role"] = "rakyat"): Action {
  const p = s.players[botId];
  const kawan = coop(s) && role === "rakyat";
  // Cadangan supaya tidak bangkrut kena pungli/kebijakan.
  const reserve = 2_500_000 * panik(s);

  if (s.phase === "awaiting_buy") {
    const idx = s.pendingTile ?? -1;
    return p.cuan - hargaBeli(s, idx) >= reserve ? { type: "buy" } : { type: "skip_buy" };
  }
  if (s.phase !== "awaiting_roll" && s.phase !== "awaiting_end") return { type: "end_turn" };

  // 1. Aksi perlawanan (sekali per giliran).
  if (kawan && !s.aksiDipakai) {
    // Sisakan sedikit Lumbung buat talangan, kecuali Rezim sudah hampir tumbang.
    const sisa = s.kekuasaan <= 15 ? 0 : 1_500_000;
    if (s.lumbung >= R.LIPUTAN_BIAYA_LUMBUNG + sisa) return { type: "liputan_media" };
    if (p.cuan - R.PETISI_BIAYA >= reserve * 2.5) return { type: "petisi" };
  }

  if (s.phase === "awaiting_roll") {
    // 2. Kena tilang dan punya uang: bayar denda biar bisa jalan.
    if (p.jailTurns > 0 && p.cuan - R.DENDA_TILANG >= reserve * 2) return { type: "bayar_denda" };
    return { type: "roll" };
  }

  // 3. Akhir giliran: upgrade usaha. Utamakan yang di Kampung Mandiri, lalu yang termurah.
  let best = -1;
  let bestScore = Infinity;
  s.tiles.forEach((t, i) => {
    if (t.owner !== botId || t.level >= R.MAX_LEVEL) return;
    const score = biayaUpgrade(i) * (kampungMandiri(s, TILES[i].group) ? 0.5 : 1);
    if (score < bestScore) {
      best = i;
      bestScore = score;
    }
  });
  if (best >= 0 && p.cuan - biayaUpgrade(best) >= reserve * 2) return { type: "upgrade", tile: best };

  return { type: "end_turn" };
}
