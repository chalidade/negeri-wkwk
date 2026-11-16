// URL dan publishable key Supabase memang boleh publik: data dilindungi RLS.
// Bisa ditimpa lewat VITE_SUPABASE_URL / VITE_SUPABASE_KEY saat build.
export const SUPABASE_URL: string =
  import.meta.env.VITE_SUPABASE_URL ?? "https://smvkbqfffynhtejwvkuj.supabase.co";
export const SUPABASE_KEY: string =
  import.meta.env.VITE_SUPABASE_KEY ?? "sb_publishable_GxiH2VpHQjzFd7HHJ-rDdA_4sCDhh6b";
