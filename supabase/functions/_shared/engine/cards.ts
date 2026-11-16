// Dek kartu: Nasib WNI, Grup WA Keluarga, dan Kebijakan Rezim.
// Tiap kartu punya teks untuk UI dan fungsi efek yang memodifikasi state.
import {
  BANK,
  LUMBUNG,
  TILES,
  type Ctx,
  addSemangat,
  alivePlayers,
  coop,
  emit,
  healRezim,
  pickRandom,
  isRakyat,
  player,
  pungut,
  sendToJail,
  transfer,
} from "./core.ts";
import * as R from "./rules.ts";
import { GOV } from "./types.ts";

export interface CardDef {
  id: string;
  judul: string;
  teks: string;
  /** true = kabar baik buat rakyat (warna hijau di UI) */
  baik: boolean;
  /** kartu akhir ronde yang tidak otomatis menambah Semangat (meredam, atau sudah diatur sendiri) */
  meredam?: boolean;
  /** kartu akhir ronde: "bencana" bukan ulah Rezim, tampil beda di UI */
  jenis?: "bencana";
  apply(ctx: Ctx, playerId: string): void;
}

const JT = 1_000_000;
const dapat = (ctx: Ctx, id: string, n: number) => transfer(ctx, BANK, id, n);
const bayar = (ctx: Ctx, id: string, n: number) => transfer(ctx, id, BANK, n);
/** Semua warga yang masih bertahan kena pungutan Rezim. */
function semuaBayar(ctx: Ctx, n: (id: string) => number): void {
  for (const p of alivePlayers(ctx.s)) {
    if (ctx.s.phase === "game_over") return;
    pungut(ctx, p.id, n(p.id));
  }
}

