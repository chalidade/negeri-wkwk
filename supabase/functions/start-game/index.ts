// POST /start-game  { roomId }  -> { version, state }
// Hanya host. Membuat state awal dan membagikan peran rahasia.
import {
  assignSecrets,
  createInitialState,
  cryptoRng,
  type MemberInput,
  type Mode,
  type Profession,
} from "../_shared/engine/mod.ts";
import { HttpError, check, handler, json, requireString } from "../_shared/http.ts";

Deno.serve(handler(async ({ admin, userId, body }) => {
  const roomId = requireString(body, "roomId");

  const room = check(
    await admin.from("rooms").select("id, host_id, mode, status").eq("id", roomId).maybeSingle(),
  );
  if (!room) throw new HttpError(404, "room_tidak_ada", "Room tidak ditemukan.");
  if (room.host_id !== userId) throw new HttpError(403, "bukan_host", "Hanya host yang bisa mulai.");

  const rows = check(
    await admin
      .from("room_members")
      .select("user_id, seat, display_name, profession, is_bot")
      .eq("room_id", roomId),
  ) as { user_id: string; seat: number; display_name: string; profession: Profession | null; is_bot: boolean }[];
  if (rows.length < 2) throw new HttpError(409, "kurang_pemain", "Butuh minimal 2 pemain.");
  if (rows.every((r) => r.is_bot)) throw new HttpError(409, "kurang_pemain", "Butuh minimal 1 pemain manusia.");

  // Kunci: hanya satu request yang bisa mengubah status lobby -> playing.
  const locked = check(
    await admin
      .from("rooms")
      .update({ status: "playing" })
      .eq("id", roomId)
      .eq("status", "lobby")
      .select("id"),
  ) as { id: string }[];
  if (locked.length === 0) throw new HttpError(409, "sudah_mulai", "Permainan sudah dimulai.");

  const members: MemberInput[] = rows.map((r) => ({
    id: r.user_id,
    name: r.display_name,
    seat: r.seat,
    profession: r.profession,
    bot: r.is_bot,
  }));
  // room online: semua mekanik aktif, tidak bertahap per babak
  const state = createInitialState(roomId, room.mode as Mode, members, cryptoRng, 1, null, false, true);
  const secrets = assignSecrets(room.mode as Mode, state.order, cryptoRng);

  // Simpan profesi final (yang dipilih acak juga) supaya lobby & UI konsisten.
  for (const id of state.order) {
    check(
      await admin
        .from("room_members")
        .update({ profession: state.players[id].profession })
        .eq("room_id", roomId)
        .eq("user_id", id),
    );
  }

  check(
    await admin.from("player_secrets").insert(
      secrets.map((s) => ({ room_id: roomId, user_id: s.userId, role: s.role, mimpi: s.mimpi })),
    ),
  );
  check(await admin.from("game_states").insert({ room_id: roomId, version: 1, state }));
  check(
    await admin.from("game_events").insert({
      room_id: roomId,
      version: 1,
      type: "game_mulai",
      actor_id: userId,
      payload: { giliranPertama: state.order[0] },
    }),
  );

  return json({ version: 1, state });
}));
