// Angka-angka keseimbangan game. Ubah di sini saat playtest, bukan di engine.
// Semua uang dalam DR (Duit Rakyat), skala rupiah.
import type { Profession } from "./types.ts";

export const BOARD_SIZE = 32;
export const START_TILE = 0;
export const JAIL_TILE = 8;

export const START_CUAN = 20_000_000;
/** Pemilu digelar setelah ronde ini. Kalau Rezim masih berkuasa, rakyat kalah. */
export const MAX_ROUNDS = 14;

/** Gaji tiap lewat petak Gajian. */
export const GAJI: Record<Profession, number> = {
  buruh: 3_000_000,
  pedagang: 2_000_000,
  ojol: 2_000_000,
  kreator: 2_000_000,
  jurnalis: 2_400_000,
  mahasiswa: 1_600_000,
};
/** Bagian gaji yang otomatis masuk Lumbung (iuran gotong royong). */
export const IURAN_LUMBUNG = 0.2;
/** Omzet per usaha tiap gajian, sebagai bagian dari harga, per level. */
export const OMZET = [0.08, 0.16, 0.28, 0.45];
/** Sewa saat orang lain (atau mobil pejabat) mampir, per level. */
export const SEWA = [0.15, 0.3, 0.55, 0.9];
export const MAX_LEVEL = 3;
/** Biaya upgrade = harga petak x angka ini. */
export const BIAYA_UPGRADE = 0.5;
/** Satu grup warna dikuasai rakyat: omzet & sewa dikali segini. */
export const BONUS_KAMPUNG = 2;
/** Pungli saat mendarat di aset Rezim, per level aset. */
export const PUNGLI_ASET = [0.25, 0.4, 0.6, 0.8];
/** Harga merebut aset dari Rezim = harga petak x angka ini. */
export const REBUT_PENGALI = 1.5;
/** Usaha yang terpaksa dijual hanya laku segini dari modalnya. */
export const JUAL_RUGI = 0.5;

// --- keahlian profesi
export const PEDAGANG_BONUS_OMZET = 1.5;
export const OJOL_TIP = 200_000;
export const KREATOR_PETISI = 1.8;
export const JURNALIS_BONUS_LIPUTAN = 3;
export const MAHASISWA_BONUS_DEMO = 2;

// --- dadu kendali: pemain memilih tenaga lemparan
export const GAYA_DADU: Record<string, [number, number]> = { pelan: [2, 5], sedang: [6, 8], kencang: [9, 12] };
/** Peluang lemparan benar-benar jatuh di kisaran yang dipilih. */
export const AKURASI_DADU = 0.75;

// --- jurus profesi: terisi satu tiap giliran sendiri
export const JURUS_PENUH = 4;
export const JURUS_AWAL = 2;
export const JURUS_SEMANGAT: Partial<Record<Profession, number>> = { buruh: 18, kreator: 12, mahasiswa: 22 };
export const JURUS_UANG = 1_500_000;
export const JURUS_DAMAGE = 7;

// --- babak (tingkat kesulitan Rezim)
export const MAX_BABAK = 10;
/** Pengali nyawa Rezim per babak. */
export const nyawaBabak = (level: number): number => 1 + 0.018 * (level - 1);
/** Pengali pungutan Rezim per babak. */
export const pungutanBabak = (level: number): number => 1 + 0.045 * (level - 1);

// --- izin usaha: jalur resmi vs uang pelicin
/** Jalur resmi: harga + biaya izin. */
export const IZIN_RESMI = 1.15;
/** Uang pelicin: lebih murah, tapi bisa kena OTT dan menyuburkan Rezim. */
export const HARGA_PELICIN = 0.85;
export const PELUANG_OTT = 0.25;
export const DENDA_OTT = 1_500_000;
/** Kekuasaan Rezim yang pulih tiap suap berhasil. */
export const PELICIN_REZIM = 2;

// --- pinjol: uang cepat, bunga mencekik
export const PINJOL_BUNGA_AWAL = 0.2;
export const PINJOL_BUNGA_RONDE = 0.1;
export const PINJOL_MAKS = 8_000_000;
/** Potongan otomatis tiap gajian selama masih punya utang. */
export const PINJOL_CICILAN = 1_000_000;
/** Utang segini atau lebih: debt collector meneror, lewati giliran. */
export const PINJOL_TEROR = 6_000_000;
export const SEMANGAT_BANTU = 3;

// --- buzzer: warga yang diam-diam dibayar Rezim
export const SABOTASE_SEMANGAT = 10;
export const SABOTASE_LUMBUNG = 0.3;
/** Peluang tiap sabotase meninggalkan jejak digital. */
export const PELUANG_JEJAK = 0.6;
/** Peluang jejak itu benar mengarah ke buzzer. Sisanya jejak palsu yang memfitnah warga lain. */
export const JEJAK_JUJUR = 0.55;
/** Peluang per ronde Rezim berhasil menyuap seorang warga (mulai ronde 2). */
export const PELUANG_REKRUT = 0.28;
export const BONGKAR_DAMAGE = 12;
export const BONGKAR_SEMANGAT = 20;
export const FITNAH_DENDA = 1_500_000;
export const FITNAH_SEMANGAT = 12;

