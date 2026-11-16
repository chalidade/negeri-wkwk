// POST /bot-step  { roomId, version }  -> { version, state, events }
// Menjalankan SATU aksi untuk bot yang sedang giliran. Dipanggil oleh klien pemain manusia
// di room itu, diberi jeda supaya animasi dadu & pion sempat terlihat.
// Keputusan bot sepenuhnya di server, jadi klien tidak bisa menyetir bot.
import { decideBotAction, type PlayerSecret } from "../_shared/engine/mod.ts";
import { commitAction, loadGame } from "../_shared/game.ts";
import { HttpError, check, handler, json, requireString } from "../_shared/http.ts";

Deno.serve(handler(async ({ admin, userId, body }) => {
  const roomId = requireString(body, "roomId");

  const member = check(
    await admin
      .from("room_members")
      .select("user_id, is_bot")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .maybeSingle(),
  ) as { is_bot: boolean } | null;
  if (!member || member.is_bot) throw new HttpError(403, "bukan_pemain", "Kamu bukan pemain di room ini.");

  const row = await loadGame(admin, roomId);
  if (typeof body.version === "number" && body.version !== row.version) {
    throw new HttpError(409, "state_basi", "State sudah berubah, muat ulang dulu.");
  }
  if (row.state.phase === "game_over") throw new HttpError(409, "game_selesai", "Permainan sudah selesai.");
  const botId = row.state.order[row.state.turn];
  if (!row.state.players[botId]?.bot) throw new HttpError(409, "bukan_giliran_bot", "Sekarang bukan giliran bot.");

  const secret = check(
    await admin
      .from("player_secrets")
      .select("role")
      .eq("room_id", roomId)
      .eq("user_id", botId)
      .maybeSingle(),
  ) as { role: PlayerSecret["role"] } | null;

  const action = decideBotAction(row.state, botId, secret?.role ?? "rakyat");
  const { version, state, events } = await commitAction(admin, roomId, row, botId, action);
  // Event rahasia milik bot tidak dikirim ke pemanggil.
  return json({ version, state, action, events: events.filter((e) => !e.visibleTo) });
}));
