// Ikon dan avatar buatan sendiri: satu gaya (garis tinta tebal, warna datar),
// supaya antarmuka tidak bergantung pada emoji bawaan HP.
import { colorForSeat } from "./shared.ts";

const INK = "#1b2440";
const MERAH = "#e5432f";
const KUNING = "#ffc83d";
const HIJAU = "#18a66a";
const BIRU = "#2f6fe4";
const LANGIT = "#bee3f8";
const PUTIH = "#ffffff";

const ICONS: Record<string, string> = {
  menu: `<path d="M5 7h14M5 12h14M5 17h14" stroke-width="2.6"/>`,
  dadu: `<rect x="3.5" y="3.5" width="17" height="17" rx="4.5" fill="${PUTIH}"/><g fill="${MERAH}" stroke="none"><circle cx="8.6" cy="8.6" r="1.5"/><circle cx="15.4" cy="15.4" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="15.4" cy="8.6" r="1.5"/><circle cx="8.6" cy="15.4" r="1.5"/></g>`,
  petir: `<path d="M13.6 2.6 5 13.4h5.4L9.4 21.4 19 10.4h-5.4z" fill="${KUNING}"/>`,
  hati: `<path d="M12 20.4s-7.6-4.6-7.6-10A4.3 4.3 0 0 1 12 7.7a4.3 4.3 0 0 1 7.6 2.7c0 5.4-7.6 10-7.6 10z" fill="${MERAH}"/>`,
  toa: `<path d="M4 10v4h3l8 4.5v-13L7 10z" fill="${KUNING}"/><path d="M7.6 14.4 9 19.6h2.4l-1-4.4"/><path d="M18 9.4c1.2 1 1.2 4.2 0 5.2M20.4 7.4c2.2 2.4 2.2 6.800 0 9.200"/>`,
  suara: `<path d="M9.500 10V4.500h5V10" fill="${PUTIH}"/><rect x="4" y="10" width="16" height="10" rx="2.2" fill="${LANGIT}"/><path d="M9 13.500h6"/>`,
  karung: `<path d="M9 7.600 7.800 4h8.400L15 7.600" fill="${KUNING}"/><path d="M8.600 7.600c-3 2.600-4.400 5.600-4.400 8.200 0 3 2.600 4.600 7.800 4.600s7.800-1.600 7.800-4.600c0-2.600-1.400-5.600-4.400-8.200z" fill="#f0d18a"/><path d="M12 11.400v5.400M12 13.200c-1.400 0-2.200-.8-2.400-1.800M12 15c1.400 0 2.200-.8 2.400-1.800"/>`,
  uang: `<rect x="2.600" y="6.400" width="18.800" height="11.200" rx="2.400" fill="#bfeacb"/><circle cx="12" cy="12" r="2.600" fill="${PUTIH}"/><path d="M5.800 9.600v.1M18.200 14.400v.1" stroke-width="2.600"/>`,
  koin: `<circle cx="12" cy="12" r="8.600" fill="${KUNING}"/><path d="M12 7.600l1.400 2.800 3 .4-2.200 2.200.6 3-2.800-1.500-2.800 1.500.6-3-2.200-2.200 3-.4z" fill="${PUTIH}" stroke-width="1.600"/>`,
  mahkota: `<path d="M4.400 18h15.200l1.400-9.400-5 3.600L12 5.600 8 12.200 3 8.600z" fill="${KUNING}"/>`,
  kaca: `<circle cx="10.600" cy="10.600" r="6" fill="${LANGIT}"/><path d="M15.200 15.200l5.200 5.200" stroke-width="2.800"/>`,
  warga: `<circle cx="8.600" cy="9" r="3.200" fill="${PUTIH}"/><path d="M2.800 19.400c0-3.400 2.600-5.200 5.800-5.200s5.800 1.800 5.800 5.200z" fill="${PUTIH}"/><circle cx="16.800" cy="8.400" r="2.600"/><path d="M16.600 13.600c2.800 0 4.800 1.800 4.800 4.800"/>`,
  tanya: `<circle cx="12" cy="12" r="8.800" fill="${PUTIH}"/><path d="M9.600 9.800a2.500 2.500 0 1 1 3.600 2.200c-.800.500-1.200 1-1.200 2M12 16.800v.2" stroke-width="2.200"/>`,
  main: `<path d="M8 5.400v13.200L19.200 12z" fill="${PUTIH}"/>`,
  kiri: `<path d="M14.600 5.600 8.200 12l6.400 6.400" stroke-width="2.800"/>`,
  kanan: `<path d="M9.400 5.600l6.400 6.400-6.400 6.400" stroke-width="2.800"/>`,
  bawah: `<path d="M5.600 9.400 12 15.800l6.400-6.400" stroke-width="2.800"/>`,
  centang: `<path d="M5 12.600l4.600 4.600L19 7.400" stroke-width="3"/>`,
  silang: `<path d="M6.400 6.400l11.200 11.200M17.600 6.400 6.400 17.600" stroke-width="2.800"/>`,
  bintang: `<path d="M12 3.600l2.600 5.300 5.800.8-4.200 4.100 1 5.800L12 16.800l-5.200 2.800 1-5.800L3.600 9.700l5.800-.8z" fill="${KUNING}"/>`,
  naik: `<circle cx="12" cy="12" r="9" fill="${KUNING}"/><path d="M12 17V7.800M7.800 11.600 12 7.400l4.200 4.200" stroke-width="2.600"/>`,
  toko: `<path d="M4.400 10.400V20h15.200v-9.600" fill="${PUTIH}"/><path d="M3 10.400 4.800 4.400h14.400L21 10.400c0 1.400-1.200 2.200-2.400 2.200s-2.200-.8-2.200-2.200c0 1.400-1 2.200-2.200 2.200S12 11.800 12 10.400c0 1.400-1 2.200-2.200 2.200s-2.200-.8-2.200-2.200c0 1.400-1 2.200-2.200 2.200S3 11.800 3 10.400z" fill="${MERAH}"/><path d="M10 20v-4.400h4V20"/>`,
  palu: `<path d="M12.600 4.600l6.800 6.800-2.600 2.600-6.800-6.800z" fill="${KUNING}"/><path d="M12.600 11 5 18.600"/><path d="M4 21h9"/>`,
  petisi: `<path d="M6 3.600h9l3.600 3.600v13.200H6z" fill="${PUTIH}"/><path d="M9 9.600h5M9 13h6M9 16.400h3.400"/>`,
  koran: `<rect x="3.600" y="5" width="16.800" height="14" rx="2" fill="${PUTIH}"/><path d="M7 9h5v4H7zM14.600 9H17M14.600 12.600H17M7 16h10"/>`,
  bantu: `<circle cx="12" cy="6.400" r="3" fill="${KUNING}"/><path d="M3.400 14.600h3.800l4.600 1.400h3.800a1.500 1.500 0 0 1 0 3h-4.400" fill="none"/><path d="M3.400 20.200l8.600 1 7.800-4.400a1.500 1.500 0 0 0-1.600-2.600l-2.600 1.400" fill="#f6cfa6"/>`,
  pinjol: `<rect x="6.600" y="2.600" width="10.800" height="18.800" rx="2.600" fill="${PUTIH}"/><circle cx="12" cy="11.400" r="3" fill="${KUNING}"/><path d="M10.600 18h2.800"/>`,
  keluar: `<path d="M13.600 4.400H6.400v15.200h7.200" fill="${PUTIH}"/><path d="M11 12h9.400M17 8.400l3.600 3.600-3.600 3.600"/>`,
  bunyi: `<path d="M4 9.600v4.800h3.400l5 4V5.600l-5 4z" fill="${PUTIH}"/><path d="M16 9c1.400 1.400 1.400 4.600 0 6M18.600 6.600c2.800 2.800 2.800 8 0 10.800"/>`,
  senyap: `<path d="M4 9.600v4.800h3.400l5 4V5.600l-5 4z" fill="${PUTIH}"/><path d="M16.400 9.600l4.400 4.800M20.800 9.600l-4.400 4.800"/>`,
  cepat: `<path d="M3.600 6v12l8-6zM12.400 6v12l8-6z" fill="${PUTIH}"/>`,
  riwayat: `<path d="M5 4.400h14v15.200H5z" fill="${PUTIH}"/><path d="M8.400 8.600h7.200M8.400 12h7.200M8.400 15.400h4.400"/>`,
  gembok: `<rect x="5" y="10.600" width="14" height="9.800" rx="2.400" fill="${KUNING}"/><path d="M8.200 10.600V8a3.800 3.800 0 0 1 7.600 0v2.600"/>`,
  robot: `<rect x="5" y="8" width="14" height="11" rx="3" fill="${LANGIT}"/><path d="M12 8V4.600M9.400 13v.2M14.600 13v.2" stroke-width="2.400"/><circle cx="12" cy="3.800" r="1.200" fill="${MERAH}"/>`,
  tambah: `<path d="M12 5.400v13.200M5.400 12h13.200" stroke-width="2.800"/>`,
  salin: `<rect x="8" y="8" width="11.600" height="11.600" rx="2.400" fill="${PUTIH}"/><path d="M15.600 4.600H6.800a2.200 2.200 0 0 0-2.200 2.200v8.800"/>`,
  tangan: `<path d="M7 12.400V6.600a1.500 1.500 0 0 1 3 0v4.200V4.800a1.500 1.500 0 0 1 3 0v6V6a1.500 1.500 0 0 1 3 0v6.200V9.400a1.500 1.500 0 0 1 3 0v5.800c0 3.600-2.600 6.200-6.200 6.200-3.200 0-4.800-1.400-6.200-3.800l-2.400-4a1.500 1.500 0 0 1 2.600-1.500z" fill="#f6cfa6"/>`,
  mobil: `<path d="M3 16.400v-3.600l2.200-.8 1.800-4.400h10l1.800 4.400 2.200.8v3.600z" fill="${INK}"/><circle cx="7.400" cy="16.600" r="2" fill="${PUTIH}"/><circle cx="16.600" cy="16.600" r="2" fill="${PUTIH}"/><path d="M8.400 8.800h7.200l1 2.600H7.400z" fill="${LANGIT}" stroke-width="1.400"/>`,
  chat: `<path d="M4 5.600h16v10.400h-8.400L7 20v-4H4z" fill="${PUTIH}"/><path d="M8 9.600h8M8 12.600h5"/>`,
  bencana: `<path d="M2.600 20 9.400 8.400h5.200L21.400 20z" fill="#8a5a32"/><path d="M9.400 8.400l1.600 2.400 1.400-1.600 1.200 1.800 1-2.600" fill="${MERAH}"/><path d="M11 5.400c-.800-1.200.400-2 0-3M14 5.600c.800-1 .200-1.800.600-2.800"/>`,
  sirene: `<path d="M7 17v-4.500a5 5 0 0 1 10 0V17z" fill="${MERAH}"/><path d="M4.500 20.400h15V17h-15z" fill="${PUTIH}"/><path d="M12 3.200v2M4.400 6.400l1.500 1.500M19.600 6.400l-1.500 1.500"/>`,
  kursi: `<path d="M7.500 3.600h9v9h-9z" fill="#b9793f"/><path d="M5.600 12.600h12.800V16H5.600z" fill="#e0a15f"/><path d="M7 16v4.800M17 16v4.800"/>`,
  kartu: `<rect x="5.600" y="3.600" width="12.800" height="16.800" rx="2.400" fill="${PUTIH}"/><path d="M12 8.400l2.400 3.600-2.400 3.600-2.400-3.600z" fill="${MERAH}" stroke-width="1.600"/>`,
};