export const NASIB_WNI: CardDef[] = [
  {
    id: "umkm_viral",
    judul: "Daganganmu Viral!",
    teks: "Masuk FYP, orderan membludak. Dapat DR 1,5 jt dan Semangat Demo naik.",
    baik: true,
    apply(ctx, id) {
      dapat(ctx, id, 1.5 * JT);
      addSemangat(ctx, 6, "viral");
    },
  },
  {
    id: "bansos_cair",
    judul: "Bansos Cair",
    teks: "Kebetulan lagi musim kampanye. Dapat DR 1 jt.",
    baik: true,
    apply: (ctx, id) => void dapat(ctx, id, 1 * JT),
  },
  {
    id: "kerja_remote",
    judul: "Kerja Remote Gaji Dolar",
    teks: "Klien luar negeri bayar tepat waktu. Dapat DR 2,5 jt.",
    baik: true,
    apply: (ctx, id) => void dapat(ctx, id, 2.5 * JT),
  },
  {
    id: "thr_cair",
    judul: "THR Cair Penuh",
    teks: "Tumben nggak dicicil. Dapat bonus sebesar gajimu.",
    baik: true,
    apply: (ctx, id) => void dapat(ctx, id, R.GAJI[player(ctx.s, id).profession]),
  },
  {
    id: "kena_phk",
    judul: "Kena PHK",
    teks: "\"Efisiensi\", katanya. Kehilangan DR 1,5 jt.",
    baik: false,
    apply: (ctx, id) => void bayar(ctx, id, 1.5 * JT),
  },
  {
    id: "banjir_lagi",
    judul: "Banjir Lagi",
    teks: "Rumah kerendam, rugi DR 1,2 jt. Lumbung warga bantu DR 600 rb kalau ada.",
    baik: false,
    apply(ctx, id) {
      bayar(ctx, id, 1.2 * JT);
      if (coop(ctx.s)) transfer(ctx, LUMBUNG, id, 0.6 * JT);
    },
  },
  {
    id: "pinjol",
    judul: "Terjerat Pinjol",
    teks: "Bunganya beranak-pinak. Bayar DR 2 jt.",
    baik: false,
    apply: (ctx, id) => void bayar(ctx, id, 2 * JT),
  },
  {
    id: "jalan_berlubang",
    judul: "Jalan Berlubang",
    teks: "Ban pecah, velg penyok. Bayar bengkel DR 500 rb.",
    baik: false,
    apply: (ctx, id) => void bayar(ctx, id, 0.5 * JT),
  },
  {
    id: "orderan_rame",
    judul: "Orderan Rame",
    teks: "Tanggal muda, semua orang jajan. Dapat DR 1,2 jt.",
    baik: true,
    apply: (ctx, id) => void dapat(ctx, id, 1.2 * JT),
  },
  {
    id: "kirim_ortu",
    judul: "Kirim Uang ke Orang Tua",
    teks: "Generasi sandwich: gaji cuma numpang lewat. Transfer DR 1 jt.",
    baik: false,
    apply: (ctx, id) => void bayar(ctx, id, 1 * JT),
  },
  {
    id: "ukt_adik",
    judul: "UKT Adik Naik",
    teks: "Kuliah makin mahal, kamu yang nanggung. Bayar DR 1,5 jt.",
    baik: false,
    apply: (ctx, id) => void bayar(ctx, id, 1.5 * JT),
  },
  {
    id: "jatuh_sakit",
    judul: "Jatuh Sakit",
    teks: "Antre berobat dari subuh. Bayar obat DR 700 rb dan lewati giliran berikutnya.",
    baik: false,
    apply(ctx, id) {
      bayar(ctx, id, 0.7 * JT);
      const p = player(ctx.s, id);
      if (!p.bankrupt) p.skipNext = true;
    },
  },
  {
    id: "judol",
    judul: "Tergoda Judi Online",
    teks: "\"Kali ini pasti menang.\" Hilang DR 1,5 jt.",
    baik: false,
    apply: (ctx, id) => void bayar(ctx, id, 1.5 * JT),
  },
  {
    id: "kalah_ordal",
    judul: "Kalah Sama Orang Dalam",
    teks: "Lowongannya ternyata sudah ada yang punya. Biaya melamar hangus DR 400 rb.",
    baik: false,
    apply: (ctx, id) => void bayar(ctx, id, 0.4 * JT),
  },
  {
    id: "posting_kritik",
    judul: "Diciduk Gara-gara Posting",
    teks: "Kritikmu dianggap meresahkan. Kamu kena tilang, tapi warga makin marah: Semangat Demo naik.",
    baik: false,
    apply(ctx, id) {
      sendToJail(ctx, id, "posting_kritik");
      addSemangat(ctx, 12, "solidaritas");
    },
  },
];

