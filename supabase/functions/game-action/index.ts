// POST /game-action  { roomId, version, action: { type, ... } }  -> { version, state, events }
// Satu-satunya pintu untuk mengubah state permainan. Dadu diacak di server.
import type { Action } from "../_shared/engine/mod.ts";
import { commitAction, loadGame } from "../_shared/game.ts";
import { HttpError, handler, json, requireString } from "../_shared/http.ts";

Deno.serve(handler(async ({ admin, userId, body }) => {
  const roomId = requireString(body, "roomId");
  const action = body.action as Action | undefined;
  if (!action || typeof action !== "object" || typeof action.type !== "string") {
    throw new HttpError(400, "aksi_tidak_valid", "Parameter action wajib diisi.");
  }

  const row = await loadGame(admin, roomId);
  // Klien mengirim versi yang dia lihat. Kalau sudah basi, minta refresh dulu.
  if (typeof body.version === "number" && body.version !== row.version) {
    throw new HttpError(409, "state_basi", "State sudah berubah, muat ulang dulu.");
  }
  if (row.state.players[userId]?.bot) throw new HttpError(403, "bukan_pemain", "Akun bot tidak bisa main manual.");

  const { version, state, events } = await commitAction(admin, roomId, row, userId, action);
  return json({ version, state, events: events.filter((e) => !e.visibleTo || e.visibleTo === userId) });
}));
