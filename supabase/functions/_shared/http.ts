// Helper HTTP bersama untuk semua Edge Functions.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { GameError } from "./engine/mod.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export interface AuthedContext {
  admin: SupabaseClient;
  userId: string;
  body: Record<string, unknown>;
}

/** Client dengan service role: melewati RLS, hanya dipakai di server. */
function adminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Bungkus handler: CORS, cek login, parse body, dan ubah error jadi JSON. */
export function handler(fn: (ctx: AuthedContext) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    try {
      const admin = adminClient();
      const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
      if (!token) throw new HttpError(401, "belum_login", "Login dulu.");
      const { data, error } = await admin.auth.getUser(token);
      if (error || !data.user) throw new HttpError(401, "belum_login", "Sesi login tidak valid.");

      let body: Record<string, unknown> = {};
      try {
        body = (await req.json()) ?? {};
      } catch {
        throw new HttpError(400, "body_tidak_valid", "Body harus JSON.");
      }

      return await fn({ admin, userId: data.user.id, body });
    } catch (e) {
      if (e instanceof GameError) return json({ error: e.code, message: e.message }, 400);
      if (e instanceof HttpError) return json({ error: e.code, message: e.message }, e.status);
      console.error(e);
      return json({ error: "server_error", message: "Ada yang error di server." }, 500);
    }
  };
}

export function requireString(body: Record<string, unknown>, key: string): string {
  const v = body[key];
  if (typeof v !== "string" || v.length === 0) {
    throw new HttpError(400, "parameter_kurang", `Parameter "${key}" wajib diisi.`);
  }
  return v;
}

/** Lempar error kalau query Supabase gagal. */
export function check<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
  if (res.error) {
    throw new HttpError(500, res.error.code ?? "db_error", res.error.message);
  }
  return res.data;
}

/** Seperti check(), tapi baris wajib ada (untuk query .single()). */
export function must<T>(res: { data: T; error: { message: string; code?: string } | null }): NonNullable<T> {
  const data = check(res);
  if (data === null || data === undefined) {
    throw new HttpError(404, "tidak_ditemukan", "Data tidak ditemukan.");
  }
  return data as NonNullable<T>;
}
