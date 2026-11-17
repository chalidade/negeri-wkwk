// "Driver" permainan: sumber state untuk layar game.
// - Solo: aturan dijalankan langsung di perangkat (instan, tanpa internet), disimpan di localStorage.
// - Online: aturan dijalankan server (Edge Function), state datang lewat realtime.
import { ApiError, type GameRow } from "./errors.ts";
import {
  BOT_NAMES,
  GameError,
  PROFESSIONS,
  applyAction,
  createInitialState,
  cryptoRng,
  decideBotAction,
  type Action,
  type Mode,
  type Profession,
} from "./shared.ts";

export type Role = "rakyat" | "buzzer";

export interface Driver {
  readonly local: boolean;
  readonly me: string;
  current(): GameRow;
  send(action: Action): Promise<void>;
  /** Jalankan satu aksi untuk bot yang sedang giliran. */
  botStep(): Promise<void>;
  subscribe(cb: (row: GameRow) => void): () => void;
  role(): Role;
  /** Buang simpanan saat permainan selesai atau ditinggalkan. */
  forget(): void;
  /** Main bareng: keterangan kalau sambungan sedang bermasalah, atau null kalau lancar. */
  gangguan?(): string | null;
}

// ------------------------------------------------------------------ solo

const SOLO_KEY = "wkwk.solo.v6";
interface SoloSave extends GameRow {
  roles: Record<string, Role>;
}

function loadSolo(): SoloSave | null {
  try {
    const raw = localStorage.getItem(SOLO_KEY);
    const save = raw ? (JSON.parse(raw) as SoloSave) : null;
    return save && save.state?.schema === 3 && save.state.jejak && save.state.rahasia && "sidang" in save.state && save.state.phase !== "game_over" ? save : null;
  } catch {
    return null;
  }
}

export const hasSoloSave = (): boolean => loadSolo() !== null;

function shuffled<T>(items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = cryptoRng.int(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function soloDriver(save: SoloSave): Driver {
  const me = "kamu";
  const subs = new Set<(row: GameRow) => void>();
  const commit = (actor: string, action: Action) => {
    try {
      const { state } = applyAction(save.state, actor, action, cryptoRng);
      save = { ...save, state, version: save.version + 1 };
    } catch (e) {
      if (e instanceof GameError) throw new ApiError(e.message, e.code);
      throw e;
    }
    try {
      localStorage.setItem(SOLO_KEY, JSON.stringify(save));
    } catch {
      /* penyimpanan penuh/terblokir: lanjut tanpa simpan */
    }
    const row = { version: save.version, state: save.state };
    subs.forEach((cb) => cb(row));
  };
  return {
    local: true,
    me,
    current: () => ({ version: save.version, state: save.state }),
    send: async (action) => commit(me, action),
    botStep: async () => {
      const s = save.state;
      const id = s.order[s.turn];
      if (s.phase === "game_over" || s.phase === "voting" || !s.players[id]?.bot) return;
      commit(id, decideBotAction(s, id, save.roles[id]));
    },
    subscribe(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    role: () => save.roles[me] ?? "rakyat",
    forget: () => localStorage.removeItem(SOLO_KEY),
  };
}

export function newSoloGame(name: string, profession: Profession | null, mode: Mode, bots = 3, level = 1): Driver {
  const mine = profession ?? PROFESSIONS[cryptoRng.int(0, PROFESSIONS.length - 1)];
  const others = shuffled(PROFESSIONS.filter((p) => p !== mine));
  const names = shuffled(BOT_NAMES);
  const members = [
    { id: "kamu", name, seat: 0, profession: mine },
    ...Array.from({ length: bots }, (_, i) => ({
      id: `bot${i + 1}`,
      name: names[i],
      seat: i + 1,
      profession: others[i % others.length],
      bot: true,
    })),
  ];
  // Di 8 dari 10 permainan, Rezim berusaha menyuap seorang warga bot di tengah jalan.
  // Siapa dan kapan ditentukan engine, jadi tidak ada yang tahu dari awal.
  const rekrut = mode === "rakyat_bersatu" && bots > 0 && cryptoRng.int(1, 10) <= 8;
  const state = createInitialState("solo", mode, members, cryptoRng, level, null, rekrut);
  // Di solo, amplop Rezim bisa juga disodorkan ke pemain: dia sendiri yang memilih terima atau tolak.
  state.rahasia.suapManusia = true;
  const roles: Record<string, Role> = {};
  for (const id of state.order) roles[id] = "rakyat";
  const save: SoloSave = { version: 1, state, roles };
  localStorage.setItem(SOLO_KEY, JSON.stringify(save));
  return soloDriver(save);
}

export function resumeSoloGame(): Driver | null {
  const save = loadSolo();
  return save ? soloDriver(save) : null;
}

