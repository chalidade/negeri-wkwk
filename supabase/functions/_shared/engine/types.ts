// Tipe data inti Negeri Wkwk. File ini dipakai bersama oleh Edge Functions (Deno)
// dan unit test (Node). Hindari fitur TS yang butuh transpile (enum, namespace).

export type Profession =
  | "buruh"
  | "pedagang"
  | "ojol"
  | "kreator"
  | "jurnalis"
  | "mahasiswa";

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
  | "transport"
  | "utility"
  | "card_wa"
  | "card_nasib"
  | "tax"
  | "jail"
  | "posko"
  | "go_to_jail"
  | "gov_seat";

export interface TileDef {
  index: number;
  name: string;
  type: TileType;
  group?: string;
  price?: number;
  rent?: number;
  amount?: number;
  umkm?: boolean;
  random?: boolean;
}

/** Pemilik khusus untuk petak milik Pemerintah (Big Boss). */
export const GOV = "pemerintah";

export interface PlayerState {
  id: string;
  name: string;
  seat: number;
  profession: Profession;
  position: number;
  cuan: number;
  tabungan: number;
  kecurigaan: number;
  jailTurns: number;
  skipNext: boolean;
  bankrupt: boolean;
  suaraRakyat: number;
  ordal: number;
  phkUntilRound: number;
}

export interface TileState {
  /** null = belum dimiliki, GOV = milik Pemerintah, selain itu id pemain */
  owner: string | null;
  /** 0 Lapak, 1 Toko, 2 Cabang, 3 Brand Lokal */
  level: number;
  /** Sewa tidak bisa ditagih sampai ronde ini (efek bencana) */
  disabledUntilRound: number;
}

export type Phase = "awaiting_roll" | "awaiting_buy" | "awaiting_end" | "game_over";

export type GameResult =
  | { kind: "rakyat_menang" }
  | { kind: "rakyat_kalah"; reason: "dua_bangkrut" | "waktu_habis" }
  | { kind: "juragan_menang"; winner: string };

export interface GameState {
  schema: 1;
  roomId: string;
  mode: Mode;
  round: number;
  maxRounds: number;
  /** urutan id pemain berdasarkan kursi */
  order: string[];
  /** index ke `order` untuk pemain yang sedang jalan */
  turn: number;
  players: Record<string, PlayerState>;
  tiles: TileState[];
  inflationLevel: number;
  gerakan: number;
  kesabaran: number;
  lumbung: number;
  kasPemerintah: number;
  phase: Phase;
  pendingTile: number | null;
  lastDice: [number, number] | null;
  doublesInRow: number;
  rollAgain: boolean;
  aksiDipakai: boolean;
  result: GameResult | null;
}

export type Action =
  | { type: "roll" }
  | { type: "buy" }
  | { type: "skip_buy" }
  | { type: "upgrade"; tile: number }
  | { type: "bayar_denda" }
  | { type: "setor_tabungan"; amount: number }
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
}

export interface PlayerSecret {
  userId: string;
  role: "rakyat" | "buzzer";
  mimpi: string;
}
