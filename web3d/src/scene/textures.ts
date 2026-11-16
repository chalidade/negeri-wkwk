import * as THREE from "three";
import type { TileDef } from "../shared.ts";
import { tileCell } from "./layout.ts";

const GROUP_COLOR: Record<string, string> = {
  coklat: "#8d6e63",
  biru_muda: "#4fc3f7",
  pink: "#f06292",
  oranye: "#ffa726",
  merah: "#e53935",
  kuning: "#fdd835",
  hijau: "#43a047",
  biru_tua: "#1e3a8a",
};

const CORNER_BG: Record<string, string> = {
  start: "#2dbe6c",
  jail: "#546e7a",
  posko: "#3a86ff",
  go_to_jail: "#e63946",
};

export function tileEmoji(t: TileDef): string {
  switch (t.type) {
    case "start":
      return "💰";
    case "card_wa":
      return "💬";
    case "card_nasib":
      return "🎲";
    case "tax":
      return "🧾";
    case "transport":
      return t.name.includes("Bandara")
        ? "✈️"
        : t.name.includes("Pelabuhan")
          ? "⛴️"
          : t.name.includes("KRL")
            ? "🚆"
            : "🚌";
    case "utility":
      return t.name.includes("Listrik") ? "⚡" : "💧";
    case "jail":
      return "🚓";
    case "posko":
      return "🌊";
    case "go_to_jail":
      return "🫵";
    case "gov_seat":
      return "🪑";
    default:
      return PROPERTY_EMOJI[t.name] ?? "🏠";
  }
}

const PROPERTY_EMOJI: Record<string, string> = {
  "Gang Senggol": "🏚️",
  "Kontrakan Petak": "🏠",
  "Pasar Kaget": "🛒",
  "Warung Kelontong": "🏪",
  "Kios Pulsa": "📶",
  "Pangkalan Ojol": "🛵",
  "Kos-kosan": "🛏️",
  Angkringan: "🍢",
  "Ruko Pinggir Jalan": "🏬",
  "Toko Online": "📦",
  "Konveksi Rumahan": "🧵",
  "Perumahan Subsidi": "🏘️",
  "Kawasan Industri": "🏭",
  "Kebun Sawit": "🌴",
  "Villa Puncak": "⛰️",
  "Resort Pulau Dewata": "🏝️",
  "Tambang Nikel": "⛏️",
  "Apartemen Pusat Kota": "🏙️",
  "Kawasan Elite": "🏰",
  "Proyek Strategis": "🏗️",
};

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  return [c, c.getContext("2d")!];
}

function texture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

/** Tekstur permukaan atas petak: warna dasar, pita grup, ikon, nama, harga. */
export function tileTexture(t: TileDef): THREE.CanvasTexture {
  const S = 256;
  const [c, ctx] = canvas(S);
  const corner = t.index % 10 === 0;
  const gov = t.type === "gov_seat";
  const bg = corner ? CORNER_BG[t.type] ?? "#fff4dc" : gov ? "#2b2b3a" : "#fff4dc";
  const fg = (corner && t.type !== "start") || gov ? "#ffffff" : "#3b2a1a";

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);
  // tekstur kertas halus
  ctx.fillStyle = "rgba(0,0,0,0.035)";
  for (let i = 0; i < 300; i++) ctx.fillRect((i * 97) % S, (i * 389) % S, 2, 2);

  // pita grup menghadap ke tengah papan
  if (t.group) {
    ctx.fillStyle = GROUP_COLOR[t.group] ?? "#999";
    const b = 50;
    const { row, col } = tileCell(t.index);
    if (row === 10) ctx.fillRect(0, 0, S, b);
    else if (row === 0) ctx.fillRect(0, S - b, S, b);
    else if (col === 0) ctx.fillRect(S - b, 0, b, S);
    else ctx.fillRect(0, 0, b, S);
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${corner ? 104 : 84}px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  // Paksa tampilan emoji berwarna (\uFE0F); kalau perangkat hanya punya glyph hitam-putih,
  // tetap terlihat karena warnanya diset gelap.
  ctx.fillStyle = fg;
  ctx.fillText(tileEmoji(t).replace(/\uFE0F/g, "") + "\uFE0F", S / 2, corner ? 100 : 108);

  ctx.fillStyle = fg;
  ctx.font = `800 ${corner ? 30 : 27}px Nunito, sans-serif`;
  const lines = wrapText(ctx, t.name, S - 36);
  lines.forEach((l, i) => ctx.fillText(l, S / 2, (corner ? 190 : 176) + i * 30));

  if (t.price) {
    ctx.font = "900 24px Nunito, sans-serif";
    ctx.fillStyle = corner ? fg : "#9c6b3c";
    ctx.fillText(`₵${t.price}`, S / 2, 236);
  }

  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, S - 6, S - 6);
  return texture(c);
}

