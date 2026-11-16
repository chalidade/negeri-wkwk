import type { EventRow } from "./api.ts";
import { GOV, LEVEL_LABEL, TILES, type GameState } from "./shared.ts";

/** Ubah event server jadi kalimat log. null = tidak perlu ditampilkan. */
export function describeEvent(e: EventRow, game: GameState | null): string | null {
  const p = e.payload ?? {};
  const nameOf = (id: unknown) => {
    if (typeof id !== "string") return "Seseorang";
    if (id === GOV) return "Pemerintah";
    return game?.players[id]?.name ?? "Pemain";
  };
  const tileName = (i: unknown) => (typeof i === "number" && TILES[i] ? TILES[i].name : "petak");
  const n = (k: string) => (typeof p[k] === "number" ? (p[k] as number) : 0);
  const who = nameOf(e.actor_id);

  switch (e.type) {
    case "game_mulai":
      return "🎬 Permainan dimulai. Semangat, Warga!";
    case "dadu": {
      const d = (p.dadu as number[]) ?? [0, 0];
      return `🎲 ${who} melempar ${d[0]} + ${d[1]}${d[0] === d[1] ? " (kembar!)" : ""}`;
    }
    case "lewat_gajian":
      return `💰 ${who} lewat Gajian, bonus ₵${n("bonus")}`;
    case "gajian":
      return `💵 ${who} gajian ₵${n("jumlah")}`;
    case "gaji_berhenti":
      return `😢 ${who} kena PHK, gaji berhenti`;
    case "tawaran_beli":
      return `🏷️ ${who} mampir di ${tileName(p.tile)} (₵${n("harga")})`;
    case "beli":
      return `🏪 ${who} membuka usaha di ${tileName(p.tile)}`;
    case "lewati_beli":
      return `🚶 ${who} nggak jadi beli ${tileName(p.tile)}`;
    case "bayar_sewa":
      return `🤝 ${who} bayar sewa ₵${n("jumlah")} ke ${nameOf(p.ke)}`;
    case "bangga_produk_lokal":
      return `🇮🇩 Bangga Produk Lokal! Bonus ₵${n("bonus")} buat penyewa & pemilik`;
    case "setor_ke_pemerintah":
      return `🪑 ${who} setor ₵${n("jumlah")} ke ${tileName(p.tile)}`;
    case "pajak":
      return `🧾 ${who} bayar ${tileName(p.tile)} ₵${n("jumlah")}`;
    case "kartu":
      return `${p.dek === "grup_wa" ? "💬 Grup WA" : "🎲 Nasib WNI"} • ${who}: ${p.judul}`;
    case "kena_tilang":
      return `🚓 ${who} masuk Kena Tilang`;
    case "masih_ditilang":
      return `⏳ ${who} masih ditilang (${n("sisa")} giliran lagi)`;
    case "bebas_tilang":
      return `🔓 ${who} bebas dari tilang`;
    case "bayar_denda":
      return `🧾 ${who} bayar denda ₵${n("jumlah")}`;
    case "ott":
      return `🚨 OTT! ${who} kena denda ₵${n("denda")}`;
    case "bencana":
      return `🌊 Bencana! Usaha grup ${p.grup} libur tagih sewa`;
    case "sewa_libur_bencana":
      return `🌊 Sewa ${tileName(p.tile)} libur karena bencana`;
    case "tabungan_menyelamatkan":
      return `🛟 Tabungan Darurat ${who} menyelamatkan ₵${n("jumlah")}`;
    case "bangkrut":
      return `💀 ${who} BANGKRUT`;
    case "meter_gerakan": {
      const dari = n("dari");
      const ke = n("ke");
      return dari === ke ? null : `${ke > dari ? "📈" : "📉"} Meter Gerakan ${dari} → ${ke}`;
    }
    case "upgrade":
      return `⬆️ ${who} upgrade ${tileName(p.tile)} jadi ${LEVEL_LABEL[n("level")] ?? ""}`;
    case "setor_tabungan":
      return `🐷 ${who} nabung ₵${n("jumlah")}`;
    case "donasi_lumbung":
      return `🌾 ${who} donasi ₵${n("jumlah")} ke Lumbung Bersama`;
    case "petisi":
      return `✍️ ${who} memulai petisi online (+${n("gerakan")})`;
    case "liputan_media":
      return `📰 ${who} mendanai liputan media (+${n("gerakan")})`;
    case "biaya_hidup":
      return `🍚 Biaya hidup ₵${n("jumlah")} per orang`;
    case "inflasi_naik":
      return `📈 Meteran Inflasi naik ke tingkat ${n("tingkat")}`;
    case "ronde_baru":
      return `🗓️ Ronde ${n("ronde")} dimulai`;
    case "musim_kampanye":
      return "📣 Musim Kampanye! Pemerintah tiba-tiba bagi-bagi bansos";
    case "kebijakan":
      return `🏛️ Kebijakan: ${p.judul}`;
    case "demo_akbar":
      return "✊ DEMO AKBAR! Kesabaran rakyat habis";
    case "digusur":
      return `🚧 Usaha ${who} di ${tileName(p.tile)} digusur proyek`;
    case "lewati_giliran":
      return `🙈 ${who} malu ditanya "kapan nikah", lewati giliran`;
    case "game_selesai":
      return `🏁 ${resultText(p)}`;
    default:
      return null;
  }
}

export function resultText(result: Record<string, unknown> | null): string {
  switch (result?.kind) {
    case "rakyat_menang":
      return "REFORMASI BERHASIL! Rakyat menang!";
    case "rakyat_kalah":
      return result.reason === "waktu_habis"
        ? "Waktu habis. Rezim masih berkuasa…"
        : "Dua warga bangkrut. Rakyat kalah…";
    case "juragan_menang":
      return "Ada juragan baru di Negeri Wkwk!";
    default:
      return "Permainan selesai.";
  }
}

/** Event yang pantas jadi popup kartu besar di tengah layar. */
export function popupFor(e: EventRow): { title: string; body: string; tone: string } | null {
  const p = e.payload ?? {};
  switch (e.type) {
    case "kartu":
      return {
        title: String(p.judul ?? ""),
        body: String(p.teks ?? ""),
        tone: p.dek === "grup_wa" ? "wa" : "nasib",
      };
    case "kebijakan":
      return { title: `🏛️ ${p.judul}`, body: String(p.teks ?? ""), tone: "gov" };
    case "demo_akbar":
      return { title: "✊ DEMO AKBAR!", body: "Kesabaran rakyat habis. Meter Gerakan naik!", tone: "demo" };
    case "musim_kampanye":
      return { title: "📣 Musim Kampanye", body: "Pemerintah tiba-tiba murah hati. Semua dapat bansos.", tone: "gov" };
    case "ott":
      return { title: "🚨 OTT!", body: "Kecurigaan terlalu tinggi. Denda dan langsung ditilang.", tone: "demo" };
    default:
      return null;
  }
}
