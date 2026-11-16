// Angka-angka keseimbangan game. Ubah di sini saat playtest, bukan di engine.
// Semua uang dalam DR (Duit Rakyat), skala rupiah.
import type { Profession } from "./types.ts";

export const BOARD_SIZE = 32;
export const START_TILE = 0;
export const JAIL_TILE = 8;

export const START_CUAN = 20_000_000;
/** Pemilu digelar setelah ronde ini. Kalau Rezim masih berkuasa, rakyat kalah. */
export const MAX_ROUNDS = 20;

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

export const LAMA_TILANG = 2;
export const DENDA_TILANG = 800_000;
export const MAX_DADU_KEMBAR = 3;

// --- Rezim
/** Nyawa Rezim tergantung jumlah warga: makin ramai, makin kuat Rezimnya. */
export const KEKUASAAN_AWAL: Record<number, number> = { 2: 66, 3: 95, 4: 120, 5: 150, 6: 180 };
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
export const SEMANGAT_TITIK_DEMO = 20;
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
