// Engine giliran Negeri Wkwk v2.
// Fungsi murni: (state, aksi, rng) -> state baru + daftar event.
// Dipanggil server (main online) dan klien (main solo), jadi aturannya satu sumber.
import { GRUP_WA, KEBIJAKAN, NASIB_WNI, type CardDef } from "./cards.ts";
import {
  BANK,
  LUMBUNG,
  TILES,
  type Ctx,
  addSemangat,
  alivePlayers,
  biayaUpgrade,
  cekKampung,
  coop,
  currentPlayer,
  emit,
  endGame,
  hargaBeli,
  hitRezim,
  isOver,
  isRakyat,
  omzetUsaha,
  pickRandom,
  pungliAset,
  pungut,
  sendToJail,
  sewaUsaha,
  transfer,
} from "./core.ts";
import * as R from "./rules.ts";
import {
  GOV,
  GameError,
  PROFESSIONS,
  type Action,
  type GameEvent,
  type GameState,
  type MemberInput,
  type Mode,
  type PlayerSecret,
  type PlayerState,
  type Rng,
} from "./types.ts";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export function createInitialState(
  roomId: string,
  mode: Mode,
  members: MemberInput[],
  rng: Rng,
): GameState {
  if (members.length < 2 || members.length > 6) {
    throw new GameError("jumlah_pemain", "Butuh 2 sampai 6 pemain.");
  }
  const sorted = [...members].sort((a, b) => a.seat - b.seat);
  const players: Record<string, PlayerState> = {};
  for (const m of sorted) {
    players[m.id] = {
      id: m.id,
      name: m.name,
      seat: m.seat,
      profession: m.profession ?? pickRandom(rng, PROFESSIONS),
      position: R.START_TILE,
      cuan: R.START_CUAN,
      jailTurns: 0,
      skipNext: false,
      bankrupt: false,
      ...(m.bot ? { bot: true } : {}),
    };
  }

  const tiles = TILES.map(() => ({ owner: null as string | null, level: 0 }));
  // Pedagang mulai dengan satu lapak gratis (yang paling murah dan masih kosong).
  for (const m of sorted) {
    if (players[m.id].profession !== "pedagang") continue;
    const free = TILES.find((t) => t.type === "property" && tiles[t.index].owner === null);
    if (free) tiles[free.index].owner = m.id;
  }

  return {
    schema: 2,
    roomId,
    mode,
    round: 1,
    maxRounds: R.MAX_ROUNDS,
    order: sorted.map((m) => m.id),
    turn: 0,
    players,
    tiles,
    kekuasaan: R.KEKUASAAN_AWAL[sorted.length],
    kekuasaanMaks: R.KEKUASAAN_AWAL[sorted.length],
    semangat: 0,
    demoCount: 0,
    lumbung: 0,
    rezimPos: R.BOARD_SIZE / 2,
    kampung: [],
    phase: "awaiting_roll",
    pendingTile: null,
    lastDice: null,
    doublesInRow: 0,
    rollAgain: false,
    aksiDipakai: false,
    result: null,
    lastEvents: [],
  };
}

/** Bagikan peran rahasia. Buzzer hanya di mode Rakyat Bersatu dengan 5+ pemain. */
export function assignSecrets(mode: Mode, playerIds: string[], rng: Rng): PlayerSecret[] {
  const buzzer =
    mode === "rakyat_bersatu" && playerIds.length >= R.MIN_PEMAIN_BUZZER
      ? pickRandom(rng, playerIds)
      : null;
  return playerIds.map((id) => ({
    userId: id,
    role: id === buzzer ? "buzzer" : "rakyat",
    mimpi: pickRandom(rng, R.MIMPI),
  }));
}

// ---------------------------------------------------------------------------
// Aksi
// ---------------------------------------------------------------------------

export interface ActionResult {
  state: GameState;
  events: GameEvent[];
}

