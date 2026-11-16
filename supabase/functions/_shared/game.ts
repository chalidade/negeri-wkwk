// Menyimpan hasil satu aksi permainan: state baru (dengan optimistic locking) + event.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { applyAction, cryptoRng, type Action, type GameEvent, type GameState } from "./engine/mod.ts";
import { HttpError, check } from "./http.ts";

export interface GameRow {
  version: number;
  state: GameState;
}

export async function loadGame(admin: SupabaseClient, roomId: string): Promise<GameRow> {
  const row = check(
    await admin.from("game_states").select("version, state").eq("room_id", roomId).maybeSingle(),
  ) as GameRow | null;
  if (!row) throw new HttpError(404, "game_belum_mulai", "Permainan belum dimulai.");
  if (row.state.schema !== 2) {
    throw new HttpError(409, "game_lama", "Game ini dari versi lama. Bikin room baru ya.");
  }
  return row;
}

export async function commitAction(
  admin: SupabaseClient,
  roomId: string,
  row: GameRow,
  actorId: string,
  action: Action,
): Promise<{ version: number; state: GameState; events: GameEvent[] }> {
  const { state, events } = applyAction(row.state, actorId, action, cryptoRng);
  const version = row.version + 1;

  // Optimistic locking: gagal kalau ada request lain yang menulis duluan.
  const updated = check(
    await admin
      .from("game_states")
      .update({ state, version, updated_at: new Date().toISOString() })
      .eq("room_id", roomId)
      .eq("version", row.version)
      .select("version"),
  ) as { version: number }[];
  if (updated.length === 0) throw new HttpError(409, "state_basi", "Ada aksi lain barusan, coba lagi.");

  if (events.length > 0) {
    check(
      await admin.from("game_events").insert(
        events.map((e) => ({
          room_id: roomId,
          version,
          type: e.type,
          actor_id: e.actor && state.players[e.actor] ? e.actor : null,
          visible_to: e.visibleTo ?? null,
          payload: e.payload,
        })),
      ),
    );
  }

  if (state.phase === "game_over") {
    check(await admin.from("rooms").update({ status: "finished" }).eq("id", roomId));
  }
  return { version, state, events };
}