export const GRUP_WA: CardDef[] = [
  {
    id: "arisan",
    judul: "Namamu Keluar di Arisan",
    teks: "Akhirnya giliranmu. Dapat DR 1,5 jt.",
    baik: true,
    apply: (ctx, id) => void dapat(ctx, id, 1.5 * JT),
  },
  {
    id: "transferan_ortu",
    judul: "Transferan dari Ortu",
    teks: "\"Buat jajan ya, Nak.\" Dapat DR 1 jt.",
    baik: true,
    apply: (ctx, id) => void dapat(ctx, id, 1 * JT),
  },
  {
    id: "ajakan_aksi",
    judul: "Ajakan Aksi Damai Viral",
    teks: "Broadcast-nya nyebar ke semua grup. Semangat Demo naik banyak.",
    baik: true,
    apply: (ctx, id) => {
      if (coop(ctx.s)) addSemangat(ctx, 14, "ajakan_aksi");
      else dapat(ctx, id, 0.5 * JT);
    },
  },
  {
    id: "patungan_warga",
    judul: "Patungan Warga",
    teks: "Semua warga nyumbang DR 300 rb ke Lumbung Bersama.",
    baik: true,
    apply(ctx) {
      for (const p of alivePlayers(ctx.s)) {
        if (p.cuan >= 0.3 * JT) transfer(ctx, p.id, coop(ctx.s) ? LUMBUNG : BANK, 0.3 * JT);
      }
    },
  },
  {
    id: "info_loker",
    judul: "Info Loker dari Grup Alumni",
    teks: "Proyekan sampingan beneran cair. Dapat DR 1,2 jt.",
    baik: true,
    apply: (ctx, id) => void dapat(ctx, id, 1.2 * JT),
  },
  {
    id: "tetangga_musibah",
    judul: "Tetangga Kena Musibah",
    teks: "Warga langsung gerak. Kamu nyumbang DR 400 rb ke Lumbung Bersama.",
    baik: true,
    apply(ctx, id) {
      if (player(ctx.s, id).cuan >= 0.4 * JT) transfer(ctx, id, coop(ctx.s) ? LUMBUNG : BANK, 0.4 * JT);
    },
  },
  {
    id: "sepupu_pinjam",
    judul: "Sepupu Pinjam Uang",
    teks: "\"Minggu depan diganti.\" Kita semua tahu akhirnya. Hilang DR 700 rb.",
    baik: false,
    apply: (ctx, id) => void bayar(ctx, id, 0.7 * JT),
  },
  {
    id: "kondangan",
    judul: "Undangan Kondangan",
    teks: "Sepupu jauh nikah. Amplop DR 600 rb.",
    baik: false,
    apply: (ctx, id) => void bayar(ctx, id, 0.6 * JT),
  },
  {
    id: "mlm",
    judul: "Tante Jualan MLM",
    teks: "Nggak enak nolak. Beli paket DR 800 rb.",
    baik: false,
    apply: (ctx, id) => void bayar(ctx, id, 0.8 * JT),
  },
  {
    id: "kapan_nikah",
    judul: "\"Kapan Nikah?\"",
    teks: "Kena mental di kumpul keluarga. Lewati giliran berikutnya.",
    baik: false,
    apply(ctx, id) {
      player(ctx.s, id).skipNext = true;
    },
  },
  {
    id: "hoax_om",
    judul: "Hoax Berantai dari Om",
    teks: "Satu grup jadi ribut sendiri.",
    baik: false,
    apply: (ctx, id) => {
      if (coop(ctx.s)) addSemangat(ctx, -10, "hoax");
      else bayar(ctx, id, 0.4 * JT);
    },
  },
];

/** Usaha rakyat level Lapak yang paling murah (target penggusuran). */
function lapakTermurah(ctx: Ctx): number {
  let idx = -1;
  ctx.s.tiles.forEach((t, i) => {
    if (!isRakyat(ctx.s, t.owner) || t.level > 0) return;
    if (idx < 0 || (TILES[i].price ?? 0) < (TILES[idx].price ?? 0)) idx = i;
  });
  return idx;
}