export function applyAction(state: GameState, actorId: string, action: Action, rng: Rng): ActionResult {
  const s: GameState = structuredClone(state);
  const ctx: Ctx = { s, events: [], rng };

  if (s.schema !== 2) throw new GameError("game_lama", "Game ini dari versi lama. Bikin room baru ya.");
  if (isOver(s)) throw new GameError("game_selesai", "Permainan sudah selesai.");
  const actor = s.players[actorId];
  if (!actor) throw new GameError("bukan_pemain", "Kamu bukan pemain di room ini.");
  if (actor.bankrupt) throw new GameError("bangkrut", "Kamu sudah bangkrut.");
  if (s.order[s.turn] !== actorId) throw new GameError("bukan_giliran", "Belum giliranmu.");

  switch (action.type) {
    case "roll":
      requirePhase(s, "awaiting_roll");
      doRoll(ctx, actor);
      break;
    case "buy":
      requirePhase(s, "awaiting_buy");
      doBuy(ctx, actor);
      break;
    case "skip_buy":
      requirePhase(s, "awaiting_buy");
      emit(ctx, { type: "lewati_beli", actor: actor.id, payload: { tile: s.pendingTile } });
      finishResolution(ctx);
      break;
    case "bayar_denda":
      requirePhase(s, "awaiting_roll");
      doPayFine(ctx, actor);
      break;
    case "upgrade":
      requirePhase(s, "awaiting_roll", "awaiting_end");
      doUpgrade(ctx, actor, action.tile);
      break;
    case "donasi_lumbung":
      requirePhase(s, "awaiting_roll", "awaiting_end");
      doDonasi(ctx, actor, action.amount);
      break;
    case "petisi":
      requirePhase(s, "awaiting_roll", "awaiting_end");
      doPetisi(ctx, actor);
      break;
    case "liputan_media":
      requirePhase(s, "awaiting_roll", "awaiting_end");
      doLiputan(ctx, actor);
      break;
    case "end_turn":
      requirePhase(s, "awaiting_end");
      advanceTurn(ctx);
      break;
    default:
      throw new GameError("aksi_tidak_dikenal", "Aksi tidak dikenal.");
  }

  // Kalau pemain yang sedang jalan bangkrut di tengah giliran, lanjut ke pemain berikutnya.
  if (!isOver(s) && currentPlayer(s).bankrupt) advanceTurn(ctx);

  s.lastEvents = ctx.events.filter((e) => !e.visibleTo);
  return { state: s, events: ctx.events };
}

function requirePhase(s: GameState, ...phases: GameState["phase"][]): void {
  if (!phases.includes(s.phase)) {
    throw new GameError("fase_salah", `Aksi tidak bisa dilakukan saat fase ${s.phase}.`);
  }
}

// ---------------------------------------------------------------------------
// Dadu & gerak
// ---------------------------------------------------------------------------

function doRoll(ctx: Ctx, p: PlayerState): void {
  const s = ctx.s;

  if (p.skipNext) {
    p.skipNext = false;
    emit(ctx, { type: "lewati_giliran", actor: p.id, payload: {} });
    s.phase = "awaiting_end";
    return;
  }

  const dice: [number, number] = [ctx.rng.int(1, 6), ctx.rng.int(1, 6)];
  const isDouble = dice[0] === dice[1];
  s.lastDice = dice;
  emit(ctx, { type: "dadu", actor: p.id, payload: { dadu: dice } });

  if (p.jailTurns > 0) {
    if (!isDouble) {
      p.jailTurns -= 1;
      emit(ctx, { type: "masih_ditilang", actor: p.id, payload: { sisa: p.jailTurns } });
      s.phase = "awaiting_end";
      return;
    }
    p.jailTurns = 0;
    emit(ctx, { type: "bebas_tilang", actor: p.id, payload: {} });
    // Keluar dari tilang dengan dadu kembar tidak dapat lempar ulang.
    move(ctx, p, dice[0] + dice[1], false);
    return;
  }

  if (isDouble) {
    s.doublesInRow += 1;
    if (s.doublesInRow >= R.MAX_DADU_KEMBAR) {
      sendToJail(ctx, p.id, "kebut_kebutan");
      s.phase = "awaiting_end";
      return;
    }
  } else {
    s.doublesInRow = 0;
  }

  move(ctx, p, dice[0] + dice[1], isDouble);
}

