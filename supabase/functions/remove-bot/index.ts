// POST /remove-bot  { roomId, userId }  -> { ok: true }
import { HttpError, check, handler, json, requireString } from "../_shared/http.ts";

Deno.serve(handler(async ({ admin, userId, body }) => {
  const roomId = requireString(body, "roomId");
  const botId = requireString(body, "userId");
  const room = check(
    await admin.from("rooms").select("host_id, status").eq("id", roomId).maybeSingle(),
  );
  if (!room) throw new HttpError(404, "room_tidak_ada", "Room tidak ditemukan.");
  if (room.host_id !== userId) throw new HttpError(403, "bukan_host", "Hanya host yang bisa mengeluarkan bot.");
  if (room.status !== "lobby") throw new HttpError(409, "sudah_mulai", "Permainan sudah dimulai.");
  check(
    await admin.from("room_members").delete().eq("room_id", roomId).eq("user_id", botId).eq("is_bot", true),
  );
  return json({ ok: true });
}));
