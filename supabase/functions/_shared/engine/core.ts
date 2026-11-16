// Helper inti: data papan, transfer Cuan, bangkrut, meter, dan akhir game.
import board from "../board.json" with { type: "json" };
import {
  BATAS_BANGKRUT_KALAH,
  GERAKAN_MENANG,
  JAIL_TILE,
  LAMA_TILANG,
  PENALTI_BANGKRUT,
  inflationMultiplier,
} from "./rules.ts";
import type {
  GameEvent,
  GameResult,
  GameState,
  PlayerState,
  Rng,
  TileDef,
} from "./types.ts";
import { GOV } from "./types.ts";

export const TILES: TileDef[] = (board as { tiles: TileDef[] }).tiles;

export interface Ctx {
  s: GameState;
  events: GameEvent[];
  rng: Rng;
}

/** Pihak dalam transaksi: id pemain, bank, Pemerintah, atau Lumbung Bersama. */
export type Party = string;
export const BANK = "bank";
export const LUMBUNG = "lumbung";

export function mult(s: GameState): number {
  return inflationMultiplier(s.inflationLevel);
}

export function emit(ctx: Ctx, ev: GameEvent): void {
  ctx.events.push(ev);
}

export function player(s: GameState, id: string): PlayerState {
  const p = s.players[id];
  if (!p) throw new Error(`pemain tidak dikenal: ${id}`);
  return p;
}

export function currentPlayer(s: GameState): PlayerState {
  return player(s, s.order[s.turn]);
}

export function alivePlayers(s: GameState): PlayerState[] {
  return s.order.map((id) => s.players[id]).filter((p) => !p.bankrupt);
}

export function pickRandom<T>(rng: Rng, items: readonly T[]): T {
  return items[rng.int(0, items.length - 1)];
}

export function groupTiles(group: string): number[] {
  return TILES.filter((t) => t.group === group).map((t) => t.index);
}

export function isOver(s: GameState): boolean {
  return s.phase === "game_over";
}

/**
 * Pindahkan Cuan. Pemain boleh minus sementara; setelah itu dicek bangkrut.
 * Lumbung tidak bisa minus, jadi yang dibayar bisa lebih kecil dari permintaan.
 * Mengembalikan jumlah yang benar-benar dipindahkan.
 */
export function transfer(ctx: Ctx, from: Party, to: Party, amount: number): number {
  const s = ctx.s;
  let paid = Math.max(0, Math.round(amount));
  if (paid === 0 || from === to) return 0;

  if (from === LUMBUNG) {
    paid = Math.min(paid, s.lumbung);
    s.lumbung -= paid;
  } else if (from === GOV) {
    s.kasPemerintah -= paid;
  } else if (from !== BANK) {
    const p = player(s, from);
    if (p.bankrupt) return 0;
    p.cuan -= paid;
  }

  if (to === LUMBUNG) s.lumbung += paid;
  else if (to === GOV) s.kasPemerintah += paid;
  else if (to !== BANK) {
    const p = player(s, to);
    if (!p.bankrupt) p.cuan += paid;
  }

  if (from !== LUMBUNG && from !== GOV && from !== BANK) settle(ctx, from);
  return paid;
}

/** Kalau Cuan minus: pakai Tabungan Darurat dulu, kalau masih kurang ya bangkrut. */
export function settle(ctx: Ctx, id: string): void {
  const p = player(ctx.s, id);
  if (p.bankrupt || p.cuan >= 0) return;
  const need = -p.cuan;
  const fromSavings = Math.min(need, p.tabungan);
  if (fromSavings > 0) {
    p.tabungan -= fromSavings;
    p.cuan += fromSavings;
    emit(ctx, {
      type: "tabungan_menyelamatkan",
      actor: id,
      payload: { jumlah: fromSavings },
    });
  }
  if (p.cuan < 0) declareBankrupt(ctx, id);
}

export function declareBankrupt(ctx: Ctx, id: string): void {
  const s = ctx.s;
  const p = player(s, id);
  if (p.bankrupt) return;
  p.bankrupt = true;
  p.cuan = 0;
  p.tabungan = 0;
  p.jailTurns = 0;
  for (const t of s.tiles) {
    if (t.owner === id) {
      t.owner = null;
      t.level = 0;
    }
  }
  emit(ctx, { type: "bangkrut", actor: id, payload: {} });

  if (isOver(s)) return;
  if (s.mode === "rakyat_bersatu") {
    changeGerakan(ctx, -PENALTI_BANGKRUT, "pemain_bangkrut");
    const bangkrut = s.order.filter((pid) => s.players[pid].bankrupt).length;
    if (bangkrut >= BATAS_BANGKRUT_KALAH) {
      endGame(ctx, { kind: "rakyat_kalah", reason: "dua_bangkrut" });
    }
  } else {
    const alive = alivePlayers(s);
    if (alive.length === 1) endGame(ctx, { kind: "juragan_menang", winner: alive[0].id });
  }
}

export function endGame(ctx: Ctx, result: GameResult): void {
  if (isOver(ctx.s)) return;
  ctx.s.result = result;
  ctx.s.phase = "game_over";
  ctx.s.pendingTile = null;
  emit(ctx, { type: "game_selesai", payload: { ...result } });
}

export function changeGerakan(ctx: Ctx, delta: number, reason: string): void {
  const s = ctx.s;
  if (s.mode !== "rakyat_bersatu" || isOver(s)) return;
  const before = s.gerakan;
  s.gerakan = Math.max(0, Math.min(GERAKAN_MENANG, s.gerakan + delta));
  emit(ctx, {
    type: "meter_gerakan",
    payload: { dari: before, ke: s.gerakan, alasan: reason },
  });
  if (s.gerakan >= GERAKAN_MENANG) endGame(ctx, { kind: "rakyat_menang" });
}

export function changeKesabaran(ctx: Ctx, delta: number): void {
  ctx.s.kesabaran = Math.max(0, Math.min(100, ctx.s.kesabaran + delta));
}

export function sendToJail(ctx: Ctx, id: string, reason: string): void {
  const p = player(ctx.s, id);
  p.position = JAIL_TILE;
  p.jailTurns = LAMA_TILANG;
  ctx.s.rollAgain = false;
  ctx.s.doublesInRow = 0;
  emit(ctx, { type: "kena_tilang", actor: id, payload: { alasan: reason } });
}