function move(ctx: Ctx, p: PlayerState, steps: number, rollAgain: boolean): void {
  const s = ctx.s;
  const from = p.position;
  const to = (from + steps) % R.BOARD_SIZE;
  p.position = to;
  s.rollAgain = rollAgain;
  emit(ctx, { type: "gerak", actor: p.id, payload: { dari: from, ke: to } });

  if (from + steps >= R.BOARD_SIZE) payday(ctx, p);
  if (p.profession === "ojol") {
    const tip = transfer(ctx, BANK, p.id, R.OJOL_TIP);
    emit(ctx, { type: "tip_ojol", actor: p.id, payload: { jumlah: tip } });
  }

  if (p.bankrupt || isOver(s)) return;
  resolveTile(ctx, p);
}

/** Lewat petak Gajian: gaji + omzet semua usaha, dipotong iuran Lumbung. */
function payday(ctx: Ctx, p: PlayerState): void {
  const s = ctx.s;
  const gaji = R.GAJI[p.profession];
  let omzet = 0;
  s.tiles.forEach((t, i) => {
    if (t.owner === p.id) omzet += omzetUsaha(s, i);
  });
  const iuran = coop(s) ? R.bulat(gaji * R.IURAN_LUMBUNG) : 0;
  transfer(ctx, BANK, p.id, gaji + omzet - iuran);
  transfer(ctx, BANK, LUMBUNG, iuran);
  emit(ctx, { type: "gajian", actor: p.id, payload: { gaji, omzet, iuran } });
}

// ---------------------------------------------------------------------------
// Efek petak
// ---------------------------------------------------------------------------

function resolveTile(ctx: Ctx, p: PlayerState): void {
  const s = ctx.s;
  const idx = p.position;
  const def = TILES[idx];
  const tile = s.tiles[idx];

  switch (def.type) {
    case "property": {
      if (tile.owner === null) {
        if (offerBuy(ctx, p, idx, false)) return;
      } else if (tile.owner === p.id) {
        const bonus = transfer(ctx, BANK, p.id, omzetUsaha(s, idx));
        emit(ctx, { type: "mampir_sendiri", actor: p.id, payload: { tile: idx, jumlah: bonus } });
      } else if (tile.owner === GOV) {
        const paid = transfer(ctx, p.id, GOV, pungliAset(s, idx));
        emit(ctx, { type: "pungli", actor: p.id, payload: { tile: idx, jumlah: paid, alasan: "aset_rezim" } });
        addSemangat(ctx, R.SEMANGAT_PUNGLI, "pungli", true);
        if (!p.bankrupt && !isOver(s) && offerBuy(ctx, p, idx, true)) return;
      } else {
        payRent(ctx, p, idx);
      }
      break;
    }
    case "gov_seat":
    case "tax": {
      const paid = pungut(ctx, p.id, def.amount ?? 0);
      emit(ctx, {
        type: "pungli",
        actor: p.id,
        payload: { tile: idx, jumlah: paid, alasan: def.type === "tax" ? "pajak" : "kursi" },
      });
      addSemangat(ctx, R.SEMANGAT_PUNGLI, "pungli", true);
      break;
    }
    case "card_nasib":
      drawCard(ctx, p, NASIB_WNI, "nasib_wni");
      break;
    case "card_wa":
      drawCard(ctx, p, GRUP_WA, "grup_wa");
      break;
    case "go_to_jail":
      sendToJail(ctx, p.id, "diciduk");
      break;
    case "demo": {
      emit(ctx, { type: "titik_demo", actor: p.id, payload: {} });
      if (coop(s)) addSemangat(ctx, R.SEMANGAT_TITIK_DEMO, "titik_demo", true);
      else transfer(ctx, BANK, p.id, 500_000);
      break;
    }
    case "lumbung": {
      const jumlah = coop(s)
        ? transfer(ctx, BANK, LUMBUNG, R.GOTONG_ROYONG)
        : transfer(ctx, BANK, p.id, 500_000);
      emit(ctx, { type: "gotong_royong", actor: p.id, payload: { jumlah } });
      break;
    }
    case "start":
    case "jail":
      break;
  }

  finishResolution(ctx);
}