/** SVG utuh sebuah ikon, untuk digambar ke kanvas (tekstur petak di papan 3D). */
export function ikonSvg(name: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] ?? ""}</svg>`;
}

/** Ikon satu baris teks. Ukurannya mengikuti font-size induknya. */
export function ic(name: keyof typeof ICONS | string, cls = ""): HTMLElement {
  const el = document.createElement("i");
  el.className = `ic ${cls}`.trim();
  el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] ?? ""}</svg>`;
  return el;
}

// ------------------------------------------------------------------ avatar

const KULIT = "#f6cfa6";

/** Topi/aksesori tiap profesi, sama dengan topi pion di papan 3D. */
const TOPI: Record<string, string> = {
  // helm proyek kuning
  buruh: `<path d="M11.500 21.500a12.500 12.500 0 0 1 25 0z" fill="${KUNING}"/><path d="M8.500 21.500h31" stroke-width="3"/><path d="M24 9v6"/>`,
  // caping pasar
  pedagang: `<path d="M5.500 22.500 24 6.500l18.500 16z" fill="#e0a94a"/><path d="M15 16.500h18M19.500 12h9" stroke-width="1.600"/>`,
  // helm hijau berkaca
  ojol: `<path d="M10.500 27v-6a13.500 13.500 0 0 1 27 0v6l-3-1.500v-4h-21v4z" fill="${HIJAU}"/><rect x="13.500" y="20" width="21" height="5.500" rx="2.700" fill="${LANGIT}"/>`,
  // topi pink + headphone
  kreator: `<path d="M12 21.500a12 12 0 0 1 24 0z" fill="#ff5c93"/><path d="M9.500 26a14.500 14.500 0 0 1 29 0" /><rect x="7" y="24" width="5.500" height="9.500" rx="2.700" fill="${INK}"/><rect x="35.500" y="24" width="5.500" height="9.500" rx="2.700" fill="${INK}"/>`,
  // topi fedora + kacamata
  jurnalis: `<path d="M14.500 21v-5.500c0-3 4.200-5 9.500-5s9.500 2 9.500 5V21z" fill="#8a5a32"/><path d="M7.500 21.500h33" stroke-width="3"/><path d="M14.500 18h19" stroke="${KUNING}" stroke-width="2.200"/><circle cx="19.500" cy="28.500" r="3.600" fill="${PUTIH}"/><circle cx="28.500" cy="28.500" r="3.600" fill="${PUTIH}"/><path d="M23.100 28.500h1.800"/>`,
  // toga wisuda
  mahasiswa: `<path d="M14.500 17.500V23h19v-5.500" fill="#2a3470"/><path d="M24 7 42 14.500 24 22 6 14.500z" fill="#2a3470"/><path d="M38 16v7.500" stroke="${KUNING}" stroke-width="2.200"/><circle cx="38" cy="25" r="1.800" fill="${KUNING}" stroke="none"/>`,
};

