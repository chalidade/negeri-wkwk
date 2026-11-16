// Engine giliran Negeri Wkwk.
// Fungsi murni: (state, aksi, rng) -> state baru + daftar event.
// Server (Edge Function) adalah satu-satunya yang memanggil ini, jadi klien tidak bisa curang.
import { GRUP_WA, KEBIJAKAN, NASIB_WNI, type CardDef } from "./cards.ts";
import {
  BANK,
  LUMBUNG,
  TILES,
  type Ctx,
  alivePlayers,
  changeGerakan,
  changeKesabaran,
  currentPlayer,
  emit,
  endGame,
  groupTiles,
  isOver,
  mult,
  pickRandom,
  player,
  sendToJail,
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
      tabungan: 0,
      kecurigaan: 0,
      jailTurns: 0,
      skipNext: false,
      bankrupt: false,
      suaraRakyat: 0,
      ordal: 0,
      phkUntilRound: 0,
      ...(m.bot ? { bot: true } : {}),
    };
  }

  const tiles = TILES.map((t) => ({
    owner: t.type === "gov_seat" ? GOV : null,
    level: 0,
    disabledUntilRound: 0,
  }));

  // Pedagang UMKM mulai dengan satu lapak gratis.
  for (const m of sorted) {
    if (players[m.id].profession !== "pedagang") continue;
    const free = TILES.find((t) => t.umkm && tiles[t.index].owner === null);
    if (free) tiles[free.index].owner = m.id;
  }

  return {
    schema: 1,
    roomId,
    mode,
    round: 1,
    maxRounds: R.MAX_ROUNDS,
    order: sorted.map((m) => m.id),
    turn: 0,
    players,
    tiles,
    inflationLevel: 0,
    gerakan: 0,
    kesabaran: R.KESABARAN_AWAL,
    lumbung: 0,
    kasPemerintah: 0,
    phase: "awaiting_roll",
    pendingTile: null,
    lastDice: null,
    doublesInRow: 0,
    rollAgain: false,
    aksiDipakai: false,
    result: null,
  };
}

/** Bagikan peran rahasia. Buzzer hanya di mode Rakyat Bersatu dengan 5+ pemain. */
export function assignSecrets(
  mode: Mode,
  playerIds: string[],
  rng: Rng,
): PlayerSecret[] {
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

export function applyAction(
  state: GameState,
  actorId: string,
  action: Action,
  rng: Rng,
): ActionResult {
  const s: GameState = structuredClone(state);
  const ctx: Ctx = { s, events: [], rng };

  if (isOver(s)) throw new GameError("game_selesai", "Permainan sudah selesai.");
  const actor = s.players[actorId];
  if (!actor) throw new GameError("bukan_pemain", "Kamu bukan pemain di room ini.");
  if (actor.bankrupt) throw new GameError("bangkrut", "Kamu sudah bangkrut.");
  if (s.order[s.turn] !== actorId) {
    throw new GameError("bukan_giliran", "Belum giliranmu.");
  }

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
    case "setor_tabungan":
      requirePhase(s, "awaiting_roll", "awaiting_end");
      doSetorTabungan(ctx, actor, action.amount);
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

  return { state: s, events: ctx.events };
}

function requirePhase(s: GameState, ...phases: GameState["phase"][]): void {
  if (!phases.includes(s.phase)) {
    throw new GameError("fase_salah", `Aksi tidak bisa dilakukan saat fase ${s.phase}.`);
  }
}

function requireAmount(amount: number, max: number): number {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new GameError("jumlah_tidak_valid", "Jumlah harus bilangan bulat positif.");
  }
  if (amount > max) throw new GameError("cuan_kurang", "Cuan kamu nggak cukup.");
  return amount;
}

// ---------------------------------------------------------------------------
// Dadu & gerak
// ---------------------------------------------------------------------------

