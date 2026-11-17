// Helper inti: data papan, transfer uang, talangan, bangkrut, meter, dan akhir game.
import board from "../board.json" with { type: "json" };
import * as R from "./rules.ts";
import type { GameEvent, GameResult, GameState, Jalur, PlayerState, Rng, TileDef } from "./types.ts";
import { GOV } from "./types.ts";

export const TILES: TileDef[] = (board as { tiles: TileDef[] }).tiles;
export const GROUPS: string[] = [...new Set(TILES.filter((t) => t.group).map((t) => t.group!))];

export interface Ctx {
  s: GameState;
  events: GameEvent[];
  rng: Rng;
  /** pemain yang mendapat poin jasa dari efek yang sedang diproses (null = tidak ada) */
  oleh: string | null;
}

/** Tambah poin jasa (penentu MVP) untuk seorang pemain. */
export function jasa(ctx: Ctx, id: string | null, poin: number): void {
  const p = id ? ctx.s.players[id] : undefined;
  if (p && !p.bankrupt && poin > 0) p.jasa += Math.round(poin);
}

/** Pihak dalam transaksi: id pemain, bank, Rezim, atau Lumbung Bersama. */
export type Party = string;
export const BANK = "bank";
export const LUMBUNG = "lumbung";

export const coop = (s: GameState): boolean => s.mode === "rakyat_bersatu";

/** Pengali pungutan Rezim: naik saat Rezim panik. */
export function panik(s: GameState): number {
  return (coop(s) && s.kekuasaan <= batasPanik(s) ? R.PANIK_PENGALI : 1) * R.pungutanBabak(s.level);
}

