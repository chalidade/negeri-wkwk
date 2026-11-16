// POST /add-bot  { roomId }  -> { userId, seat, name }
// Hanya host, hanya saat lobby. Mengisi kursi kosong dengan bot.
import { BOT_NAMES, PROFESSIONS } from "../_shared/engine/mod.ts";
import { HttpError, check, handler, json, requireString } from "../_shared/http.ts";

Deno.serve(handler(async ({ admin, userId, body }) => {
  const roomId = requireString(body, "roomId");
  const room = check(
    await admin.from("rooms").select("id, host_id, status, max_players").eq("id", roomId).maybeSingle(),
  );
  if (!room) throw new HttpError(404, "room_tidak_ada", "Room tidak ditemukan.");
  if (room.host_id !== userId) throw new HttpError(403, "bukan_host", "Hanya host yang bisa menambah bot.");
  if (room.status !== "lobby") throw new HttpError(409, "sudah_mulai", "Permainan sudah dimulai.");

  const bots = check(
    await admin.from("profiles").select("id").eq("is_bot", true).order("id"),
  ) as { id: string }[];

  for (let attempt = 0; attempt < 3; attempt++) {
    const members = check(
      await admin.from("room_members").select("user_id, seat, display_name").eq("room_id", roomId),
    ) as { user_id: string; seat: number; display_name: string }[];
    if (members.length >= room.max_players) throw new HttpError(409, "room_penuh", "Room sudah penuh.");

    const inRoom = new Set(members.map((m) => m.user_id));
    const bot = bots.find((b) => !inRoom.has(b.id));
    if (!bot) throw new HttpError(409, "bot_habis", "Bot sudah habis.");

    const usedNames = new Set(members.map((m) => m.display_name));
    const free = BOT_NAMES.filter((n) => !usedNames.has(n));
    const name = free[crypto.getRandomValues(new Uint32Array(1))[0] % free.length];
    const profession = PROFESSIONS[crypto.getRandomValues(new Uint32Array(1))[0] % PROFESSIONS.length];
    const taken = new Set(members.map((m) => m.seat));
    let seat = 0;
    while (taken.has(seat)) seat++;

    const res = await admin.from("room_members").insert({
      room_id: roomId,
      user_id: bot.id,
      seat,
      display_name: name,
      profession,
      is_bot: true,
    });
    if (res.error?.code === "23505") continue; // kursi/bot rebutan, ulangi
    check(res);
    return json({ userId: bot.id, seat, name });
  }
  throw new HttpError(409, "coba_lagi", "Kursi sedang rebutan, coba lagi.");
}));