function doRoll(ctx: Ctx, p: PlayerState): void {
  const s = ctx.s;

  if (p.skipNext) {
    p.skipNext = false;
    emit(ctx, { type: "lewati_giliran", actor: p.id, payload: { alasan: "kapan_nikah" } });
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
    if (p.kecurigaan >= R.BATAS_OTT) {
      transfer(ctx, p.id, GOV, R.DENDA_OTT * mult(s));
      p.kecurigaan = 0;
      emit(ctx, { type: "ott", actor: p.id, payload: { denda: R.DENDA_OTT } });
      if (!p.bankrupt) sendToJail(ctx, p.id, "ott");
      s.phase = "awaiting_end";
      return;
    }
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

  if (from + steps >= R.BOARD_SIZE) {
    const bonus = transfer(ctx, BANK, p.id, R.BONUS_LEWAT_GAJIAN * mult(s));
    emit(ctx, { type: "lewat_gajian", actor: p.id, payload: { bonus } });
  }
  if (p.profession === "ojol") transfer(ctx, BANK, p.id, R.OJOL_PER_GILIRAN * mult(s));

  if (p.bankrupt || isOver(s)) return;
  resolveTile(ctx, p);
}

function payGaji(ctx: Ctx, p: PlayerState): void {
  const s = ctx.s;
  if (p.phkUntilRound >= s.round && p.profession === "buruh") {
    emit(ctx, { type: "gaji_berhenti", actor: p.id, payload: { sampaiRonde: p.phkUntilRound } });
    return;
  }
  const base =
    p.profession === "kreator"
      ? ctx.rng.int(1, 6) * R.KREATOR_GAJI_PER_MATA_DADU
      : R.GAJI[p.profession];
  const paid = transfer(ctx, BANK, p.id, base * mult(s));
  emit(ctx, { type: "gajian", actor: p.id, payload: { jumlah: paid } });
}

// ---------------------------------------------------------------------------
// Efek petak
// ---------------------------------------------------------------------------

function resolveTile(ctx: Ctx, p: PlayerState): void {
  const s = ctx.s;
  const def = TILES[p.position];
  const tile = s.tiles[p.position];

  switch (def.type) {
    case "property":
    case "transport":
    case "utility": {
      if (tile.owner === null) {
        s.pendingTile = p.position;
        s.phase = "awaiting_buy";
        emit(ctx, {
          type: "tawaran_beli",
          actor: p.id,
          payload: { tile: p.position, harga: R.scaled(def.price ?? 0, s.inflationLevel) },
        });
        return;
      }
      if (tile.owner !== p.id) payRent(ctx, p, p.position);
      break;
    }
    case "gov_seat": {
      const paid = transfer(ctx, p.id, GOV, R.scaled(def.rent ?? 0, s.inflationLevel));
      changeKesabaran(ctx, -5);
      emit(ctx, { type: "setor_ke_pemerintah", actor: p.id, payload: { tile: def.index, jumlah: paid } });
      break;
    }
    case "tax": {
      const base = def.random ? ctx.rng.int(50, 150) : (def.amount ?? 0);
      const paid = transfer(ctx, p.id, GOV, R.scaled(base, s.inflationLevel));
      emit(ctx, { type: "pajak", actor: p.id, payload: { tile: def.index, jumlah: paid } });
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
    case "posko": {
      // Bencana: satu grup tidak bisa menagih sewa; Lumbung menolong yang mendarat.
      const groups = [...new Set(TILES.filter((t) => t.group).map((t) => t.group!))];
      const group = pickRandom(ctx.rng, groups);
      for (const idx of groupTiles(group)) s.tiles[idx].disabledUntilRound = s.round + 1;
      const bantuan = transfer(ctx, LUMBUNG, p.id, 50 * mult(s));
      changeKesabaran(ctx, -5);
      emit(ctx, { type: "bencana", actor: p.id, payload: { grup: group, bantuanLumbung: bantuan } });
      break;
    }
    case "start":
    case "jail":
      break;
  }

  finishResolution(ctx);
}

function rentFor(s: GameState, idx: number, dice: [number, number] | null): number {
  const def = TILES[idx];
  const tile = s.tiles[idx];
  const owner = tile.owner!;
  if (def.type === "transport") {
    const count = TILES.filter((t) => t.type === "transport" && s.tiles[t.index].owner === owner).length;
    return R.SEWA_TRANSPORT_PER_UNIT * count;
  }
  if (def.type === "utility") {
    const both = TILES.filter((t) => t.type === "utility").every((t) => s.tiles[t.index].owner === owner);
    const sum = dice ? dice[0] + dice[1] : 7;
    return sum * (both ? R.UTILITAS_PENGALI_DUA : R.UTILITAS_PENGALI);
  }
  let rent = (def.rent ?? 0) * R.SEWA_PER_LEVEL[tile.level];
  if (tile.level === 0 && def.group && groupTiles(def.group).every((i) => s.tiles[i].owner === owner)) {
    rent *= R.BONUS_SATU_GRUP;
  }
  if (def.umkm && s.players[owner]?.profession === "pedagang") rent *= R.PEDAGANG_BONUS_UMKM;
  return rent;
}

function payRent(ctx: Ctx, p: PlayerState, idx: number): void {
  const s = ctx.s;
  const tile = s.tiles[idx];
  const owner = tile.owner!;
  if (tile.disabledUntilRound >= s.round) {
    emit(ctx, { type: "sewa_libur_bencana", actor: p.id, payload: { tile: idx } });
    return;
  }
  const amount = R.scaled(rentFor(s, idx, s.lastDice), s.inflationLevel);
  const paid = transfer(ctx, p.id, owner, amount);
  emit(ctx, { type: "bayar_sewa", actor: p.id, payload: { tile: idx, ke: owner, jumlah: paid } });

  // Uang berputar di antara rakyat: dua-duanya dapat bonus kecil dari bank.
  if (s.mode === "rakyat_bersatu" && owner !== GOV && paid > 0) {
    const bonus = Math.max(1, Math.round(paid * R.BANGGA_PRODUK_LOKAL));
    if (!p.bankrupt) transfer(ctx, BANK, p.id, bonus);
    transfer(ctx, BANK, owner, bonus);
    emit(ctx, { type: "bangga_produk_lokal", actor: p.id, payload: { ke: owner, bonus } });
  }
}

function drawCard(ctx: Ctx, p: PlayerState, deck: CardDef[], deckName: string): void {
  const card = pickRandom(ctx.rng, deck);
  emit(ctx, { type: "kartu", actor: p.id, payload: { dek: deckName, id: card.id, judul: card.judul, teks: card.teks } });
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
// Aksi ekonomi & gerakan
// ---------------------------------------------------------------------------

function doBuy(ctx: Ctx, p: PlayerState): void {
  const s = ctx.s;
  const idx = s.pendingTile!;
  const price = R.scaled(TILES[idx].price ?? 0, s.inflationLevel);
  if (p.cuan < price) throw new GameError("cuan_kurang", "Cuan kamu nggak cukup buat beli.");
  transfer(ctx, p.id, BANK, price);
  s.tiles[idx].owner = p.id;
  s.tiles[idx].level = 0;
  emit(ctx, { type: "beli", actor: p.id, payload: { tile: idx, harga: price } });
  finishResolution(ctx);
}

function doPayFine(ctx: Ctx, p: PlayerState): void {
  if (p.jailTurns === 0) throw new GameError("tidak_ditilang", "Kamu nggak lagi ditilang.");
  const fine = R.scaled(R.DENDA_TILANG, ctx.s.inflationLevel);
  if (p.cuan < fine) throw new GameError("cuan_kurang", "Cuan kamu nggak cukup buat bayar denda.");
  transfer(ctx, p.id, GOV, fine);
  p.jailTurns = 0;
  emit(ctx, { type: "bayar_denda", actor: p.id, payload: { jumlah: fine } });
}

function doUpgrade(ctx: Ctx, p: PlayerState, idx: number): void {
  const s = ctx.s;
  const def = TILES[idx];
  if (!def || def.type !== "property") throw new GameError("bukan_usaha", "Petak ini bukan usaha.");
  const tile = s.tiles[idx];
  if (tile.owner !== p.id) throw new GameError("bukan_milikmu", "Usaha ini bukan milikmu.");
  if (tile.level >= R.MAX_LEVEL) throw new GameError("level_maks", "Usaha ini sudah Brand Lokal.");
  const cost = R.scaled((def.price ?? 0) * R.BIAYA_UPGRADE, s.inflationLevel);
  if (p.cuan < cost) throw new GameError("cuan_kurang", "Cuan kamu nggak cukup buat upgrade.");
  transfer(ctx, p.id, BANK, cost);
  tile.level += 1;
  emit(ctx, { type: "upgrade", actor: p.id, payload: { tile: idx, level: tile.level, biaya: cost } });
}

function doSetorTabungan(ctx: Ctx, p: PlayerState, amount: number): void {
  const n = requireAmount(amount, p.cuan);
  p.cuan -= n;
  p.tabungan += n;
  emit(ctx, { type: "setor_tabungan", actor: p.id, payload: { jumlah: n } });
}

function doDonasi(ctx: Ctx, p: PlayerState, amount: number): void {
  if (ctx.s.mode !== "rakyat_bersatu") throw new GameError("mode_salah", "Lumbung hanya ada di mode Rakyat Bersatu.");
  const n = requireAmount(amount, p.cuan);
  transfer(ctx, p.id, LUMBUNG, n);
  const suara = Math.floor(n / R.DONASI_PER_SUARA);
  p.suaraRakyat += suara;
  emit(ctx, { type: "donasi_lumbung", actor: p.id, payload: { jumlah: n, suaraRakyat: suara } });
}

function requireAksi(ctx: Ctx): void {
  if (ctx.s.mode !== "rakyat_bersatu") throw new GameError("mode_salah", "Aksi gerakan hanya ada di mode Rakyat Bersatu.");
  if (ctx.s.aksiDipakai) throw new GameError("aksi_sudah_dipakai", "Satu aksi gerakan per giliran.");
  ctx.s.aksiDipakai = true;
}

function doPetisi(ctx: Ctx, p: PlayerState): void {
  const cost = R.scaled(R.PETISI_BIAYA, ctx.s.inflationLevel);
  if (p.cuan < cost) throw new GameError("cuan_kurang", "Cuan kamu nggak cukup buat petisi.");
  requireAksi(ctx);
  transfer(ctx, p.id, BANK, cost);
  const gain = p.profession === "kreator" ? R.PETISI_GERAKAN * 2 : R.PETISI_GERAKAN;
  emit(ctx, { type: "petisi", actor: p.id, payload: { gerakan: gain } });
  changeGerakan(ctx, gain, "petisi");
}

function doLiputan(ctx: Ctx, p: PlayerState): void {
  if (ctx.s.lumbung < R.LIPUTAN_BIAYA_LUMBUNG) {
    throw new GameError("lumbung_kurang", "Lumbung Bersama belum cukup buat danai liputan.");
  }
  requireAksi(ctx);
  transfer(ctx, LUMBUNG, BANK, R.LIPUTAN_BIAYA_LUMBUNG);
  const gain = R.LIPUTAN_GERAKAN + (p.profession === "jurnalis" ? R.JURNALIS_BONUS_LIPUTAN : 0);
  emit(ctx, { type: "liputan_media", actor: p.id, payload: { gerakan: gain } });
  changeGerakan(ctx, gain, "liputan_media");
}

// ---------------------------------------------------------------------------
// Giliran, ronde, dan giliran Pemerintah
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

  // Gaji bulanan dulu, baru biaya hidup.
  for (const p of alivePlayers(s)) payGaji(ctx, p);

  // Biaya hidup untuk semua pemain yang masih bertahan.
  const biaya = R.scaled(R.BIAYA_HIDUP, s.inflationLevel);
  for (const p of alivePlayers(s)) transfer(ctx, p.id, BANK, biaya);
  emit(ctx, { type: "biaya_hidup", payload: { jumlah: biaya } });
  if (isOver(s)) return;

  governmentTurn(ctx);
  if (isOver(s)) return;

  s.round += 1;
  if ((s.round - 1) % R.INFLASI_TIAP_RONDE === 0) {
    s.inflationLevel += 1;
    emit(ctx, { type: "inflasi_naik", payload: { tingkat: s.inflationLevel } });
  }

  if (s.round > s.maxRounds) {
    if (s.mode === "rakyat_bersatu") {
      endGame(ctx, { kind: "rakyat_kalah", reason: "waktu_habis" });
    } else {
      const richest = [...alivePlayers(s)].sort((a, b) => netWorth(s, b) - netWorth(s, a))[0];
      endGame(ctx, { kind: "juragan_menang", winner: richest.id });
    }
    return;
  }
  emit(ctx, { type: "ronde_baru", payload: { ronde: s.round } });
}

function governmentTurn(ctx: Ctx): void {
  const s = ctx.s;
  const inCycle = s.round % R.SIKLUS_PEMILU;

  if (inCycle === 0) {
    // Musim Kampanye: tiba-tiba murah hati.
    for (const p of alivePlayers(s)) transfer(ctx, GOV, p.id, R.scaled(60, s.inflationLevel));
    changeKesabaran(ctx, 10);
    emit(ctx, { type: "musim_kampanye", payload: {} });
    return;
  }

  // Habis pemilu, langsung dua kebijakan sekaligus.
  const count = inCycle === 1 && s.round > 1 ? 2 : 1;
  for (let i = 0; i < count && !isOver(s); i++) {
    const card = pickRandom(ctx.rng, KEBIJAKAN);
    emit(ctx, { type: "kebijakan", payload: { id: card.id, judul: card.judul, teks: card.teks } });
    card.apply(ctx, "");
  }

  if (!isOver(s) && s.mode === "rakyat_bersatu" && s.gerakan > 0) {
    const redam = Math.round(R.GERAKAN_PELURUHAN_DASAR + s.gerakan * R.GERAKAN_PELURUHAN_FAKTOR);
    changeGerakan(ctx, -redam, "diredam_pemerintah");
  }

  if (!isOver(s) && s.mode === "rakyat_bersatu" && s.kesabaran <= 0) {
    emit(ctx, { type: "demo_akbar", payload: {} });
    s.kesabaran = R.KESABARAN_SETELAH_DEMO;
    changeGerakan(ctx, R.GERAKAN_DEMO, "demo_damai");
  }
}

export function netWorth(s: GameState, p: PlayerState): number {
  let total = p.cuan + p.tabungan;
  s.tiles.forEach((t, idx) => {
    if (t.owner === p.id) {
      const price = TILES[idx].price ?? 0;
      total += price + t.level * price * R.BIAYA_UPGRADE;
    }
  });
  return total;
}

export { player };
