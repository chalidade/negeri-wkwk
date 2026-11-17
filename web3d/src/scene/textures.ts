// Tekstur digambar di canvas saat runtime, jadi tidak perlu file gambar.
import * as THREE from "three";
import { ikonSvg } from "../icons.ts";
import { GROUP_COLOR, drPendek, type TileDef } from "../shared.ts";

const DISPLAY = '"Bagel Fat One", "Arial Black", sans-serif';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!];
}

function toTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const test = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

const SPECIAL_BG: Record<string, [string, string]> = {
  start: ["#ffe066", "#ffb703"],
  jail: ["#cfe0f1", "#8fa9c4"],
  go_to_jail: ["#aebdd0", "#5d7391"],
  card_wa: ["#d6f8de", "#74d68b"],
  card_nasib: ["#ffe9bf", "#ffb44d"],
  tax: ["#ffd6d6", "#ff8585"],
  gov_seat: ["#565c6b", "#2b2f3a"],
  demo: ["#ff9b9b", "#f03e3e"],
  lumbung: ["#fff1b8", "#f3c53c"],
};

/** Sisi atas petak. Bagian bawah canvas menghadap kamera. */
const IKON_PETAK: Record<string, string> = {
  start: "uang", jail: "gembok", go_to_jail: "sirene", card_wa: "chat", card_nasib: "kartu",
  tax: "petisi", gov_seat: "kursi", demo: "toa", lumbung: "karung",
};

export function tileTexture(t: TileDef): THREE.CanvasTexture {
  let ikon: string | null = null;
  const S = 256;
  const [c, ctx] = canvas(S, S);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (t.type === "property") {
    // Lahan tempat bangunan berdiri di belakang, pita warna berisi nama + harga di depan.
    ctx.fillStyle = "#dff3c4";
    ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = "#cdebab";
    for (let i = 0; i < 5; i++) ctx.fillRect(18 + i * 46, 12, 26, 100);
    const band = GROUP_COLOR[t.group ?? ""] ?? "#888";
    ctx.fillStyle = band;
    ctx.fillRect(0, 124, S, S - 124);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillRect(0, 124, S, 8);
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 7;
    ctx.lineJoin = "round";
    ctx.font = `38px ${DISPLAY}`;
    const lines = wrap(ctx, t.name, S - 16);
    const y0 = lines.length === 1 ? 168 : 158;
    lines.forEach((l, i) => {
      ctx.strokeText(l, S / 2, y0 + i * 36, S - 12);
      ctx.fillText(l, S / 2, y0 + i * 36, S - 12);
    });
    ctx.font = `34px ${DISPLAY}`;
    ctx.fillStyle = "#fff3a6";
    const py = lines.length === 1 ? 218 : 231;
    ctx.strokeText(drPendek(t.price ?? 0), S / 2, py);
    ctx.fillText(drPendek(t.price ?? 0), S / 2, py);
  } else {
    const [a, b] = SPECIAL_BG[t.type] ?? ["#fff", "#ddd"];
    const g = ctx.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    // stiker bundar putih; ikonnya (gambar sendiri, bukan emoji) menyusul begitu selesai dimuat
    ctx.fillStyle = "#fffdf7";
    ctx.strokeStyle = "#1b2440";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(S / 2, 86, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ikon = IKON_PETAK[t.type] ?? null;
    const dark = t.type === "gov_seat" || t.type === "go_to_jail";
    ctx.font = `38px ${DISPLAY}`;
    ctx.lineWidth = 7;
    ctx.lineJoin = "round";
    ctx.strokeStyle = dark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.75)";
    ctx.fillStyle = dark ? "#fff" : "#3a2a12";
    const lines = wrap(ctx, t.name, S - 20);
    const y0 = lines.length === 1 ? 204 : 182;
    lines.forEach((l, i) => {
      ctx.strokeText(l, S / 2, y0 + i * 38, S - 12);
      ctx.fillText(l, S / 2, y0 + i * 38, S - 12);
    });
  }

  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, S - 6, S - 6);
  const tex = toTexture(c);
  if (ikon) {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, S / 2 - 46, 40, 92, 92);
      tex.needsUpdate = true;
    };
    img.src = `data:image/svg+xml;utf8,${encodeURIComponent(ikonSvg(ikon))}`;
  }
  return tex;
}

/** Halaman tengah: rumput dengan jalan setapak menuju Istana. */
export function lawnTexture(): THREE.CanvasTexture {
  const S = 1024;
  const [c, ctx] = canvas(S, S);
  ctx.fillStyle = "#8ed06a";
  ctx.fillRect(0, 0, S, S);
  // kotak-kotak rumput ala taman
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if ((x + y) % 2 === 0) continue;
      ctx.fillStyle = "#86c962";
      ctx.fillRect(x * 128, y * 128, 128, 128);
    }
  }
  // alun-alun bundar + jalan ke empat arah
  ctx.fillStyle = "#f2e3b6";
  ctx.fillRect(S / 2 - 46, 0, 92, S);
  ctx.fillRect(0, S / 2 - 46, S, 92);
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, 300, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e6d39c";
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, 262, 0, Math.PI * 2);
  ctx.fill();
  return toTexture(c);
}

export function skyTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(8, 512);
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, "#1e9bf0");
  g.addColorStop(0.55, "#6fd0ff");
  g.addColorStop(1, "#d9f6ff");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 512);
  return toTexture(c);
}

export function labelTexture(text: string, color: string): THREE.CanvasTexture {
  const [c, ctx] = canvas(320, 80);
  ctx.font = `40px ${DISPLAY}`;
  const w = Math.min(304, ctx.measureText(text).width + 44);
  ctx.fillStyle = color;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect((320 - w) / 2, 10, w, 60, 30);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 160, 43, 280);
  return toTexture(c);
}

/** Penanda "bisa di-upgrade" yang melayang di atas usaha: lingkaran kuning berpanah naik. */
export function markerTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(128, 128);
  ctx.fillStyle = "#ffc83d";
  ctx.strokeStyle = "#1b2440";
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(64, 64, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 13;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(64, 92);
  ctx.lineTo(64, 40);
  ctx.moveTo(40, 62);
  ctx.lineTo(64, 38);
  ctx.lineTo(88, 62);
  ctx.stroke();
  return toTexture(c);
}

/** Spanduk demo: kain putih bergaris tinta dengan tulisan merah. */
export function spandukTexture(text: string): THREE.CanvasTexture {
  const [c, ctx] = canvas(512, 112);
  ctx.fillStyle = "#fffdf7";
  ctx.fillRect(0, 0, 512, 112);
  ctx.strokeStyle = "#1b2440";
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 502, 102);
  ctx.fillStyle = "#e5432f";
  ctx.font = `58px ${DISPLAY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 60, 470);
  return toTexture(c);
}
