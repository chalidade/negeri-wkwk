import { FunctionsHttpError, createClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "./config.ts";
import type { Action, GameState } from "./shared.ts";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export class ApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

async function call<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    let message = "Ada yang error, coba lagi ya.";
    let code: string | undefined;
    if (error instanceof FunctionsHttpError) {
      try {
        const j = await (error.context as Response).json();
        if (typeof j.message === "string") message = j.message;
        if (typeof j.error === "string") code = j.error;
      } catch {
        /* body bukan JSON */
      }
    }
    throw new ApiError(message, code);
  }
  return data as T;
}

export interface RoomRow {
  id: string;
  code: string;
  host_id: string;
  mode: "rakyat_bersatu" | "juragan";
  max_players: number;
  status: string;
}

export interface MemberRow {
  user_id: string;
  seat: number;
  display_name: string;
  profession: string | null;
}

export interface EventRow {
  id: number;
  version: number;
  type: string;
  actor_id: string | null;
  payload: Record<string, unknown>;
}

export interface SecretRow {
  role: "rakyat" | "buzzer";
  mimpi: string;
}

export interface GameRow {
  version: number;
  state: GameState;
}

export const api = {
  createRoom: (mode: string, profession: string | null) =>
    call<{ roomId: string; code: string }>("create-room", { mode, profession }),
  joinRoom: (code: string, profession: string | null) =>
    call<{ roomId: string; seat: number }>("join-room", { code, profession }),
  startGame: (roomId: string) => call<GameRow>("start-game", { roomId }),
  action: (roomId: string, version: number, action: Action) =>
    call<GameRow>("game-action", { roomId, version, action }),
  deleteAccount: () => call<{ ok: boolean }>("delete-account", {}),
};

export async function myUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function getRoom(roomId: string): Promise<RoomRow> {
  const { data, error } = await supabase
    .from("rooms")
    .select("id, code, host_id, mode, max_players, status")
    .eq("id", roomId)
    .single();
  if (error) throw new ApiError(error.message);
  return data as RoomRow;
}

export async function getMembers(roomId: string): Promise<MemberRow[]> {
  const { data, error } = await supabase
    .from("room_members")
    .select("user_id, seat, display_name, profession")
    .eq("room_id", roomId)
    .order("seat");
  if (error) throw new ApiError(error.message);
  return (data ?? []) as MemberRow[];
}

export async function getGame(roomId: string): Promise<GameRow | null> {
  const { data, error } = await supabase
    .from("game_states")
    .select("version, state")
    .eq("room_id", roomId)
    .maybeSingle();
  if (error) throw new ApiError(error.message);
  return (data as GameRow | null) ?? null;
}

export async function getSecret(roomId: string): Promise<SecretRow | null> {
  const { data } = await supabase
    .from("player_secrets")
    .select("role, mimpi")
    .eq("room_id", roomId)
    .maybeSingle();
  return (data as SecretRow | null) ?? null;
}

export async function getEvents(roomId: string, limit = 30): Promise<EventRow[]> {
  const { data } = await supabase
    .from("game_events")
    .select("id, version, type, actor_id, payload")
    .eq("room_id", roomId)
    .order("id", { ascending: false })
    .limit(limit);
  return ((data ?? []) as EventRow[]).reverse();
}

/** Berlangganan perubahan room. Mengembalikan fungsi untuk berhenti. */
export function subscribeRoom(
  roomId: string,
  handlers: {
    onGame?: (row: GameRow) => void;
    onEvent?: (row: EventRow) => void;
    onMembers?: () => void;
  },
): () => void {
  const channel = supabase
    .channel(`room-${roomId}-${Math.random().toString(36).slice(2)}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "game_states", filter: `room_id=eq.${roomId}` },
      (p) => {
        const row = p.new as GameRow | undefined;
        if (row && row.state) handlers.onGame?.({ version: row.version, state: row.state });
      },
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "game_events", filter: `room_id=eq.${roomId}` },
      (p) => handlers.onEvent?.(p.new as EventRow),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` },
      () => handlers.onMembers?.(),
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
