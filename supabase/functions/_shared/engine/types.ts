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
  /** isi tenaga jurus profesi: 0 sampai JURUS_PENUH */
  jurus: number;
  /** poin jasa melawan Rezim, penentu MVP */
  jasa: number;
  /** sudah memakai satu-satunya kesempatan menuduh buzzer */
  sudahTuduh?: boolean;
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

export type Phase = "awaiting_roll" | "awaiting_buy" | "awaiting_end" | "game_over";

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
  /** warga yang sudah terbukti bukan buzzer (lewat jejak atau tuduhan yang salah) */
  bersih: string[];
  /**
   * Bagian rahasia: siapa buzzer-nya dan sabotase yang sedang disiapkan.
   * Tidak pernah ditampilkan ke pemain sebelum game selesai.
   */
  rahasia: { buzzer: string | null; antre: number };
  /** grup warna yang sudah pernah jadi Kampung Mandiri */
  kampung: string[];
  phase: Phase;
  pendingTile: number | null;
  lastDice: [number, number] | null;
  doublesInRow: number;
  rollAgain: boolean;
  /** Petisi/Liputan sudah dipakai giliran ini */
  aksiDipakai: boolean;
  result: GameResult | null;
  /** event publik dari aksi terakhir, untuk animasi di klien */
  lastEvents: GameEvent[];
}

/** Tenaga lemparan dadu: menentukan kisaran jumlah mata dadu. */
export type Gaya = "pelan" | "sedang" | "kencang";

export type Action =
  | { type: "roll"; gaya?: Gaya }
  | { type: "jurus" }
  | { type: "sabotase" }
  | { type: "tuduh"; target: string }
  | { type: "buy" }
  | { type: "skip_buy" }
  | { type: "upgrade"; tile: number }
  | { type: "bayar_denda" }
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
