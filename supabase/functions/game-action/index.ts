// POST /game-action  { roomId, version, action: { type, ... } }  -> { version, state, events }
// Satu-satunya pintu untuk mengubah state permainan. Dadu diacak di server.
import {
  applyAction,
  cryptoRng,
  type Action,
  type GameState,
} from "../_shared/engine/mod.ts";
import { HttpError, check, handler, json, requireString } from "../_shared/http.ts";

Deno.serve(handler(async ({ admin, userId, body }) => {
  const roomId = requireString(body, "roomId");
  const action = body.action as Action | undefined;
  if (!action || typeof action !== "object" || typeof action.type !== "string") {
    throw new HttpError(400, "aksi_tidak_valid", "Parameter action wajib diisi.");
  }

  const row = check(
    await admin.from("game_states").select("version, state").eq("room_id", roomId).maybeSingle(),
  ) as { version: number; state: GameState } | null;
  if (!row) throw new HttpError(404, "game_belum_mulai", "Permainan belum dimulai.");

  // Klien mengirim versi yang dia lihat. Kalau sudah basi, minta refresh dulu.
  if (typeof body.version === "number" && body.version !== row.version) {
    throw new HttpError(409, "state_basi", "State sudah berubah, muat ulang dulu.");
  }

  const { state, events } = applyAction(row.state, userId, action, cryptoRng);
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

  return json({ version, state, events: events.filter((e) => !e.visibleTo || e.visibleTo === userId) });
}));
