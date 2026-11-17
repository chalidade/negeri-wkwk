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
  apply?(ctx: Ctx, playerId: string): void;
  /**
   * Dadu Nasib: hasil kartu ditentukan lemparan dua dadu.
   * [2-5 mujur, 6-8 lumayan, 9-12 apes]. Makin besar angkanya, makin rugi.
   */
  nasib?: [Tingkat, Tingkat, Tingkat];
}

export interface Tingkat {
  teks: string;
  apply(ctx: Ctx, playerId: string): void;
}

/** Jalankan efek kartu. Kartu Dadu Nasib melempar dadu dulu untuk menentukan tingkatnya. */
export function jalankanKartu(ctx: Ctx, card: CardDef, playerId: string): void {
  if (!card.nasib) return card.apply?.(ctx, playerId);
  const dadu: [number, number] = [ctx.rng.int(1, 6), ctx.rng.int(1, 6)];
  const jumlah = dadu[0] + dadu[1];
  const tingkat = jumlah <= 5 ? 0 : jumlah <= 8 ? 1 : 2;
  emit(ctx, {
    type: "dadu_nasib",
    ...(playerId ? { actor: playerId } : {}),
    payload: { id: card.id, dadu, tingkat, teks: card.nasib[tingkat].teks },
  });
  card.nasib[tingkat].apply(ctx, playerId);
}

const kosong = () => undefined;
/** Semua warga rugi (bukan pungutan Rezim). Lumbung menanggung separuhnya kalau `talang`. */
function semuaRugi(ctx: Ctx, jumlah: number, talang = false): void {
  for (const p of alivePlayers(ctx.s)) {
    if (ctx.s.phase === "game_over") return;
    if (talang && coop(ctx.s)) transfer(ctx, LUMBUNG, p.id, jumlah / 2);
    transfer(ctx, p.id, BANK, jumlah);
  }
}
/** Satu usaha bertingkat milik tiap warga rusak dan turun satu tingkat. */
function usahaRusak(ctx: Ctx): void {
  for (const p of alivePlayers(ctx.s)) {
    const milik = ctx.s.tiles.map((t, i) => ({ t, i })).filter((x) => x.t.owner === p.id && x.t.level > 0);
    if (milik.length === 0) continue;
    const kena = pickRandom(ctx.rng, milik);
    kena.t.level -= 1;
    emit(ctx, { type: "usaha_rusak", actor: p.id, payload: { tile: kena.i, level: kena.t.level } });
  }
}
const jumlahUsaha = (ctx: Ctx, id: string) => Math.max(1, ctx.s.tiles.filter((t) => t.owner === id).length);

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

/** Nilai sebuah usaha: harga petak ditambah separuh harga untuk tiap tingkat upgrade. */
const nilaiUsaha = (idx: number, level: number): number => (TILES[idx].price ?? 0) * (1 + 0.5 * level);