export const LAMA_TILANG = 2;
export const DENDA_TILANG = 800_000;
export const MAX_DADU_KEMBAR = 3;

// --- Rezim
/** Nyawa Rezim tergantung jumlah warga: makin ramai, makin kuat Rezimnya. */
export const KEKUASAAN_AWAL: Record<number, number> = { 2: 74, 3: 106, 4: 132, 5: 163, 6: 192 };
/** Kekuasaan tinggal separuh: Rezim panik, semua pungutan dikali PANIK_PENGALI. */
export const PANIK_DI = 0.5;
export const PANIK_PENGALI = 1.5;
/** Kekuasaan yang hilang saat mobil pejabat mampir ke usaha rakyat, per level. */
export const REZIM_KENA = [2, 3, 5, 8];
export const REBUT_DAMAGE = 3;
export const KAMPUNG_DAMAGE = 6;

// --- Semangat Demo
export const SEMANGAT_PENUH = 100;
export const DEMO_DAMAGE = 14;
export const SEMANGAT_BELI = 4;
export const SEMANGAT_UPGRADE = 2;
export const SEMANGAT_PUNGLI = 3;
export const SEMANGAT_SEWA = 1;
export const SEMANGAT_KEBIJAKAN = 3;
export const SEMANGAT_TITIK_DEMO = 14;
export const SEMANGAT_PETISI = 10;
export const PENALTI_BANGKRUT_SEMANGAT = 30;

export const PETISI_BIAYA = 1_000_000;
export const LIPUTAN_BIAYA_LUMBUNG = 5_000_000;
export const LIPUTAN_DAMAGE = 6;
export const GOTONG_ROYONG = 2_000_000;

export const BATAS_BANGKRUT_KALAH = 2;

export const MIMPI = [
  "beli_rumah",
  "naik_haji",
  "nyekolahin_adik",
  "buka_cabang_ketiga",
  "pensiun_tenang",
  "nikah_tanpa_utang",
] as const;

/** Buzzer hanya dibagikan di awal kalau pemain minimal segini. */
export const MIN_PEMAIN_BUZZER = 5;

/** Bulatkan ke pecahan DR 50.000 terdekat supaya angkanya enak dibaca. */
export function bulat(n: number): number {
  return Math.round(n / 50_000) * 50_000;
}

// ---------------------------------------------------------------------------
// Kas Rezim, pengalihan isu, aparat
// ---------------------------------------------------------------------------

/** Kas Rezim sebanyak ini per warga = Rezim belanja (menghamburkan uang pajak). */
export const BELANJA_PER_WARGA = 1_250_000;
/** Baliho dan iklan pencitraan: kepercayaan publik (Kekuasaan) naik. */
export const BELANJA_CITRA = 3;
/** Studi banding ke luar negeri: uang habis, warga makin kesal (Semangat naik). */
export const BELANJA_KESAL = 6;
/** Bayar pasukan buzzer: Semangat turun; kalau ada buzzer aktif, Kekuasaan ikut naik. */
export const BELANJA_BUZZER_SEMANGAT = 8;
export const BELANJA_BUZZER_CITRA = 2;
/** Sabotase buzzer "poles citra": kepercayaan ke Rezim naik. */
export const SABOTASE_CITRA = 3;

/** Semangat setinggi ini di akhir ronde = Rezim mungkin melempar Pengalihan Isu. */
export const ISU_AMBANG = 70;
export const ISU_PELUANG = 0.5;
/** jeda minimal antar pengalihan isu, dalam ronde */
export const ISU_JEDA = 3;
/** Semangat yang hilang menurut Dadu Nasib: [tidak terkecoh, teralih, lupa semua] */
export const ISU_TURUN: [number, number, number] = [-5, 20, 35];

/** Aparat menghadang Demo Akbar. Dadu menentukan: [barikade jebol, ditahan, gas air mata]. */
export const APARAT_KALI: [number, number, number] = [1.3, 1, 0.6];
/** Barikade jebol: massa masih panas, Semangat tidak kembali ke nol. */
export const APARAT_SISA_SEMANGAT = 20;

// ---------------------------------------------------------------------------
// Mekanik bertahap
// ---------------------------------------------------------------------------

/** Mekanik yang baru terbuka di babak tertentu, supaya pemain baru tidak langsung kewalahan. */
export type Fitur = "pelicin" | "aparat" | "pinjol" | "buzzer" | "anggaran";
export const BABAK_FITUR: Record<Fitur, number> = { pelicin: 2, aparat: 2, pinjol: 3, buzzer: 3, anggaran: 4 };

/** Isi amplop saat Rezim menyuap seorang warga jadi buzzer. */
export const SUAP_JUMLAH = 4_000_000;
/** Bayaran buzzer tiap sabotasenya terlaksana. */
export const SUAP_GAJI = 500_000;
