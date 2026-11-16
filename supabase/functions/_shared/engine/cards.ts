// Dek kartu: Nasib WNI, Grup WA Keluarga, dan Kebijakan Pemerintah.
// Tiap kartu punya teks untuk UI dan fungsi efek yang memodifikasi state.
import {
  BANK,
  type Ctx,
  alivePlayers,
  changeGerakan,
  changeKesabaran,
  emit,
  groupTiles,
  mult,
  pickRandom,
  player,
  transfer,
  TILES,
} from "./core.ts";
import { GOV as GOV_PARTY } from "./types.ts";

export interface CardDef {
  id: string;
  judul: string;
  teks: string;
  apply(ctx: Ctx, playerId: string): void;
}

const PROPERTY_GROUPS = [...new Set(TILES.filter((t) => t.group).map((t) => t.group!))];

function disableRandomGroup(ctx: Ctx): string {
  const group = pickRandom(ctx.rng, PROPERTY_GROUPS);
  for (const idx of groupTiles(group)) {
    ctx.s.tiles[idx].disabledUntilRound = ctx.s.round + 1;
  }
  return group;
}

export const NASIB_WNI: CardDef[] = [
  {
    id: "phk_massal",
    judul: "PHK Massal",
    teks: "Buruh: gaji berhenti 2 ronde. Profesi lain ikut kena imbas, bayar 50 Cuan.",
    apply(ctx, id) {
      const p = player(ctx.s, id);
      if (p.profession === "buruh") p.phkUntilRound = ctx.s.round + 2;
      else transfer(ctx, id, BANK, 50 * mult(ctx.s));
    },
  },
  {
    id: "kurs_anjlok",
    judul: "Kurs Anjlok",
    teks: "Meteran Inflasi langsung naik satu tingkat.",
    apply(ctx) {
      ctx.s.inflationLevel += 1;
    },
  },
  {
    id: "uang_pelicin",
    judul: "Lolos Seleksi, Tapi…",
    teks: "Bayar uang pelicin 100 Cuan ke Pemerintah.",
    apply(ctx, id) {
      transfer(ctx, id, GOV_PARTY, 100 * mult(ctx.s));
    },
  },
  {
    id: "banjir_lagi",
    judul: "Banjir Lagi",
    teks: "Satu grup properti acak tidak bisa menagih sewa sampai ronde depan.",
    apply(ctx) {
      const group = disableRandomGroup(ctx);
      emit(ctx, { type: "bencana", payload: { grup: group } });
    },
  },
  {
    id: "umkm_viral",
    judul: "Produk UMKM Viral",
    teks: "Semua pemilik usaha UMKM dapat 30 Cuan per usaha.",
    apply(ctx) {
      ctx.s.tiles.forEach((t, idx) => {
        if (TILES[idx].umkm && t.owner && ctx.s.players[t.owner]) {
          transfer(ctx, BANK, t.owner, 30 * mult(ctx.s));
        }
      });
    },
  },
  {
    id: "bansos_cair",
    judul: "Bansos Cair",
    teks: "Pemain dengan Cuan di bawah 500 dapat 100. Kelas menengah cuma nonton.",
    apply(ctx) {
      for (const p of alivePlayers(ctx.s)) {
        if (p.cuan < 500) transfer(ctx, GOV_PARTY, p.id, 100);
      }
    },
  },
  {
    id: "lowongan_dolar",
    judul: "Lowongan Gaji Dolar",
    teks: "Ternyata sindikat scam. Bayar tebusan 150 Cuan. Tips: cek lowongan di situs resmi.",
    apply(ctx, id) {
      transfer(ctx, id, BANK, 150 * mult(ctx.s));
    },
  },
];