/** Usaha rakyat yang paling bernilai diambil alih Rezim, bangunannya utuh. `ganti` = porsi ganti rugi. */
function ambilAlih(ctx: Ctx, ganti: number): void {
  const s = ctx.s;
  let idx = -1;
  s.tiles.forEach((t, i) => {
    if (TILES[i].type !== "property" || !t.owner || !isRakyat(s, t.owner)) return;
    if (idx < 0 || nilaiUsaha(i, t.level) > nilaiUsaha(idx, s.tiles[idx].level)) idx = i;
  });
  if (idx < 0) return semuaBayar(ctx, () => 0.5 * JT);
  const dari = s.tiles[idx].owner!;
  const bayar = ganti > 0 ? transfer(ctx, BANK, dari, R.bulat(nilaiUsaha(idx, s.tiles[idx].level) * ganti)) : 0;
  s.tiles[idx].owner = GOV;
  emit(ctx, { type: "rezim_caplok", payload: { tile: idx, dari, alasan: "ambil_alih", ganti: bayar } });
  addSemangat(ctx, R.SEMANGAT_KEBIJAKAN * 2, "kebijakan");
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
    id: "ortu_sakit",
    judul: "Orang Tua Sakit",
    teks: "Generasi sandwich diuji lagi. Lempar Dadu Nasib.",
    baik: false,
    nasib: [
      { teks: "Cuma masuk angin, dikerok sembuh. Keluar DR 100 rb.", apply: (ctx, id) => void bayar(ctx, id, 0.1 * JT) },
      { teks: "Rawat jalan, obatnya nggak ditanggung. Bayar DR 900 rb.", apply: (ctx, id) => void bayar(ctx, id, 0.9 * JT) },
      {
        teks: "Opname seminggu. Bayar DR 2,5 jt dan lewati giliran berikutnya buat jaga di RS.",
        apply(ctx, id) {
          bayar(ctx, id, 2.5 * JT);
          const p = player(ctx.s, id);
          if (!p.bankrupt) p.skipNext = true;
        },
      },
    ],
  },
  {
    id: "wawancara_kerja",
    judul: "Panggilan Wawancara",
    teks: "Lamaran ke-47 akhirnya dibalas. Lempar Dadu Nasib.",
    baik: true,
    nasib: [
      { teks: "Diterima! Gaji pertama cair DR 2 jt.", apply: (ctx, id) => void dapat(ctx, id, 2 * JT) },
      { teks: "\"Nanti kami kabari.\" Ongkos jalan hangus DR 200 rb.", apply: (ctx, id) => void bayar(ctx, id, 0.2 * JT) },
      { teks: "Ternyata lowongan bodong. Ketipu \"biaya administrasi\" DR 1,2 jt.", apply: (ctx, id) => void bayar(ctx, id, 1.2 * JT) },
    ],
  },
  {
    id: "jualan_cfd",
    judul: "Jualan di Car Free Day",
    teks: "Modal nekat, gelar lapak. Lempar Dadu Nasib.",
    baik: true,
    nasib: [
      { teks: "Ludes sebelum jam 9! Untung DR 1,8 jt.", apply: (ctx, id) => void dapat(ctx, id, 1.8 * JT) },
      { teks: "Lumayan rame. Untung DR 700 rb.", apply: (ctx, id) => void dapat(ctx, id, 0.7 * JT) },
      { teks: "Hujan deras plus digusur petugas. Rugi DR 500 rb.", apply: (ctx, id) => void bayar(ctx, id, 0.5 * JT) },
    ],
  },
  {
    id: "cicilan_motor",
    judul: "Cicilan Motor Jatuh Tempo",
    teks: "Debt collector sudah nelpon. Lempar Dadu Nasib.",
    baik: false,
    nasib: [
      { teks: "Ada rezeki nomplok, cicilan lunas duluan. Cashback DR 300 rb.", apply: (ctx, id) => void dapat(ctx, id, 0.3 * JT) },
      { teks: "Bayar tepat waktu. Keluar DR 700 rb.", apply: (ctx, id) => void bayar(ctx, id, 0.7 * JT) },
      { teks: "Telat tiga bulan, kena denda dan biaya tarik. Bayar DR 1,6 jt.", apply: (ctx, id) => void bayar(ctx, id, 1.6 * JT) },
    ],
  },
  {
    id: "tes_cpns",
    judul: "Tes CPNS",
    teks: "Jutaan pelamar, segelintir kursi. Lempar Dadu Nasib.",
    baik: true,
    nasib: [
      { teks: "Lolos murni! Tunjangan cair DR 2,5 jt.", apply: (ctx, id) => void dapat(ctx, id, 2.5 * JT) },
      { teks: "Gagal di tahap akhir. Biaya bimbel DR 300 rb hangus.", apply: (ctx, id) => void bayar(ctx, id, 0.3 * JT) },
      { teks: "Kalah sama titipan. Keluar DR 900 rb buat coba lagi tahun depan.", apply: (ctx, id) => void bayar(ctx, id, 0.9 * JT) },
    ],
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
    id: "investasi_teman",
    judul: "Diajak Investasi Teman SMA",
    teks: "\"Profit 30% sebulan, dijamin.\" Lempar Dadu Nasib.",
    baik: false,
    nasib: [
      { teks: "Kamu curiga dan menolak. Uang aman, malah dapat traktiran DR 200 rb.", apply: (ctx, id) => void dapat(ctx, id, 0.2 * JT) },
      { teks: "Ikut sedikit, balik modal doang. Nggak untung, nggak rugi.", apply: kosong },
      { teks: "Bandarnya kabur ke luar negeri. Hilang DR 2 jt.", apply: (ctx, id) => void bayar(ctx, id, 2 * JT) },
    ],
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
    id: "pajak_dadakan",
    judul: "Tambal Defisit",
    teks: "Anggaran jebol gara-gara proyek dan perjalanan dinas. Solusinya: pajak baru. Lempar Dadu Nasib.",
    baik: false,
    meredam: true,
    nasib: [
      { teks: "Diprotes ramai-ramai sampai dibatalkan. Semangat Demo naik.", apply: (ctx) => addSemangat(ctx, 8, "pajak_batal") },
      {
        teks: "Lolos: semua warga bayar 5% dari uangnya (minimal DR 400 rb).",
        apply: (ctx) => {
          semuaBayar(ctx, (id) => Math.max(0.4 * JT, player(ctx.s, id).cuan * 0.05));
          addSemangat(ctx, R.SEMANGAT_KEBIJAKAN, "kebijakan");
        },
      },
      {
        teks: "Lolos, tarifnya dobel: semua warga bayar 10% dari uangnya (minimal DR 700 rb).",
        apply: (ctx) => {
          semuaBayar(ctx, (id) => Math.max(0.7 * JT, player(ctx.s, id).cuan * 0.1));
          addSemangat(ctx, R.SEMANGAT_KEBIJAKAN * 2, "kebijakan");
        },
      },
    ],
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
    id: "ambil_alih",
    judul: "Diambil Alih Negara",
    teks: "\"Demi kepentingan umum.\" Usaha warga yang paling mahal mau diambil alih. Lempar Dadu Nasib.",
    baik: false,
    meredam: true,
    nasib: [
      { teks: "Warga ramai-ramai menolak sampai batal. Semangat Demo naik.", apply: (ctx) => addSemangat(ctx, 8, "tolak_ambil_alih") },
      { teks: "Diambil alih, pemiliknya dapat ganti rugi separuh harga.", apply: (ctx) => ambilAlih(ctx, 0.5) },
      { teks: "Diambil alih tanpa ganti rugi sepeser pun.", apply: (ctx) => ambilAlih(ctx, 0) },
    ],
  },
  {
    id: "pajak_kekayaan",
    judul: "Pajak Orang Kaya",
    teks: "Makin tajir, makin besar pajaknya. Warga terkaya bayar 15% uangnya, berikutnya 10%, lalu 6%, sisanya 3%.",
    baik: false,
    apply(ctx) {
      // peringkat dari total harta (uang + nilai usaha); pajaknya dihitung dari uang tunai
      const harta = (id: string) =>
        player(ctx.s, id).cuan + ctx.s.tiles.reduce((n, t, i) => n + (t.owner === id ? nilaiUsaha(i, t.level) : 0), 0);
      const urut = [...alivePlayers(ctx.s)].sort((a, b) => harta(b.id) - harta(a.id));
      const tarif = [0.15, 0.1, 0.06];
      const daftar: { id: string; jumlah: number }[] = [];
      urut.forEach((p, i) => {
        if (ctx.s.phase === "game_over") return;
        daftar.push({ id: p.id, jumlah: pungut(ctx, p.id, Math.max(0.2 * JT, p.cuan * (tarif[i] ?? 0.03))) });
      });
      emit(ctx, { type: "pajak_kekayaan", payload: { daftar } });
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
    teks: "Hujan semalaman, sungai meluap. Lempar Dadu Nasib.",
    baik: false,
    meredam: true,
    jenis: "bencana",
    nasib: [
      { teks: "Cuma genangan. Besok pagi sudah kering.", apply: kosong },
      { teks: "Rumah kerendam: semua warga rugi DR 500 rb. Lumbung menanggung separuhnya.", apply: (ctx) => semuaRugi(ctx, 0.5 * JT, true) },
      {
        teks: "Banjir besar: semua warga rugi DR 1 jt (Lumbung menanggung separuh) dan satu usahanya turun tingkat.",
        apply(ctx) {
          semuaRugi(ctx, 1 * JT, true);
          usahaRusak(ctx);
        },
      },
    ],
  },
  {
    id: "gempa",
    judul: "Gempa Bumi",
    teks: "Lampu bergoyang, warga berhamburan. Lempar Dadu Nasib.",
    baik: false,
    meredam: true,
    jenis: "bencana",
    nasib: [
      { teks: "Cuma getaran kecil. Semua selamat.", apply: kosong },
      { teks: "Tembok retak: satu usaha tiap warga turun satu tingkat.", apply: (ctx) => usahaRusak(ctx) },
      {
        teks: "Gempa besar: satu usaha tiap warga turun tingkat, dan semua bayar perbaikan DR 700 rb.",
        apply(ctx) {
          usahaRusak(ctx);
          semuaRugi(ctx, 0.7 * JT);
        },
      },
    ],
  },
  {
    id: "kabut_asap",
    judul: "Kabut Asap",
    teks: "Lahan dibakar lagi. Lempar Dadu Nasib.",
    baik: false,
    meredam: true,
    jenis: "bencana",
    nasib: [
      { teks: "Angin berpihak, asapnya lewat begitu saja.", apply: kosong },
      { teks: "Sesak napas: semua warga bayar berobat DR 300 rb.", apply: (ctx) => semuaRugi(ctx, 0.3 * JT) },
      { teks: "ISPA massal, sekolah dan toko tutup: semua warga rugi DR 800 rb.", apply: (ctx) => semuaRugi(ctx, 0.8 * JT) },
    ],
  },
  {
    id: "gunung_meletus",
    judul: "Gunung Meletus",
    teks: "Status naik jadi Awas. Lempar Dadu Nasib.",
    baik: false,
    meredam: true,
    jenis: "bencana",
    nasib: [
      { teks: "Statusnya turun lagi. Warga batal mengungsi.", apply: kosong },
      { teks: "Hujan abu: semua warga rugi DR 400 rb. Lumbung menanggung separuhnya.", apply: (ctx) => semuaRugi(ctx, 0.4 * JT, true) },
      { teks: "Erupsi besar: semua warga rugi DR 900 rb. Lumbung menanggung separuhnya.", apply: (ctx) => semuaRugi(ctx, 0.9 * JT, true) },
    ],
  },
  {
    id: "phk_massal",
    judul: "Kabar PHK Massal",
    teks: "Pabrik kalah sama barang impor murah. Lempar Dadu Nasib.",
    baik: false,
    meredam: true,
    nasib: [
      { teks: "Pabriknya batal tutup. Semua bisa napas lega.", apply: kosong },
      { teks: "Jam kerja dipotong: semua warga kehilangan DR 500 rb.", apply: (ctx) => semuaRugi(ctx, 0.5 * JT) },
      {
        teks: "PHK besar-besaran: semua warga kehilangan DR 1 jt, buruh dua kali lipat. Warga marah: Semangat naik.",
        apply(ctx) {
          for (const p of alivePlayers(ctx.s)) {
            if (ctx.s.phase === "game_over") return;
            transfer(ctx, p.id, BANK, (p.profession === "buruh" ? 2 : 1) * JT);
          }
          addSemangat(ctx, 8, "phk_massal");
        },
      },
    ],
  },
  {
    id: "rupiah_melemah",
    judul: "Rupiah Melemah",
    teks: "Harga bahan baku impor ikut naik. Lempar Dadu Nasib.",
    baik: false,
    meredam: true,
    nasib: [
      { teks: "Cuma sebentar, kurs balik lagi. Aman.", apply: kosong },
      {
        teks: "Modal dagang naik: tiap warga bayar DR 200 rb per usaha.",
        apply(ctx) {
          for (const p of alivePlayers(ctx.s)) transfer(ctx, p.id, BANK, jumlahUsaha(ctx, p.id) * 0.2 * JT);
        },
      },
      {
        teks: "Harga meroket: tiap warga bayar DR 400 rb per usaha.",
        apply(ctx) {
          for (const p of alivePlayers(ctx.s)) transfer(ctx, p.id, BANK, jumlahUsaha(ctx, p.id) * 0.4 * JT);
        },
      },
    ],
  },
  {
    id: "harga_beras",
    judul: "Harga Beras Naik",
    teks: "Stok katanya aman, harga di pasar bilang lain. Lempar Dadu Nasib.",
    baik: false,
    nasib: [
      { teks: "Operasi pasar datang tepat waktu. Harga turun lagi.", apply: kosong },
      { teks: "Semua warga bayar lebih DR 400 rb.", apply: (ctx) => semuaBayar(ctx, () => 0.4 * JT) },
      { teks: "Beras langka sebulan: semua warga bayar DR 900 rb.", apply: (ctx) => semuaBayar(ctx, () => 0.9 * JT) },
    ],
  },
];

/**
 * Pengalihan Isu: bukan kartu acak. Rezim melemparnya kalau Semangat Demo sudah tinggi di akhir
 * ronde, menggantikan Kebijakan ronde itu. Dadu Nasib menentukan seberapa warga terkecoh.
 */
export const PENGALIHAN_ISU: CardDef = {
  id: "pengalihan_isu",
  judul: "Pengalihan Isu",
  teks: "Demo hampir pecah, tiba-tiba linimasa penuh skandal artis. Lempar Dadu Nasib.",
  baik: false,
  meredam: true,
  nasib: [
    { teks: "Warga nggak terkecoh, malah makin kesal. Semangat Demo naik.", apply: (ctx) => addSemangat(ctx, -R.ISU_TURUN[0], "isu_gagal") },
    { teks: `Linimasa teralih. Semangat Demo turun ${R.ISU_TURUN[1]}.`, apply: (ctx) => addSemangat(ctx, -R.ISU_TURUN[1], "pengalihan_isu") },
    { teks: `Semua sibuk bahas gosip. Semangat Demo turun ${R.ISU_TURUN[2]}.`, apply: (ctx) => addSemangat(ctx, -R.ISU_TURUN[2], "pengalihan_isu") },
  ],
};
