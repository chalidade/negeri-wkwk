// "Driver" permainan: sumber state untuk layar game.
// - Solo: aturan dijalankan langsung di perangkat (instan, tanpa internet), disimpan di localStorage.
// - Online: aturan dijalankan server (Edge Function), state datang lewat realtime.
import { ApiError, api, getGame, getSecret, subscribeRoom, supabase, type GameRow } from "./api.ts";
import {
  BOT_NAMES,
  GameError,
  PROFESSIONS,
  applyAction,
  assignSecrets,
  createInitialState,
  cryptoRng,
  decideBotAction,
  type Action,
  type Mode,
  type Profession,
} from "./shared.ts";

type Role = "rakyat" | "buzzer";

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
}

// ------------------------------------------------------------------ solo

const SOLO_KEY = "wkwk.solo.v2";
interface SoloSave extends GameRow {
  roles: Record<string, Role>;
}

function loadSolo(): SoloSave | null {
  try {
    const raw = localStorage.getItem(SOLO_KEY);
    const save = raw ? (JSON.parse(raw) as SoloSave) : null;
    return save && save.state?.schema === 2 && save.state.phase !== "game_over" ? save : null;
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
      if (s.phase === "game_over" || !s.players[id]?.bot) return;
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

export function newSoloGame(name: string, profession: Profession | null, mode: Mode, bots = 3): Driver {
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
  const state = createInitialState("solo", mode, members, cryptoRng);
  const roles: Record<string, Role> = {};
  for (const s of assignSecrets(mode, state.order, cryptoRng)) roles[s.userId] = s.userId === "kamu" ? "rakyat" : s.role;
  const save: SoloSave = { version: 1, state, roles };
  localStorage.setItem(SOLO_KEY, JSON.stringify(save));
  return soloDriver(save);
}

export function resumeSoloGame(): Driver | null {
  const save = loadSolo();
  return save ? soloDriver(save) : null;
}

// ------------------------------------------------------------------ online

export async function onlineGame(roomId: string): Promise<Driver | null> {
  const first = await getGame(roomId);
  if (!first || first.state.schema !== 2) return null;
  const me = (await supabase.auth.getUser()).data.user?.id ?? "";
  const secret = await getSecret(roomId);
  let cur: GameRow = first;
  const subs = new Set<(row: GameRow) => void>();
  let stop: (() => void) | null = null;
  let poll: ReturnType<typeof setInterval> | undefined;

  const push = (row: GameRow) => {
    if (!row?.state || row.version <= cur.version) return;
    cur = { version: row.version, state: row.state };
    subs.forEach((cb) => cb(cur));
  };
  const refresh = async () => {
    const g = await getGame(roomId).catch(() => null);
    if (g) push(g);
  };
  const stale = (e: unknown) =>
    e instanceof ApiError && (e.code === "state_basi" || e.code === "bukan_giliran_bot");

  return {
    local: false,
    me,
    current: () => cur,
    async send(action) {
      try {
        push(await api.action(roomId, cur.version, action));
      } catch (e) {
        if (!stale(e)) throw e;
        await refresh();
      }
    },
    async botStep() {
      try {
        push(await api.botStep(roomId, cur.version));
      } catch (e) {
        if (!stale(e)) throw e;
        await refresh();
      }
    },
    subscribe(cb) {
      subs.add(cb);
      if (!stop) {
        stop = subscribeRoom(roomId, { onGame: push });
        // Jaga-jaga kalau realtime terputus.
        poll = setInterval(() => void refresh(), 8000);
      }
      return () => {
        subs.delete(cb);
        if (subs.size > 0) return;
        stop?.();
        stop = null;
        clearInterval(poll);
      };
    },
    role: () => secret?.role ?? "rakyat",
    forget: () => localStorage.removeItem("lastRoom"),
  };
}
