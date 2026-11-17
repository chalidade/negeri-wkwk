// Saklar backend online.
// "p2p" (bawaan): tanpa server sendiri. HP tuan rumah menjalankan permainan; lewat internet pesannya dititipkan ke server penghubung (RELAY_URLS).
// "supabase": jalur lama lewat Supabase. Kodenya tetap disimpan, aktifkan dengan VITE_BACKEND=supabase saat build.
/** Alamat publik versi web: link undangan selalu ke sini, juga saat dibagikan dari aplikasi Android. */
export const WEB_URL = "https://negeri-wkwk.vercel.app";

/** Berjalan di dalam aplikasi Android (Capacitor), bukan di peramban. */
export const diAplikasi = (): boolean =>
  !!(globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();

export const BACKEND: "p2p" | "supabase" = import.meta.env.VITE_BACKEND === "supabase" ? "supabase" : "p2p";

// URL dan publishable key Supabase memang boleh publik: data dilindungi RLS.
// Bisa ditimpa lewat VITE_SUPABASE_URL / VITE_SUPABASE_KEY saat build.
export const SUPABASE_URL: string =
  import.meta.env.VITE_SUPABASE_URL ?? "https://smvkbqfffynhtejwvkuj.supabase.co";
export const SUPABASE_KEY: string =
  import.meta.env.VITE_SUPABASE_KEY ?? "sb_publishable_GxiH2VpHQjzFd7HHJ-rDdA_4sCDhh6b";

/**
 * Server penghubung untuk main bareng lewat internet: broker MQTT lewat WebSocket aman.
 * Pesan permainan dititipkan lewat sini (terenkripsi), jadi HP di jaringan berbeda tetap bisa
 * main bareng tanpa harus saling menembus NAT. Semua broker dipakai sekaligus: satu mati,
 * yang lain meneruskan.
 *
 * Tiga alamat bawaan adalah broker publik untuk uji coba (tanpa jaminan layanan). Sebelum rilis
 * luas, ganti dengan broker sendiri lewat VITE_RELAY (dipisah koma) saat build.
 */
export const RELAY_URLS: string[] = (
  (import.meta.env.VITE_RELAY as string | undefined) ??
  "wss://broker.emqx.io:8084/mqtt,wss://broker.hivemq.com:8884/mqtt,wss://test.mosquitto.org:8081/mqtt"
)
  .split(",")
  .map((u) => u.trim())
  .filter(Boolean);