function wajah(profesi: string): string {
  const kacamata = profesi === "jurnalis";
  return [
    `<path d="M6 50c0-8.500 8-11.500 18-11.500s18 3 18 11.500z" fill="${PUTIH}"/>`,
    `<circle cx="24" cy="28" r="12" fill="${KULIT}"/>`,
    kacamata ? "" : `<g fill="${INK}" stroke="none"><circle cx="19.500" cy="28.500" r="1.700"/><circle cx="28.500" cy="28.500" r="1.700"/></g>`,
    `<path d="M20 33.500q4 3.200 8 0"/>`,
    TOPI[profesi] ?? "",
    kacamata ? `<g fill="${INK}" stroke="none"><circle cx="19.500" cy="28.500" r="1.400"/><circle cx="28.500" cy="28.500" r="1.400"/></g>` : "",
  ].join("");
}

/** Pejabat Rezim: peci hitam, kacamata gelap, dasi merah. */
function wajahRezim(): string {
  return [
    `<path d="M6 50c0-8.500 8-11.500 18-11.500s18 3 18 11.500z" fill="${INK}"/>`,
    `<path d="M21 39h6l-1.200 4 1.800 7h-7.200l1.800-7z" fill="${MERAH}" stroke-width="1.600"/>`,
    `<circle cx="24" cy="28" r="12" fill="${KULIT}"/>`,
    `<path d="M12.500 22c0-10 23-10 23 0v1.500h-23z" fill="${INK}"/>`,
    `<rect x="14.500" y="25.500" width="8" height="5.500" rx="2.400" fill="${INK}"/><rect x="25.500" y="25.500" width="8" height="5.500" rx="2.400" fill="${INK}"/><path d="M22.500 27.500h3"/>`,
    `<path d="M20.500 35.500q4-1.800 7.500 .6"/>`,
  ].join("");
}

const svg48 = (isi: string) =>
  `<svg viewBox="0 0 48 48" fill="none" stroke="${INK}" stroke-width="2.200" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${isi}</svg>`;

/** Avatar bundar warga: warna kursi sebagai latar, wajah + topi profesi. */
export function ava(profesi: string | null | undefined, seat: number, cls = ""): HTMLElement {
  const el = document.createElement("span");
  el.className = `ava ${cls}`.trim();
  el.style.background = colorForSeat(seat);
  el.innerHTML = svg48(wajah(profesi ?? ""));
  return el;
}

/** Wajah pejabat Rezim untuk kapsul bos dan pilihan babak. */
export function rezimAva(cls = ""): HTMLElement {
  const el = document.createElement("span");
  el.className = `ava rezim ${cls}`.trim();
  el.innerHTML = svg48(wajahRezim());
  return el;
}