export const KEBIJAKAN: CardDef[] = [
  {
    id: "bbm_naik",
    judul: "Harga BBM Naik",
    teks: "\"Penyesuaian\", bukan kenaikan. Semua warga bayar DR 800 rb.",
    baik: false,
    apply: (ctx) => semuaBayar(ctx, () => 0.8 * JT),
  },
  {
    id: "ppn_naik",
    judul: "PPN Naik Lagi",
    teks: "Semua warga bayar 5% dari uangnya (minimal DR 400 rb).",
    baik: false,
    apply: (ctx) => semuaBayar(ctx, (id) => Math.max(0.4 * JT, player(ctx.s, id).cuan * 0.05)),
  },
  {
    id: "pajak_usaha",
    judul: "Pajak Usaha Kecil",
    teks: "Tiap warga bayar DR 300 rb per usaha yang dimiliki.",
    baik: false,
    apply: (ctx) =>
      semuaBayar(ctx, (id) => Math.max(1, ctx.s.tiles.filter((t) => t.owner === id).length) * 0.3 * JT),
  },
  {
    id: "subsidi_dicabut",
    judul: "Subsidi Dicabut",
    teks: "Listrik, gas, semua naik. Semua warga bayar DR 600 rb.",
    baik: false,
    apply: (ctx) => semuaBayar(ctx, () => 0.6 * JT),
  },
  {
    id: "pengalihan_isu",
    judul: "Pengalihan Isu",
    teks: "Tiba-tiba ada skandal artis. Semangat Demo turun.",
    baik: false,
    meredam: true,
    apply: (ctx) => {
      if (coop(ctx.s)) addSemangat(ctx, -10, "pengalihan_isu");
      else semuaBayar(ctx, () => 0.4 * JT);
    },
  },
  {
    id: "bansos_politik",
    judul: "Bagi-bagi Bansos",
    teks: "Semua warga dapat DR 500 rb. Tapi sebagian jadi lupa marah: Semangat Demo turun.",
    baik: true,
    meredam: true,
    apply(ctx) {
      for (const p of alivePlayers(ctx.s)) dapat(ctx, p.id, 0.5 * JT);
      addSemangat(ctx, -10, "bansos");
    },
  },
  {
    id: "penggusuran",
    judul: "Penggusuran",
    teks: "Lapak warga yang paling murah digusur jadi aset Rezim. Usaha yang sudah di-upgrade aman.",
    baik: false,
    apply(ctx) {
      const idx = lapakTermurah(ctx);
      if (idx < 0) return semuaBayar(ctx, () => 0.5 * JT);
      const dari = ctx.s.tiles[idx].owner;
      ctx.s.tiles[idx] = { owner: GOV, level: 0 };
      emit(ctx, { type: "rezim_caplok", payload: { tile: idx, dari, alasan: "gusur" } });
    },
  },
  {
    id: "proyek_mercusuar",
    judul: "Proyek Mercusuar",
    teks: "Rezim mencaplok petak kosong paling mahal buat proyek.",
    baik: false,
    apply(ctx) {
      let idx = -1;
      ctx.s.tiles.forEach((t, i) => {
        if (TILES[i].type !== "property" || t.owner !== null) return;
        if (idx < 0 || (TILES[i].price ?? 0) > (TILES[idx].price ?? 0)) idx = i;
      });
      if (idx < 0) return semuaBayar(ctx, () => 0.5 * JT);
      ctx.s.tiles[idx] = { owner: GOV, level: 0 };
      emit(ctx, { type: "rezim_caplok", payload: { tile: idx, dari: null, alasan: "proyek" } });
    },
  },
  {
    id: "razia",
    judul: "Razia Dadakan",
    teks: "Warga paling tajir \"diamankan\": kena tilang.",
    baik: false,
    apply(ctx) {
      const kaya = [...alivePlayers(ctx.s)].sort((a, b) => b.cuan - a.cuan)[0];
      if (kaya && kaya.jailTurns === 0) sendToJail(ctx, kaya.id, "razia");
    },
  },
  {
    id: "serangan_buzzer",
    judul: "Buzzer Dikerahkan",
    teks: "Tagar tandingan membanjiri linimasa. Semangat Demo turun banyak.",
    baik: false,
    meredam: true,
    apply: (ctx) => {
      if (coop(ctx.s)) addSemangat(ctx, -15, "buzzer");
      else semuaBayar(ctx, () => 0.4 * JT);
    },
  },
  {
    id: "ruu_kilat",
    judul: "RUU Kilat Tengah Malam",
    teks: "Disahkan waktu rakyat tidur. Rezim pulih 6 Kekuasaan, tapi warga makin marah: Semangat naik.",
    baik: false,
    meredam: true,
    apply(ctx) {
      healRezim(ctx, 6, "ruu_kilat");
      addSemangat(ctx, 10, "ruu_kilat");
    },
  },
  {
    id: "iuran_wajib",
    judul: "Iuran Wajib Baru",
    teks: "Namanya \"tabungan\", tapi nggak bisa diambil. Semua warga bayar DR 500 rb.",
    baik: false,
    apply: (ctx) => semuaBayar(ctx, () => 0.5 * JT),
  },
  {
    id: "gas_langka",
    judul: "Gas Melon Langka",
    teks: "Antre berjam-jam. Semua warga bayar DR 400 rb, pedagang dua kali lipat.",
    baik: false,
    apply: (ctx) => semuaBayar(ctx, (id) => (player(ctx.s, id).profession === "pedagang" ? 0.8 : 0.4) * JT),
  },
  {
    id: "rangkap_jabatan",
    judul: "Rangkap Jabatan",
    teks: "Pejabat merangkap komisaris. Semua aset Rezim naik satu tingkat.",
    baik: false,
    apply(ctx) {
      let ada = false;
      ctx.s.tiles.forEach((t, i) => {
        if (t.owner !== GOV || t.level >= R.MAX_LEVEL) return;
        t.level += 1;
        ada = true;
        emit(ctx, { type: "rezim_upgrade", payload: { tile: i, level: t.level } });
      });
      if (!ada) semuaBayar(ctx, () => 0.4 * JT);
    },
  },
  {
    id: "aktivis_diamankan",
    judul: "Aktivis \"Diamankan\"",
    teks: "Satu warga yang vokal mendadak dijemput aparat: kena tilang. Warga lain bersolidaritas, Semangat naik.",
    baik: false,
    meredam: true,
    apply(ctx) {
      const bebas = alivePlayers(ctx.s).filter((p) => p.jailTurns === 0);
      if (bebas.length > 0) sendToJail(ctx, pickRandom(ctx.rng, bebas).id, "diamankan");
      addSemangat(ctx, 10, "solidaritas");
    },
  },
  {
    id: "dana_disunat",
    judul: "Dana Bantuan Disunat",
    teks: "Katanya buat \"biaya administrasi\". Lumbung Bersama berkurang 30%.",
    baik: false,
    apply(ctx) {
      const potong = R.bulat(ctx.s.lumbung * 0.3);
      if (potong <= 0) return semuaBayar(ctx, () => 0.3 * JT);
      transfer(ctx, LUMBUNG, GOV, potong);
      emit(ctx, { type: "lumbung_disunat", payload: { jumlah: potong } });
    },
  },
  {
    id: "banjir_bandang",
    judul: "Banjir Bandang",
    teks: "Semua warga rugi DR 600 rb. Lumbung Bersama menanggung separuhnya selama dananya ada.",
    baik: false,
    meredam: true,
    jenis: "bencana",
    apply(ctx) {
      for (const p of alivePlayers(ctx.s)) {
        if (ctx.s.phase === "game_over") return;
        if (coop(ctx.s)) transfer(ctx, LUMBUNG, p.id, 0.3 * JT);
        bayar(ctx, p.id, 0.6 * JT);
      }
    },
  },
  {
    id: "gempa",
    judul: "Gempa Bumi",
    teks: "Tiap warga: satu usahanya rusak dan turun satu tingkat. Yang belum punya bangunan bertingkat bayar DR 300 rb.",
    baik: false,
    meredam: true,
    jenis: "bencana",
    apply(ctx) {
      for (const p of alivePlayers(ctx.s)) {
        if (ctx.s.phase === "game_over") return;
        const milik = ctx.s.tiles.map((t, i) => ({ t, i })).filter((x) => x.t.owner === p.id && x.t.level > 0);
        if (milik.length === 0) {
          bayar(ctx, p.id, 0.3 * JT);
          continue;
        }
        const kena = pickRandom(ctx.rng, milik);
        kena.t.level -= 1;
        emit(ctx, { type: "usaha_rusak", actor: p.id, payload: { tile: kena.i, level: kena.t.level } });
      }
    },
  },
  {
    id: "kabut_asap",
    judul: "Kabut Asap",
    teks: "Lahan dibakar lagi, semua sesak napas. Tiap warga bayar berobat DR 400 rb.",
    baik: false,
    meredam: true,
    jenis: "bencana",
    apply(ctx) {
      for (const p of alivePlayers(ctx.s)) {
        if (ctx.s.phase === "game_over") return;
        bayar(ctx, p.id, 0.4 * JT);
      }
    },
  },
];
