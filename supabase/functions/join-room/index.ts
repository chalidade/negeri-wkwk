// POST /join-room  { code: "ABC123", profession?: string }  -> { roomId, seat }
import { PROFESSIONS, type Profession } from "../_shared/engine/mod.ts";
import { HttpError, check, handler, json, must, requireString } from "../_shared/http.ts";

Deno.serve(handler(async ({ admin, userId, body }) => {
  const code = requireString(body, "code").trim().toUpperCase();
  const profession = PROFESSIONS.includes(body.profession as Profession)
    ? (body.profession as Profession)
    : null;

  const room = check(
    await admin.from("rooms").select("id, status, max_players").eq("code", code).maybeSingle(),
  );
  if (!room) throw new HttpError(404, "room_tidak_ada", "Kode room tidak ditemukan.");

  const members = check(
    await admin.from("room_members").select("user_id, seat").eq("room_id", room.id),
  ) as { user_id: string; seat: number }[];

  const existing = members.find((m) => m.user_id === userId);
  if (existing) return json({ roomId: room.id, seat: existing.seat });

  if (room.status !== "lobby") throw new HttpError(409, "sudah_mulai", "Permainan sudah dimulai.");
  if (members.length >= room.max_players) throw new HttpError(409, "room_penuh", "Room sudah penuh.");

  const profile = must(
    await admin.from("profiles").select("display_name").eq("id", userId).single(),
  );

  // Ambil kursi kosong terkecil. Kalau bentrok karena dua orang join bareng, coba lagi.
  for (let attempt = 0; attempt < 3; attempt++) {
    const taken = new Set(
      (check(await admin.from("room_members").select("seat").eq("room_id", room.id)) as { seat: number }[])
        .map((m) => m.seat),
    );
    if (taken.size >= room.max_players) throw new HttpError(409, "room_penuh", "Room sudah penuh.");
    let seat = 0;
    while (taken.has(seat)) seat++;

    const res = await admin.from("room_members").insert({
      room_id: room.id,
      user_id: userId,
      seat,
      display_name: profile.display_name,
      profession,
    });
    if (res.error?.code === "23505") continue;
    check(res);
    return json({ roomId: room.id, seat });
  }
  throw new HttpError(409, "coba_lagi", "Kursi sedang rebutan, coba lagi.");
}));