/** Tawarkan beli/rebut kalau uangnya cukup. Mengembalikan true kalau menunggu keputusan pemain. */
function offerBuy(ctx: Ctx, p: PlayerState, idx: number, rebut: boolean): boolean {
  const s = ctx.s;
  const harga = hargaBeli(s, idx);
  if (p.cuan < harga) {
    if (!rebut) emit(ctx, { type: "tak_mampu_beli", actor: p.id, payload: { tile: idx, harga } });
    return false;
  }
  s.pendingTile = idx;
  s.phase = "awaiting_buy";
  emit(ctx, { type: "tawaran_beli", actor: p.id, payload: { tile: idx, harga, rebut } });
  return true;
}

function payRent(ctx: Ctx, p: PlayerState, idx: number): void {
  const s = ctx.s;
  const owner = s.tiles[idx].owner!;
  // Di mode Rakyat Bersatu sesama warga pakai "harga tetangga": separuh sewa.
  const amount = R.bulat(sewaUsaha(s, idx) * (coop(s) ? 0.5 : 1));
  const paid = transfer(ctx, p.id, owner, amount);
  emit(ctx, { type: "bayar_sewa", actor: p.id, payload: { tile: idx, ke: owner, jumlah: paid } });
  addSemangat(ctx, R.SEMANGAT_SEWA, "produk_lokal", true);
}

function drawCard(ctx: Ctx, p: PlayerState, deck: CardDef[], deckName: string): void {
  const card = pickRandom(ctx.rng, deck);
  emit(ctx, {
    type: "kartu",
    actor: p.id,
    payload: { dek: deckName, id: card.id, judul: card.judul, teks: card.teks, baik: card.baik },
  });
  card.apply(ctx, p.id);
}

/** Setelah petak selesai diproses: lempar lagi kalau dadu kembar, atau tunggu akhiri giliran. */
function finishResolution(ctx: Ctx): void {
  const s = ctx.s;
  s.pendingTile = null;
  if (isOver(s)) return;
  const p = currentPlayer(s);
  s.phase = s.rollAgain && !p.bankrupt && p.jailTurns === 0 ? "awaiting_roll" : "awaiting_end";
  s.rollAgain = false;
}

// ---------------------------------------------------------------------------
// Aksi ekonomi & perlawanan
// ---------------------------------------------------------------------------

function doBuy(ctx: Ctx, p: PlayerState): void {
  const s = ctx.s;
  const idx = s.pendingTile!;
  const tile = s.tiles[idx];
  const rebut = tile.owner === GOV;
  const harga = hargaBeli(s, idx);
  if (p.cuan < harga) throw new GameError("uang_kurang", "Uangmu nggak cukup.");
  transfer(ctx, p.id, rebut ? GOV : BANK, harga);
  tile.owner = p.id; // bangunan Rezim ikut jadi milikmu kalau direbut
  emit(ctx, { type: "beli", actor: p.id, payload: { tile: idx, harga, rebut } });
  addSemangat(ctx, R.SEMANGAT_BELI, rebut ? "rebut_aset" : "usaha_baru");
  if (rebut) hitRezim(ctx, R.REBUT_DAMAGE, "rebut_aset");
  cekKampung(ctx, TILES[idx].group);
  finishResolution(ctx);
}