export function batasPanik(s: GameState): number {
  return Math.round(s.kekuasaanMaks * R.PANIK_DI);
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

export const isRakyat = (s: GameState, owner: string | null): boolean =>
  owner !== null && owner !== GOV && !!s.players[owner];

/** Grup warna ini seluruhnya dipegang rakyat (boleh beda-beda orang di mode Rakyat Bersatu). */
export function kampungMandiri(s: GameState, group: string | undefined): boolean {
  if (!group) return false;
  const owners = groupTiles(group).map((i) => s.tiles[i].owner);
  if (!owners.every((o) => isRakyat(s, o))) return false;
  return coop(s) || owners.every((o) => o === owners[0]);
}

/**
 * Pindahkan uang. Pemain boleh minus sementara; setelah itu ditalangi/dicek bangkrut.
 * Lumbung tidak bisa minus. Mengembalikan jumlah yang benar-benar dipindahkan.
 */
export function transfer(ctx: Ctx, from: Party, to: Party, amount: number): number {
  const s = ctx.s;
  let paid = Math.max(0, Math.round(amount));
  if (paid === 0 || from === to) return 0;

  if (from === LUMBUNG) {
    paid = Math.min(paid, s.lumbung);
    s.lumbung -= paid;
  } else if (from !== BANK && from !== GOV) {
    const p = player(s, from);
    if (p.bankrupt) return 0;
    p.cuan -= paid;
  }

  if (to === LUMBUNG) s.lumbung += paid;
  else if (to !== BANK && to !== GOV) {
    const p = player(s, to);
    if (!p.bankrupt) p.cuan += paid;
  }

  if (from !== LUMBUNG && from !== GOV && from !== BANK) settle(ctx, from);
  return paid;
}

/** Uang minus: Lumbung menalangi dulu, lalu jual rugi usaha, kalau masih kurang ya bangkrut. */
export function settle(ctx: Ctx, id: string): void {
  const s = ctx.s;
  const p = player(s, id);
  if (p.bankrupt || p.cuan >= 0) return;

  if (coop(s) && s.lumbung > 0) {
    const bantuan = Math.min(-p.cuan, s.lumbung);
    s.lumbung -= bantuan;
    p.cuan += bantuan;
    emit(ctx, { type: "talangan", actor: id, payload: { jumlah: bantuan } });
  }

  while (p.cuan < 0) {
    // Jual usaha yang paling murah dulu.
    let idx = -1;
    let nilai = Infinity;
    s.tiles.forEach((t, i) => {
      if (t.owner !== id) return;
      const v = (TILES[i].price ?? 0) * (1 + t.level * R.BIAYA_UPGRADE);
      if (v < nilai) {
        nilai = v;
        idx = i;
      }
    });
    if (idx < 0) break;
    const dapat = R.bulat(nilai * R.JUAL_RUGI);
    s.tiles[idx] = { owner: null, level: 0 };
    p.cuan += dapat;
    emit(ctx, { type: "jual_rugi", actor: id, payload: { tile: idx, dapat } });
  }

  if (p.cuan < 0) declareBankrupt(ctx, id);
}

export function declareBankrupt(ctx: Ctx, id: string): void {
  const s = ctx.s;
  const p = player(s, id);
  if (p.bankrupt) return;
  p.bankrupt = true;
  p.cuan = 0;
  p.jailTurns = 0;
  emit(ctx, { type: "bangkrut", actor: id, payload: {} });
  if (isOver(s)) return;

  // Buzzer yang sudah diusir tidak dihitung sebagai warga yang tumbang.
  const bangkrut = s.order.filter((pid) => s.players[pid].bankrupt && !s.players[pid].buzzer).length;
  const alive = alivePlayers(s);
  if (coop(s)) {
    addSemangat(ctx, -R.PENALTI_BANGKRUT_SEMANGAT, "warga_bangkrut");
    // Kalah kalau 2 warga tumbang, atau tidak ada lagi pemain manusia yang bertahan.
    const adaManusia = s.order.some((pid) => !s.players[pid].bot);
    const manusiaHidup = alive.some((x) => !x.bot);
    if (bangkrut >= R.BATAS_BANGKRUT_KALAH || alive.length === 0 || (adaManusia && !manusiaHidup)) {
      endGame(ctx, { kind: "rakyat_kalah", reason: "bangkrut" });
    }
  } else if (alive.length === 1) {
    endGame(ctx, { kind: "juragan_menang", winner: alive[0].id });
  }
}

export function endGame(ctx: Ctx, result: GameResult): void {
  if (isOver(ctx.s)) return;
  ctx.s.result = result;
  ctx.s.phase = "game_over";
  ctx.s.pendingTile = null;
  emit(ctx, { type: "game_selesai", payload: { ...result } });
}

/** Kurangi Kekuasaan Rezim. Habis = rakyat menang. */
export function hitRezim(ctx: Ctx, damage: number, alasan: string): void {
  const s = ctx.s;
  if (!coop(s) || isOver(s) || damage <= 0) return;
  const dari = s.kekuasaan;
  s.kekuasaan = Math.max(0, dari - Math.round(damage));
  emit(ctx, { type: "kekuasaan", payload: { dari, ke: s.kekuasaan, alasan } });
  // Serangan langsung dihargai 3 poin jasa per Kekuasaan; pemantik Demo Akbar dapat bonus kecil.
  jasa(ctx, ctx.oleh, alasan === "demo_akbar" ? 6 : (dari - s.kekuasaan) * 3);
  if (dari > batasPanik(s) && s.kekuasaan <= batasPanik(s) && s.kekuasaan > 0) {
    emit(ctx, { type: "rezim_panik", payload: {} });
  }
  if (s.kekuasaan <= 0) endGame(ctx, { kind: "rakyat_menang" });
}

/** Rezim memulihkan sebagian Kekuasaannya. */
export function healRezim(ctx: Ctx, amount: number, alasan: string): void {
  const s = ctx.s;
  if (!coop(s) || isOver(s) || amount <= 0) return;
  const dari = s.kekuasaan;
  s.kekuasaan = Math.min(s.kekuasaanMaks, dari + amount);
  if (s.kekuasaan !== dari) emit(ctx, { type: "kekuasaan", payload: { dari, ke: s.kekuasaan, alasan } });
}

/**
 * Ubah meter Semangat Demo. Penuh = Demo Akbar.
 * `perGiliran`: sumber yang terjadi tiap giliran pemain (pungli, sewa, petisi) diskalakan
 * dengan jumlah pemain supaya tempo permainan mirip untuk 2 sampai 6 pemain.
 */
export function addSemangat(ctx: Ctx, delta: number, alasan: string, perGiliran = false): void {
  const s = ctx.s;
  if (!coop(s) || isOver(s) || delta === 0) return;
  const d = perGiliran && delta > 0 ? Math.max(1, Math.round((delta * 4) / s.order.length)) : delta;
  const dari = s.semangat;
  s.semangat = Math.max(0, Math.min(R.SEMANGAT_PENUH, dari + d));
  if (s.semangat === dari) return;
  if (d > 0) jasa(ctx, ctx.oleh, d);
  emit(ctx, { type: "semangat", payload: { dari, ke: s.semangat, alasan } });
  if (s.semangat >= R.SEMANGAT_PENUH) {
    const mahasiswa = alivePlayers(s).filter((p) => p.profession === "mahasiswa").length;
    const damage = R.DEMO_DAMAGE + mahasiswa * R.MAHASISWA_BONUS_DEMO;
    s.semangat = 0;
    s.demoCount += 1;
    emit(ctx, { type: "demo_akbar", payload: { damage, ke: s.demoCount } });
    hitRezim(ctx, damage, "demo_akbar");
  }
}

/** Pungutan ke Rezim (pajak, pungli, kebijakan). Mengembalikan jumlah yang dibayar. */
export function pungut(ctx: Ctx, id: string, amount: number): number {
  return transfer(ctx, id, GOV, R.bulat(amount * panik(ctx.s)));
}

export function sendToJail(ctx: Ctx, id: string, reason: string): void {
  const p = player(ctx.s, id);
  if (p.bankrupt) return;
  const dari = p.position;
  p.position = R.JAIL_TILE;
  p.jailTurns = R.LAMA_TILANG;
  if (ctx.s.order[ctx.s.turn] === id) {
    ctx.s.rollAgain = false;
    ctx.s.doublesInRow = 0;
  }
  emit(ctx, { type: "kena_tilang", actor: id, payload: { alasan: reason, dari } });
}

/** Cek apakah sebuah grup baru saja jadi Kampung Mandiri (bonus sekali per grup). */
export function cekKampung(ctx: Ctx, group: string | undefined): void {
  const s = ctx.s;
  if (!group || !coop(s) || s.kampung.includes(group) || !kampungMandiri(s, group)) return;
  s.kampung.push(group);
  emit(ctx, { type: "kampung_mandiri", payload: { grup: group, damage: R.KAMPUNG_DAMAGE } });
  hitRezim(ctx, R.KAMPUNG_DAMAGE, "kampung_mandiri");
}

// ---------------------------------------------------------------------------
// Rumus harga (dipakai engine, bot, dan tampilan klien)
// ---------------------------------------------------------------------------

/** Harga beli petak kosong, atau harga merebutnya dari Rezim. */
export function hargaBeli(s: GameState, idx: number, jalur: Jalur = "resmi"): number {
  const price = TILES[idx].price ?? 0;
  // Merebut aset dari Rezim tidak bisa lewat pelicin.
  if (s.tiles[idx].owner === GOV) return R.bulat(price * R.REBUT_PENGALI);
  return R.bulat(price * (jalur === "pelicin" ? R.HARGA_PELICIN : R.IZIN_RESMI));
}

export function biayaUpgrade(idx: number, jalur: Jalur = "resmi"): number {
  const dasar = (TILES[idx].price ?? 0) * R.BIAYA_UPGRADE;
  return R.bulat(dasar * (jalur === "pelicin" ? R.HARGA_PELICIN : R.IZIN_RESMI));
}

/** Uang pelicin ketahuan: denda, ditahan, dan urusannya batal. Mengembalikan true kalau kena. */
export function kenaOTT(ctx: Ctx, id: string): boolean {
  if (ctx.rng.int(1, 100) > R.PELUANG_OTT * 100) return false;
  emit(ctx, { type: "ott", actor: id, payload: { denda: R.DENDA_OTT } });
  transfer(ctx, id, GOV, R.DENDA_OTT);
  if (!player(ctx.s, id).bankrupt) sendToJail(ctx, id, "ott");
  return true;
}

/** Sewa penuh sebuah usaha rakyat pada level sekarang. */
export function sewaUsaha(s: GameState, idx: number, level = s.tiles[idx].level): number {
  const def = TILES[idx];
  const kampung = kampungMandiri(s, def.group) ? R.BONUS_KAMPUNG : 1;
  return R.bulat((def.price ?? 0) * R.SEWA[level] * kampung);
}

/** Omzet sebuah usaha tiap pemiliknya gajian. */
export function omzetUsaha(s: GameState, idx: number, level = s.tiles[idx].level): number {
  const def = TILES[idx];
  const owner = s.tiles[idx].owner;
  const kampung = kampungMandiri(s, def.group) ? R.BONUS_KAMPUNG : 1;
  const pedagang = owner && s.players[owner]?.profession === "pedagang" ? R.PEDAGANG_BONUS_OMZET : 1;
  return R.bulat((def.price ?? 0) * R.OMZET[level] * kampung * pedagang);
}

/** Pungli yang harus dibayar kalau mendarat di aset Rezim ini. */
export function pungliAset(s: GameState, idx: number): number {
  return R.bulat((TILES[idx].price ?? 0) * R.PUNGLI_ASET[s.tiles[idx].level] * panik(s));
}
