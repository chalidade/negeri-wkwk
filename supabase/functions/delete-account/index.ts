// POST /delete-account  {}  -> { ok: true }
// Menghapus akun pemain beserta datanya (profil, keanggotaan room, room yang dia host).
// Diwajibkan App Store dan Google Play untuk aplikasi yang membuat akun.
import { HttpError, handler, json } from "../_shared/http.ts";

Deno.serve(handler(async ({ admin, userId }) => {
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new HttpError(500, "gagal_hapus", "Gagal menghapus akun, coba lagi.");
  return json({ ok: true });
}));