function doPayFine(ctx: Ctx, p: PlayerState): void {
  if (p.jailTurns === 0) throw new GameError("tidak_ditilang", "Kamu nggak lagi ditilang.");
  const fine = R.bulat(R.DENDA_TILANG);
  if (p.cuan < fine) throw new GameError("uang_kurang", "Uangmu nggak cukup buat bayar denda.");
  transfer(ctx, p.id, GOV, fine);
  p.jailTurns = 0;
  emit(ctx, { type: "bayar_denda", actor: p.id, payload: { jumlah: fine } });
  addSemangat(ctx, R.SEMANGAT_PUNGLI, "pungli", true);
}

function doUpgrade(ctx: Ctx, p: PlayerState, idx: number): void {
  const s = ctx.s;
  const def = TILES[idx];
  if (!def || def.type !== "property") throw new GameError("bukan_usaha", "Petak ini bukan usaha.");
  const tile = s.tiles[idx];
  if (tile.owner !== p.id) throw new GameError("bukan_milikmu", "Usaha ini bukan milikmu.");
  if (tile.level >= R.MAX_LEVEL) throw new GameError("level_maks", "Usaha ini sudah Brand Lokal.");
  const cost = biayaUpgrade(idx);
  if (p.cuan < cost) throw new GameError("uang_kurang", "Uangmu nggak cukup buat upgrade.");
  transfer(ctx, p.id, BANK, cost);
  tile.level += 1;
  emit(ctx, { type: "upgrade", actor: p.id, payload: { tile: idx, level: tile.level, biaya: cost } });
  addSemangat(ctx, R.SEMANGAT_UPGRADE, "upgrade");
}

function doDonasi(ctx: Ctx, p: PlayerState, amount: number): void {
  if (!coop(ctx.s)) throw new GameError("mode_salah", "Lumbung hanya ada di mode Rakyat Bersatu.");
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new GameError("jumlah_tidak_valid", "Jumlah harus bilangan bulat positif.");
  }
  if (amount > p.cuan) throw new GameError("uang_kurang", "Uangmu nggak cukup.");
  transfer(ctx, p.id, LUMBUNG, amount);
  emit(ctx, { type: "donasi_lumbung", actor: p.id, payload: { jumlah: amount } });
}

function requireAksi(ctx: Ctx): void {
  if (!coop(ctx.s)) throw new GameError("mode_salah", "Aksi ini hanya ada di mode Rakyat Bersatu.");
  if (ctx.s.aksiDipakai) throw new GameError("aksi_sudah_dipakai", "Satu aksi perlawanan per giliran.");
}

function doPetisi(ctx: Ctx, p: PlayerState): void {
  requireAksi(ctx);
  if (p.cuan < R.PETISI_BIAYA) throw new GameError("uang_kurang", "Uangmu nggak cukup buat petisi.");
  ctx.s.aksiDipakai = true;
  transfer(ctx, p.id, BANK, R.PETISI_BIAYA);
  const gain = Math.round(R.SEMANGAT_PETISI * (p.profession === "kreator" ? R.KREATOR_PETISI : 1));
  emit(ctx, { type: "petisi", actor: p.id, payload: { semangat: gain } });
  addSemangat(ctx, gain, "petisi", true);
}

function doLiputan(ctx: Ctx, p: PlayerState): void {
  requireAksi(ctx);
  if (ctx.s.lumbung < R.LIPUTAN_BIAYA_LUMBUNG) {
    throw new GameError("lumbung_kurang", "Lumbung Bersama belum cukup buat danai liputan.");
  }
  ctx.s.aksiDipakai = true;
  transfer(ctx, LUMBUNG, BANK, R.LIPUTAN_BIAYA_LUMBUNG);
  const damage = R.LIPUTAN_DAMAGE + (p.profession === "jurnalis" ? R.JURNALIS_BONUS_LIPUTAN : 0);
  emit(ctx, { type: "liputan_media", actor: p.id, payload: { damage } });
  hitRezim(ctx, damage, "liputan_media");
}

