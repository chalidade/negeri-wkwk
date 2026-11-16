// Angka-angka keseimbangan game. Ubah di sini saat playtest, bukan di engine.
import type { Profession } from "./types.ts";

export const BOARD_SIZE = 40;
export const START_TILE = 0;
export const JAIL_TILE = 10;

export const START_CUAN = 1500;
export const MAX_ROUNDS = 30;

/** Tiap N ronde Meteran Inflasi naik satu tingkat. */
export const INFLASI_TIAP_RONDE = 3;
/** Kenaikan harga per tingkat inflasi (10%). */
export const INFLASI_PER_TINGKAT = 0.1;

/** Biaya hidup per pemain per ronde, sebelum inflasi. */
export const BIAYA_HIDUP = 40;

/** Gaji per ronde (dibayar di akhir ronde), sebelum inflasi. Kreator pakai dadu. */
export const GAJI: Record<Profession, number> = {
  buruh: 90,
  pedagang: 45,
  ojol: 35,
  kreator: 0,
  jurnalis: 65,
  mahasiswa: 45,
};
export const KREATOR_GAJI_PER_MATA_DADU = 17;
/** Bonus saat melewati petak Gajian Tanggal 25 (THR kecil). */
export const BONUS_LEWAT_GAJIAN = 100;
/** Ojol dapat penghasilan kecil setiap giliran. */
export const OJOL_PER_GILIRAN = 20;
/** Sewa usaha UMKM milik Pedagang dikali segini. */
export const PEDAGANG_BONUS_UMKM = 1.5;

/** Pengali sewa per level usaha: Lapak, Toko, Cabang, Brand Lokal. */
export const SEWA_PER_LEVEL = [1, 3, 6, 10];
export const MAX_LEVEL = 3;
/** Biaya upgrade = harga petak x angka ini. */
export const BIAYA_UPGRADE = 0.5;
/** Menguasai satu grup warna penuh menggandakan sewa level 0. */
export const BONUS_SATU_GRUP = 2;

export const SEWA_TRANSPORT_PER_UNIT = 25;
export const UTILITAS_PENGALI = 4;
export const UTILITAS_PENGALI_DUA = 10;

/** Bonus "Bangga Produk Lokal" dari bank, untuk penyewa dan pemilik. */
export const BANGGA_PRODUK_LOKAL = 0.05;

export const LAMA_TILANG = 2;
export const DENDA_TILANG = 50;
export const MAX_DADU_KEMBAR = 3;

/** OTT terjadi saat dadu kembar dan kecurigaan minimal segini. */
export const BATAS_OTT = 5;
export const DENDA_OTT = 200;

export const KESABARAN_AWAL = 100;
export const KESABARAN_SETELAH_DEMO = 60;
export const GERAKAN_MENANG = 100;
export const GERAKAN_DEMO = 20;
export const PENALTI_BANGKRUT = 20;
export const BATAS_BANGKRUT_KALAH = 2;

export const PETISI_BIAYA = 50;
export const PETISI_GERAKAN = 3;
export const LIPUTAN_BIAYA_LUMBUNG = 250;
export const LIPUTAN_GERAKAN = 8;
export const JURNALIS_BONUS_LIPUTAN = 3;
/**
 * Tiap akhir ronde Pemerintah meredam gerakan. Makin besar gerakannya,
 * makin keras Pemerintah menekan: peredaman = dasar + gerakan x faktor.
 */
export const GERAKAN_PELURUHAN_DASAR = 3;
export const GERAKAN_PELURUHAN_FAKTOR = 0.08;
export const DONASI_PER_SUARA = 100;

/** Siklus pemilu: tiap N ronde ada Musim Kampanye. */
export const SIKLUS_PEMILU = 8;

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

export function inflationMultiplier(level: number): number {
  return 1 + level * INFLASI_PER_TINGKAT;
}

export function scaled(amount: number, level: number): number {
  return Math.round(amount * inflationMultiplier(level));
}