export const GRUP_WA: CardDef[] = [
  {
    id: "kondangan",
    judul: "Undangan Kondangan Sepupu",
    teks: "Kasih amplop 50 Cuan ke pemain berikutnya.",
    apply(ctx, id) {
      const alive = alivePlayers(ctx.s);
      const i = alive.findIndex((p) => p.id === id);
      const next = alive[(i + 1) % alive.length];
      if (next && next.id !== id) transfer(ctx, id, next.id, 50 * mult(ctx.s));
    },
  },
  {
    id: "arisan",
    judul: "Namamu Keluar di Arisan",
    teks: "Ambil 20 Cuan dari tiap pemain lain.",
    apply(ctx, id) {
      for (const p of alivePlayers(ctx.s)) {
        if (p.id !== id) transfer(ctx, p.id, id, 20 * mult(ctx.s));
      }
    },
  },
  {
    id: "kapan_nikah",
    judul: "\"Kapan Nikah?\"",
    teks: "Malu ditanya. Lewati giliran berikutnya.",
    apply(ctx, id) {
      player(ctx.s, id).skipNext = true;
    },
  },
  {
    id: "mlm",
    judul: "Tante Jualan Produk MLM",
    teks: "Terpaksa beli. Bayar 80 Cuan.",
    apply(ctx, id) {
      transfer(ctx, id, BANK, 80 * mult(ctx.s));
    },
  },
  {
    id: "om_ordal",
    judul: "Om Punya Kenalan di Dalam",
    teks: "Dapat 1 kartu Ordal.",
    apply(ctx, id) {
      player(ctx.s, id).ordal += 1;
    },
  },
  {
    id: "paman_proyek",
    judul: "Paman Dapat Proyek",
    teks: "Dapat 150 Cuan, tapi Meter Kecurigaan naik 2.",
    apply(ctx, id) {
      transfer(ctx, BANK, id, 150 * mult(ctx.s));
      player(ctx.s, id).kecurigaan += 2;
    },
  },
  {
    id: "stiker_pagi",
    judul: "Stiker \"Selamat Pagi\" Bunga",
    teks: "Nggak ada efek. Cuma bikin HP penuh.",
    apply() {},
  },
];

/** Kartu Kebijakan diambil Pemerintah di akhir tiap ronde. */
export const KEBIJAKAN: CardDef[] = [
  {
    id: "bbm_naik",
    judul: "Penyesuaian Harga BBM",
    teks: "Semua pemain bayar 30 Cuan. Ojol bayar dua kali lipat.",
    apply(ctx) {
      for (const p of alivePlayers(ctx.s)) {
        const base = p.profession === "ojol" ? 60 : 30;
        transfer(ctx, p.id, GOV_PARTY, base * mult(ctx.s));
      }
      changeKesabaran(ctx, -10);
    },
  },
  {
    id: "iuran_wajib",
    judul: "Iuran Wajib Baru",
    teks: "Semua pemain bayar 40 Cuan untuk iuran yang manfaatnya belum jelas.",
    apply(ctx) {
      for (const p of alivePlayers(ctx.s)) transfer(ctx, p.id, GOV_PARTY, 40 * mult(ctx.s));
      changeKesabaran(ctx, -10);
    },
  },
  {
    id: "efisiensi_anggaran",
    judul: "Efisiensi Anggaran",
    teks: "Seperempat isi Lumbung Bersama ditarik Pemerintah.",
    apply(ctx) {
      transfer(ctx, "lumbung", GOV_PARTY, Math.floor(ctx.s.lumbung / 4));
      changeKesabaran(ctx, -10);
    },
  },
  {
    id: "ppn_naik",
    judul: "Kenaikan PPN",
    teks: "Meteran Inflasi naik satu tingkat.",
    apply(ctx) {
      ctx.s.inflationLevel += 1;
      changeKesabaran(ctx, -15);
    },
  },
  {
    id: "proyek_mercusuar",
    judul: "Proyek Mercusuar",
    teks: "Satu usaha milik pemain digusur. Pemiliknya dapat ganti rugi setengah harga.",
    apply(ctx) {
      const owned = ctx.s.tiles
        .map((t, idx) => ({ t, idx }))
        .filter(({ t, idx }) => TILES[idx].type === "property" && t.owner && ctx.s.players[t.owner]);
      if (owned.length === 0) return;
      const { t, idx } = pickRandom(ctx.rng, owned);
      const owner = t.owner!;
      t.owner = null;
      t.level = 0;
      transfer(ctx, GOV_PARTY, owner, (TILES[idx].price ?? 0) / 2);
      emit(ctx, { type: "digusur", actor: owner, payload: { tile: idx } });
      changeKesabaran(ctx, -15);
    },
  },
  {
    id: "pengalihan_isu",
    judul: "Pengalihan Isu",
    teks: "Meter Gerakan Rakyat turun 10.",
    apply(ctx) {
      changeGerakan(ctx, -10, "pengalihan_isu");
      changeKesabaran(ctx, -5);
    },
  },
];