// ---------------------------------------------------------------------------
// Giliran, ronde, dan giliran Rezim
// ---------------------------------------------------------------------------

function advanceTurn(ctx: Ctx): void {
  const s = ctx.s;
  if (isOver(s)) return;
  s.doublesInRow = 0;
  s.rollAgain = false;
  s.aksiDipakai = false;
  s.pendingTile = null;

  const n = s.order.length;
  let next = s.turn;
  for (let i = 0; i < n; i++) {
    next = (next + 1) % n;
    if (next === 0) {
      endRound(ctx);
      if (isOver(s)) return;
    }
    if (!s.players[s.order[next]].bankrupt) break;
  }
  s.turn = next;
  s.phase = "awaiting_roll";
  emit(ctx, { type: "giliran", actor: s.order[next], payload: { ronde: s.round } });
}

function endRound(ctx: Ctx): void {
  const s = ctx.s;
  rezimTurn(ctx);
  if (isOver(s)) return;

  s.round += 1;
  if (s.round > s.maxRounds) {
    if (coop(s)) {
      endGame(ctx, { kind: "rakyat_kalah", reason: "pemilu" });
    } else {
      const richest = [...alivePlayers(s)].sort((a, b) => netWorth(s, b) - netWorth(s, a))[0];
      endGame(ctx, { kind: "juragan_menang", winner: richest.id });
    }
    return;
  }
  emit(ctx, { type: "ronde_baru", payload: { ronde: s.round, sisa: s.maxRounds - s.round + 1 } });
}

/** Giliran Rezim tiap akhir ronde: satu Kebijakan, lalu mobil pejabat jalan. */
function rezimTurn(ctx: Ctx): void {
  const s = ctx.s;

  const card = pickRandom(ctx.rng, KEBIJAKAN);
  emit(ctx, {
    type: "kebijakan",
    payload: { id: card.id, judul: card.judul, teks: card.teks, baik: card.baik, jenis: card.jenis ?? "kebijakan" },
  });
  card.apply(ctx, "");
  if (isOver(s)) return;
  if (!card.meredam) addSemangat(ctx, R.SEMANGAT_KEBIJAKAN, "kebijakan");
  if (isOver(s)) return;

  const dadu: [number, number] = [ctx.rng.int(1, 6), ctx.rng.int(1, 6)];
  const dari = s.rezimPos;
  const ke = (dari + dadu[0] + dadu[1]) % R.BOARD_SIZE;
  s.rezimPos = ke;
  emit(ctx, { type: "rezim_gerak", payload: { dari, ke, dadu } });

  const def = TILES[ke];
  const tile = s.tiles[ke];
  if (def.type !== "property") return;
  if (tile.owner === null) {
    tile.owner = GOV;
    emit(ctx, { type: "rezim_caplok", payload: { tile: ke, dari: null, alasan: "mampir" } });
  } else if (tile.owner === GOV) {
    if (tile.level < R.MAX_LEVEL) {
      tile.level += 1;
      emit(ctx, { type: "rezim_upgrade", payload: { tile: ke, level: tile.level } });
    }
  } else if (isRakyat(s, tile.owner)) {
    const jumlah = transfer(ctx, BANK, tile.owner, sewaUsaha(s, ke));
    const damage = R.REZIM_KENA[tile.level];
    emit(ctx, { type: "rezim_bayar", payload: { tile: ke, ke: tile.owner, jumlah, damage } });
    hitRezim(ctx, damage, "rezim_mampir");
  }
}

export function netWorth(s: GameState, p: PlayerState): number {
  let total = p.cuan;
  s.tiles.forEach((t, idx) => {
    if (t.owner === p.id) {
      const price = TILES[idx].price ?? 0;
      total += price + t.level * price * R.BIAYA_UPGRADE;
    }
  });
  return total;
}
