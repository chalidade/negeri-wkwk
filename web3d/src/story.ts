// Mengubah event dari engine menjadi kalimat untuk feed & riwayat.
import { LEVEL_LABEL, TILES, dr, type GameEvent, type GameState } from "./shared.ts";

const ALASAN_TILANG: Record<string, string> = {
  diciduk: "diciduk aparat",
  kebut_kebutan: "kebut-kebutan (3x dadu kembar)",
  posting_kritik: "gara-gara posting kritik",
  razia: "kena razia dadakan",
  diamankan: "\"diamankan\" aparat",
};

export function describe(e: GameEvent, s: GameState, me: string): string | null {
  const p = e.payload as Record<string, never>;
  const who = e.actor ? (e.actor === me ? "Kamu" : (s.players[e.actor]?.name ?? "Warga")) : "";
  const name = (id: unknown) => (id === me ? "kamu" : (s.players[String(id)]?.name ?? "warga"));
  const tile = (i: unknown) => TILES[Number(i)]?.name ?? "petak";
  switch (e.type) {
    case "dadu":
      return `🎲 ${who} melempar ${(p.dadu as number[]).join(" + ")}`;
    case "gajian":
      return `💵 ${who} gajian ${dr(Number(p.gaji) + Number(p.omzet) - Number(p.iuran))}${Number(p.omzet) > 0 ? ` (omzet ${dr(p.omzet)})` : ""}`;
    case "beli":
      return p.rebut
        ? `🚩 ${who} merebut ${tile(p.tile)} dari Rezim!`
        : `🏪 ${who} buka lapak di ${tile(p.tile)} (${dr(p.harga)})`;
    case "tak_mampu_beli":
      return `😮‍💨 ${who} nggak sanggup beli ${tile(p.tile)}`;
    case "lewati_beli":
      return `${who} melewatkan ${tile(p.tile)}`;
    case "upgrade":
      return `🏗️ ${who} upgrade ${tile(p.tile)} jadi ${LEVEL_LABEL[Number(p.level)]}`;
    case "bayar_sewa":
      return `🤝 ${who} jajan di ${tile(p.tile)} milik ${name(p.ke)} (${dr(p.jumlah)})`;
    case "mampir_sendiri":
      return `🏪 ${who} mampir ke usaha sendiri, omzet ${dr(p.jumlah)}`;
    case "pungli":
      return p.alasan === "aset_rezim"
        ? `💸 ${who} kena pungli ${dr(p.jumlah)} di aset Rezim (${tile(p.tile)})`
        : `💸 ${who} bayar ${tile(p.tile)} ${dr(p.jumlah)} ke Rezim`;
    case "tip_ojol":
      return null;
    case "kartu":
      return `🎴 ${who} dapat kartu: ${p.judul}`;
    case "kena_tilang":
      return `🚓 ${who} kena tilang: ${ALASAN_TILANG[String(p.alasan)] ?? "apes"}`;
    case "masih_ditilang":
      return `🚓 ${who} masih ditahan${Number(p.sisa) > 0 ? ` (${p.sisa} giliran lagi)` : ", giliran depan bebas"}`;
    case "bebas_tilang":
      return `🕊️ ${who} bebas berkat dadu kembar`;
    case "bayar_denda":
      return `🧾 ${who} bayar denda ${dr(p.jumlah)}`;
    case "lewati_giliran":
      return `😵 ${who} melewatkan giliran`;
    case "titik_demo":
      return `✊ ${who} orasi di Titik Demo`;
    case "gotong_royong":
      return `🌾 Posko Gotong Royong: Lumbung +${dr(p.jumlah)}`;
    case "donasi_lumbung":
      return `🌾 ${who} menyumbang ${dr(p.jumlah)} ke Lumbung`;
    case "petisi":
      return `✍️ ${who} bikin petisi online`;
    case "liputan_media":
      return `📰 ${who} mendanai Liputan Media: Kekuasaan −${p.damage}`;
    case "demo_akbar":
      return `✊ DEMO AKBAR ke-${p.ke}! Kekuasaan Rezim −${p.damage}`;
    case "kampung_mandiri":
      return `🏘️ Kampung Mandiri! Satu warna dikuasai rakyat: Kekuasaan −${p.damage}`;
    case "rezim_panik":
      return "😡 REZIM PANIK: semua pungutan naik 1,5x";
    case "talangan":
      return `🌾 Lumbung menalangi ${name(e.actor)} ${dr(p.jumlah)}`;
    case "jual_rugi":
      return `📉 ${who} terpaksa jual ${tile(p.tile)} (${dr(p.dapat)})`;
    case "bangkrut":
      return `💀 ${who} bangkrut`;
    case "kebijakan":
      return `${p.jenis === "bencana" ? "🌋 Bencana" : "📜 Kebijakan"}: ${p.judul}`;
    case "rezim_caplok":
      return p.alasan === "gusur"
        ? `🚧 ${tile(p.tile)} milik ${name(p.dari)} digusur Rezim`
        : `🏴 Rezim mencaplok ${tile(p.tile)}`;
    case "rezim_upgrade":
      return `🏴 Aset Rezim di ${tile(p.tile)} makin besar`;
    case "rezim_bayar":
      return `🚘 Pejabat kepergok mampir di ${tile(p.tile)}: bayar ${dr(p.jumlah)} ke ${name(p.ke)}, Kekuasaan −${p.damage}`;
    case "usaha_rusak":
      return `🏚️ ${tile(p.tile)} milik ${name(e.actor)} rusak, turun jadi ${LEVEL_LABEL[Number(p.level)]}`;
    case "lumbung_disunat":
      return `✂️ Lumbung disunat ${dr(p.jumlah)}`;
    case "ronde_baru":
      return `🗓️ Ronde ${p.ronde}. Pemilu ${p.sisa} ronde lagi.`;
    default:
      return null;
  }
}

export function resultTitle(s: GameState, me: string): { title: string; sub: string; win: boolean } {
  const r = s.result;
  if (!r) return { title: "Selesai", sub: "", win: false };
  if (r.kind === "rakyat_menang") {
    return { title: "REZIM TUMBANG!", sub: `Rakyat menang di ronde ${s.round} lewat ${s.demoCount} Demo Akbar.`, win: true };
  }
  if (r.kind === "rakyat_kalah") {
    return r.reason === "pemilu"
      ? {
          title: "Rezim Menang Pemilu",
          sub: `Lagi-lagi. Padahal Kekuasaannya tinggal ${s.kekuasaan}. Dikit lagi!`,
          win: false,
        }
      : { title: "Rakyat Tumbang", sub: "Terlalu banyak warga bangkrut. Jaga Lumbung biar bisa saling nalangin.", win: false };
  }
  const win = r.winner === me;
  return {
    title: win ? "Kamu Juragan!" : `${s.players[r.winner]?.name ?? "Warga"} Jadi Juragan`,
    sub: "Harta terbanyak di akhir permainan.",
    win,
  };
}