/** Tekstur tengah papan: batik kawung + judul. */
export function centerTexture(): THREE.CanvasTexture {
  const S = 1024;
  const [c, ctx] = canvas(S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 80, S / 2, S / 2, S * 0.7);
  g.addColorStop(0, "#fff7e3");
  g.addColorStop(1, "#ecd29f");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);

  // kawung
  ctx.strokeStyle = "rgba(160, 82, 45, 0.18)";
  ctx.lineWidth = 3;
  const step = S / 9;
  for (let x = 0; x <= S; x += step) {
    for (let y = 0; y <= S; y += step) {
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2 + Math.PI / 4;
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * step * 0.22, y + Math.sin(a) * step * 0.22, step * 0.16, step * 0.1, a, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = '150px "Lilita One", Nunito, sans-serif';
  ctx.fillStyle = "#e63946";
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowOffsetX = 6;
  ctx.shadowOffsetY = 8;
  ctx.fillText("NEGERI", S / 2, S * 0.5);
  ctx.font = '230px "Lilita One", Nunito, sans-serif';
  ctx.fillStyle = "#5c3a1a";
  ctx.shadowColor = "#ffc94d";
  ctx.shadowOffsetX = 8;
  ctx.shadowOffsetY = 8;
  ctx.fillText("WKWK", S / 2, S * 0.66);
  ctx.shadowColor = "transparent";
  ctx.font = "800 40px Nunito, sans-serif";
  ctx.fillStyle = "#7a4f27";
  ctx.fillText("Rakyat bersatu melawan sistem", S / 2, S * 0.78);

  ctx.strokeStyle = "#c9a066";
  ctx.lineWidth = 14;
  ctx.strokeRect(10, 10, S - 20, S - 20);
  return texture(c);
}

/** Muka dadu dengan titik. */
export function dieFaceTexture(value: number): THREE.CanvasTexture {
  const S = 128;
  const [c, ctx] = canvas(S);
  ctx.fillStyle = "#fbf8ff";
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = "#ddd5ea";
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, S - 8, S - 8);
  const a = 0.27;
  const b = 0.5;
  const d = 0.73;
  const spots: number[][] = [
    [],
    [b, b],
    [a, a, d, d],
    [a, a, b, b, d, d],
    [a, a, d, a, a, d, d, d],
    [a, a, d, a, b, b, a, d, d, d],
    [a, a, d, a, a, b, d, b, a, d, d, d],
  ];
  ctx.fillStyle = value === 1 ? "#e63946" : "#1b1035";
  const r = value === 1 ? 17 : 12;
  const s = spots[value];
  for (let i = 0; i < s.length; i += 2) {
    ctx.beginPath();
    ctx.arc(s[i] * S, s[i + 1] * S, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return texture(c);
}

/** Label nama di atas pion (sprite). */
export function labelTexture(text: string, color: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.font = "900 30px Nunito, sans-serif";
  const w = Math.min(248, ctx.measureText(text).width + 28);
  ctx.fillStyle = "rgba(23,14,46,0.85)";
  const x = (256 - w) / 2;
  ctx.beginPath();
  ctx.roundRect(x, 8, w, 48, 24);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 33);
  return texture(c);
}
