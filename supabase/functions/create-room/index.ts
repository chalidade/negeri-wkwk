// POST /create-room  { mode?: "rakyat_bersatu" | "juragan", maxPlayers?: 2..6, profession?: string }
// -> { roomId, code }
import { PROFESSIONS, type Profession } from "../_shared/engine/mod.ts";
import { HttpError, check, handler, json, must } from "../_shared/http.ts";

// Tanpa huruf/angka yang gampang tertukar (0/O, 1/I).
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

Deno.serve(handler(async ({ admin, userId, body }) => {
  const mode = body.mode === "juragan" ? "juragan" : "rakyat_bersatu";
  const maxPlayers = Number.isInteger(body.maxPlayers) ? Number(body.maxPlayers) : 6;
  if (maxPlayers < 2 || maxPlayers > 6) {
    throw new HttpError(400, "jumlah_pemain", "Jumlah pemain 2 sampai 6.");
  }
  const profession = PROFESSIONS.includes(body.profession as Profession)
    ? (body.profession as Profession)
    : null;

  const profile = must(
    await admin.from("profiles").select("display_name").eq("id", userId).single(),
  );

  // Coba beberapa kali kalau kode bentrok.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const res = await admin
      .from("rooms")
      .insert({ code, host_id: userId, mode, max_players: maxPlayers })
      .select("id, code")
      .single();
    if (res.error?.code === "23505") continue; // unique_violation
    const room = must(res);

    check(
      await admin.from("room_members").insert({
        room_id: room.id,
        user_id: userId,
        seat: 0,
        display_name: profile.display_name,
        profession,
      }),
    );
    return json({ roomId: room.id, code: room.code });
  }
  throw new HttpError(503, "kode_penuh", "Gagal membuat kode room, coba lagi.");
}));
