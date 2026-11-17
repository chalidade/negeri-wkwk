// Tipe data inti Negeri Wkwk v2. Dipakai bersama oleh Edge Functions (Deno),
// klien web (Vite), dan unit test (Node). Hindari fitur TS yang butuh transpile.

export type Profession = "buruh" | "pedagang" | "ojol" | "kreator" | "jurnalis" | "mahasiswa";

export const PROFESSIONS: readonly Profession[] = [
  "buruh",
  "pedagang",
  "ojol",
  "kreator",
  "jurnalis",
  "mahasiswa",
];

export type Mode = "rakyat_bersatu" | "juragan";

export type TileType =
  | "start"
  | "property"
  | "card_wa"
  | "card_nasib"
  | "tax"
  | "jail"
  | "go_to_jail"
  | "gov_seat"
  | "demo"
  | "lumbung";

export interface TileDef {
  index: number;
  name: string;
  type: TileType;
  group?: string;
  /** harga beli usaha, dalam DR */
  price?: number;
  /** pungutan tetap untuk petak pajak / kursi pejabat, dalam DR */
  amount?: number;
}

/** Pemilik khusus untuk petak milik Rezim (Big Boss). */
export const GOV = "pemerintah";

export interface PlayerState {
  id: string;
  name: string;
  seat: number;
  profession: Profession;
  position: number;
  /** uang pemain dalam DR (Duit Rakyat) */
  cuan: number;
  jailTurns: number;
  skipNext: boolean;
  bankrupt: boolean;
  /** sisa utang pinjol, sudah termasuk bunga */
  utang: number;
  /** isi tenaga jurus profesi: 0 sampai JURUS_PENUH */
  jurus: number;
  /** poin jasa melawan Rezim, penentu MVP */
  jasa: number;
  /** sudah memakai satu-satunya kesempatan memanggil Sidang Warga */
  sudahSidang?: boolean;
  /** diusir lewat Sidang Warga (keluar dari permainan) */
  diusir?: boolean;
  /** buzzer yang sudah terbongkar (diketahui semua orang) */
  buzzer?: boolean;
  /** true kalau pemain ini dijalankan komputer */
  bot?: boolean;
}

export interface TileState {
  /** null = kosong, GOV = dicaplok Rezim, selain itu id pemain */
  owner: string | null;
  /** 0 Lapak, 1 Toko, 2 Cabang, 3 Brand Lokal */
  level: number;
}

export type Phase = "awaiting_roll" | "awaiting_buy" | "awaiting_end" | "voting" | "game_over";

/** Sidang Warga yang sedang berlangsung: semua warga memilih siapa yang diusir. */
export interface Sidang {
  pemanggil: string;
  /** id pemilih -> id yang dipilih ("" = abstain). Dibuka ke semua orang saat sidang selesai. */
  suara: Record<string, string>;
  /** fase yang dilanjutkan setelah sidang selesai */
  kembali: Phase;
}

export type GameResult =
  | { kind: "rakyat_menang" }
  | { kind: "rakyat_kalah"; reason: "bangkrut" | "pemilu" }
  | { kind: "juragan_menang"; winner: string };

export interface GameState {
  schema: 3;
  roomId: string;
  mode: Mode;
  /** babak / tingkat kesulitan Rezim, mulai dari 1 */
  level: number;
  round: number;
  maxRounds: number;
  /** urutan id pemain berdasarkan kursi */
  order: string[];
  /** index ke `order` untuk pemain yang sedang jalan */
  turn: number;
  players: Record<string, PlayerState>;
  tiles: TileState[];
  /** nyawa Rezim. Habis = rakyat menang. */
  kekuasaan: number;
  kekuasaanMaks: number;
  /** meter Semangat Demo: 0 -> 100. Penuh = Demo Akbar. */
  semangat: number;
  demoCount: number;
  /** dana talangan bersama, dalam DR */
  lumbung: number;
  /** posisi mobil pejabat (pion Rezim) */
  rezimPos: number;
  /** warga yang sudah terbukti bukan buzzer (karena pernah salah dituduh) */
  bersih: string[];
  /** berapa kali jejak digital mengarah ke tiap warga. Jejak bisa dipalsukan, jadi ini bukan bukti. */
  jejak: Record<string, number>;
  /**
   * Bagian rahasia: siapa buzzer-nya dan sabotase yang sedang disiapkan.
   * Tidak pernah ditampilkan ke pemain sebelum game selesai.
   */
  rahasia: {
    buzzer: string | null;
    antre: number;
    /** Rezim masih mencari warga untuk disuap di tengah permainan */
    rekrut: boolean;
  };
  /** grup warna yang sudah pernah jadi Kampung Mandiri */
  kampung: string[];
  /** semua mekanik aktif tanpa melihat babak (room online) */
  lengkap?: boolean;
  /** Kas Rezim: semua pungutan dari warga terkumpul di sini, lalu dihambur-hamburkan */
  kas?: number;
  /** ronde terakhir Rezim melempar Pengalihan Isu */
  isu?: number;
  phase: Phase;
  sidang: Sidang | null;
  pendingTile: number | null;
  lastDice: [number, number] | null;
  doublesInRow: number;
  rollAgain: boolean;
  /** Petisi/Liputan sudah dipakai giliran ini */
  aksiDipakai: boolean;
  /** sudah membantu warga lain giliran ini (bonus Semangat hanya sekali per giliran) */
  sudahBantu: boolean;
  result: GameResult | null;
  /** event publik dari aksi terakhir, untuk animasi di klien */
  lastEvents: GameEvent[];
}

/** Tenaga lemparan dadu: menentukan kisaran jumlah mata dadu. */
export type Gaya = "pelan" | "sedang" | "kencang";

/** Cara mengurus izin: resmi (mahal, aman) atau uang pelicin (murah, bisa kena OTT). */
export type Jalur = "resmi" | "pelicin";

export type Action =
  | { type: "roll"; gaya?: Gaya }
  | { type: "pinjol"; amount: number }
  | { type: "bayar_utang"; amount: number }
  | { type: "bantu"; target: string; amount: number }
  | { type: "jurus" }
  | { type: "sabotase" }
  | { type: "sidang" }
  | { type: "vote"; target: string | null }
  | { type: "buy"; jalur?: Jalur }
  | { type: "skip_buy" }
  | { type: "upgrade"; tile: number; jalur?: Jalur }
  | { type: "bayar_denda"; jalur?: Jalur }
  | { type: "donasi_lumbung"; amount: number }
  | { type: "petisi" }
  | { type: "liputan_media" }
  | { type: "end_turn" };

export interface GameEvent {
  type: string;
  actor?: string;
  payload: Record<string, unknown>;
  /** isi untuk event rahasia: hanya pemain ini yang bisa membaca */
  visibleTo?: string;
}

export interface Rng {
  /** bilangan bulat acak dari min sampai max (inklusif) */
  int(min: number, max: number): number;
}

export class GameError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "GameError";
  }
}

export interface MemberInput {
  id: string;
  name: string;
  seat: number;
  profession: Profession | null;
  bot?: boolean;
}

export interface PlayerSecret {
  userId: string;
  role: "rakyat" | "buzzer";
  mimpi: string;
}
