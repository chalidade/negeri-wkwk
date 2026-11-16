// Otak bot. Fungsi murni: lihat state, pilih SATU aksi.
// Dipanggil berulang-ulang sampai giliran bot selesai, satu aksi per panggilan,
// supaya klien sempat menganimasikan tiap langkah.
import { TILES, biayaUpgrade, coop, hargaBeli, kampungMandiri, panik } from "./core.ts";
import * as R from "./rules.ts";
import { GOV, type Action, type Gaya, type GameState, type PlayerSecret } from "./types.ts";

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

/** Seberapa enak mendarat di sebuah petak, dari sudut pandang pemain ini. */
function nilaiPetak(s: GameState, id: string, idx: number, reserve: number): number {
  const def = TILES[idx];
  const p = s.players[id];
  switch (def.type) {
    case "property": {
      const owner = s.tiles[idx].owner;
      if (owner === null) return p.cuan - hargaBeli(s, idx) >= reserve ? 3 : 0;
      if (owner === id) return 2;
      if (owner === GOV) return p.cuan - hargaBeli(s, idx) >= reserve * 2 ? 1 : -3;
      return coop(s) ? 0 : -2;
    }
    case "tax":
    case "gov_seat":
      return -3;
    case "go_to_jail":
      return -4;
    case "demo":
      return coop(s) ? 4 : 1;
    case "lumbung":
      return 2;
    default:
      return 0;
  }
}

/** Tenaga lemparan yang rata-rata mendarat di petak paling menguntungkan. */
export function pilihGaya(s: GameState, id: string, reserve = 2_500_000): Gaya {
  const p = s.players[id];
  let best: Gaya = "sedang";
  let bestScore = -Infinity;
  for (const gaya of ["pelan", "sedang", "kencang"] as const) {
    const [lo, hi] = R.GAYA_DADU[gaya];
    let total = 0;
    let bobot = 0;
    for (let sum = lo; sum <= hi; sum++) {
      const w = 6 - Math.abs(7 - sum);
      const lewatGajian = p.position + sum >= R.BOARD_SIZE ? 2 : 0;
      total += w * (nilaiPetak(s, id, (p.position + sum) % R.BOARD_SIZE, reserve) + lewatGajian);
      bobot += w;
    }
    if (total / bobot > bestScore) {
      bestScore = total / bobot;
      best = gaya;
    }
  }
  return best;
}

/**
 * Pilih aksi berikutnya untuk bot yang sedang giliran.
 * - Rakyat di mode Rakyat Bersatu: beli usaha, lalu pakai sisa uang buat melawan Rezim.
 * - Buzzer & mode Juragan: serakah, fokus menimbun dan beli usaha.
 * Aksi opsional selalu dicek dulu syaratnya, jadi engine tidak akan menolak.
 */
export function decideBotAction(s: GameState, botId: string, role: PlayerSecret["role"] = "rakyat"): Action {
  const p = s.players[botId];
  // Buzzer yang belum terbongkar pura-pura jadi warga biasa, tapi tidak pernah ikut melawan.
  const buzzer = coop(s) && !p.buzzer && (s.rahasia.buzzer === botId || role === "buzzer");
  const kawan = coop(s) && !buzzer;
  // Cadangan supaya tidak bangkrut kena pungli/kebijakan.
  const reserve = 2_500_000 * panik(s);

  if (s.phase === "awaiting_buy") {
    const idx = s.pendingTile ?? -1;
    return p.cuan - hargaBeli(s, idx) >= reserve ? { type: "buy" } : { type: "skip_buy" };
  }
  if (s.phase !== "awaiting_roll" && s.phase !== "awaiting_end") return { type: "end_turn" };

  // Buzzer menyiapkan satu sabotase tiap ronde.
  if (buzzer && s.rahasia.buzzer === botId && s.rahasia.antre === 0 && s.phase === "awaiting_roll") {
    return { type: "sabotase" };
  }

  // Warga jujur menuduh begitu tersisa satu tersangka (dan memberi pemain manusia waktu duluan).
  if (kawan && !p.sudahTuduh && s.round >= 12) {
    const tersangka = s.order.filter((id) => id !== botId && !s.players[id].bankrupt && !s.bersih.includes(id));
    const sudahAda = s.order.some((id) => s.players[id].buzzer);
    if (tersangka.length === 1 && s.bersih.length > 0 && !sudahAda) return { type: "tuduh", target: tersangka[0] };
  }

  // 0. Jurus profesi begitu terisi. Jalan Tikus (ojol) hanya bisa setelah melempar.
  if (!buzzer && p.jurus >= R.JURUS_PENUH && (p.profession !== "ojol" || s.phase === "awaiting_end")) {
    return { type: "jurus" };
  }

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
    return p.jailTurns > 0 || p.skipNext ? { type: "roll" } : { type: "roll", gaya: pilihGaya(s, botId, reserve) };
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
