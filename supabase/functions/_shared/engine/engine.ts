// Engine giliran Negeri Wkwk v2.
// Fungsi murni: (state, aksi, rng) -> state baru + daftar event.
// Dipanggil server (main online) dan klien (main solo), jadi aturannya satu sumber.
import { GRUP_WA, KEBIJAKAN, NASIB_WNI, jalankanKartu, type CardDef } from "./cards.ts";
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
  healRezim,
  jasa,
  kenaOTT,
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
  type Gaya,
  type GameEvent,
  type Jalur,
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
  level = 1,
  buzzer: string | null = null,
  rekrut = false,
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
      utang: 0,
      jurus: R.JURUS_AWAL,
      jasa: 0,
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

  const babak = Math.max(1, Math.min(R.MAX_BABAK, Math.round(level)));
  const nyawa = Math.round(R.KEKUASAAN_AWAL[sorted.length] * R.nyawaBabak(babak));
  return {
    schema: 3,
    roomId,
    mode,
    level: babak,
    round: 1,
    maxRounds: R.MAX_ROUNDS,
    order: sorted.map((m) => m.id),
    turn: 0,
    players,
    tiles,
    kekuasaan: nyawa,
    kekuasaanMaks: nyawa,
    semangat: 0,
    demoCount: 0,
    lumbung: 0,
    rezimPos: R.BOARD_SIZE / 2,
    kampung: [],
    bersih: [],
    jejak: {},
    rahasia: {
      buzzer: mode === "rakyat_bersatu" && buzzer && players[buzzer] ? buzzer : null,
      antre: 0,
      rekrut: mode === "rakyat_bersatu" && rekrut && !buzzer,
    },
    phase: "awaiting_roll",
    pendingTile: null,
    lastDice: null,
    doublesInRow: 0,
    rollAgain: false,
    aksiDipakai: false,
    sudahBantu: false,
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
  const ctx: Ctx = { s, events: [], rng, oleh: actorId };

  if (s.schema !== 3) throw new GameError("game_lama", "Game ini dari versi lama. Bikin room baru ya.");
  if (isOver(s)) throw new GameError("game_selesai", "Permainan sudah selesai.");
  const actor = s.players[actorId];
  if (!actor) throw new GameError("bukan_pemain", "Kamu bukan pemain di room ini.");
  if (actor.bankrupt) throw new GameError("bangkrut", "Kamu sudah bangkrut.");
  if (s.order[s.turn] !== actorId) throw new GameError("bukan_giliran", "Belum giliranmu.");

  switch (action.type) {
    case "roll":
      requirePhase(s, "awaiting_roll");
      doRoll(ctx, actor, action.gaya);
      break;
    case "jurus":
      requirePhase(s, "awaiting_roll", "awaiting_end");
      doJurus(ctx, actor);
      break;
    case "pinjol":
      requirePhase(s, "awaiting_roll", "awaiting_end", "awaiting_buy");
      doPinjol(ctx, actor, action.amount);
      break;
    case "bayar_utang":
      requirePhase(s, "awaiting_roll", "awaiting_end");
      doBayarUtang(ctx, actor, action.amount);
      break;
    case "bantu":
      requirePhase(s, "awaiting_roll", "awaiting_end");
      doBantu(ctx, actor, action.target, action.amount);
      break;
    case "sabotase":
      requirePhase(s, "awaiting_roll", "awaiting_end");
      if (s.rahasia.buzzer !== actor.id || actor.buzzer) throw new GameError("bukan_buzzer", "Aksi tidak dikenal.");
      if (s.rahasia.antre > 0) throw new GameError("sabotase_antre", "Sabotase ronde ini sudah disiapkan.");
      s.rahasia.antre = 1; // efeknya baru muncul di akhir ronde, tanpa nama pelaku
      break;
    case "tuduh":
      requirePhase(s, "awaiting_roll", "awaiting_end");
      doTuduh(ctx, actor, action.target);
      break;
    case "buy":
      requirePhase(s, "awaiting_buy");
      doBuy(ctx, actor, action.jalur);
      break;
    case "skip_buy":
      requirePhase(s, "awaiting_buy");
      emit(ctx, { type: "lewati_beli", actor: actor.id, payload: { tile: s.pendingTile } });
      finishResolution(ctx);
      break;
    case "bayar_denda":
      requirePhase(s, "awaiting_roll");
      doPayFine(ctx, actor, action.jalur);
      break;
    case "upgrade":
      requirePhase(s, "awaiting_roll", "awaiting_end");
      doUpgrade(ctx, actor, action.tile, action.jalur);
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

/** Lempar dua dadu. Dengan `gaya`, ada peluang AKURASI_DADU jumlahnya jatuh di kisaran yang dipilih. */
function lemparDadu(ctx: Ctx, gaya: Gaya | undefined): { dice: [number, number]; kena: boolean } {
  const acak = (): [number, number] => [ctx.rng.int(1, 6), ctx.rng.int(1, 6)];
  const range = gaya ? R.GAYA_DADU[gaya] : undefined;
  if (!range) return { dice: acak(), kena: false };
  const jitu = ctx.rng.int(1, 100) <= R.AKURASI_DADU * 100;
  let dice = acak();
  const pas = () => dice[0] + dice[1] >= range[0] && dice[0] + dice[1] <= range[1];
  for (let i = 0; jitu && !pas() && i < 40; i++) dice = acak();
  return { dice, kena: pas() };
}

function doRoll(ctx: Ctx, p: PlayerState, gaya?: Gaya): void {
  const s = ctx.s;

  if (p.skipNext) {
    p.skipNext = false;
    emit(ctx, { type: "lewati_giliran", actor: p.id, payload: {} });
    s.phase = "awaiting_end";
    return;
  }

  // Saat ditilang tenaga lemparan tidak berpengaruh: murni untung-untungan cari dadu kembar.
  const pakai = p.jailTurns > 0 || !gaya || !R.GAYA_DADU[gaya] ? undefined : gaya;
  const { dice, kena } = lemparDadu(ctx, pakai);
  const isDouble = dice[0] === dice[1];
  s.lastDice = dice;
  emit(ctx, { type: "dadu", actor: p.id, payload: { dadu: dice, gaya: pakai ?? null, kena } });

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
  if (p.utang > 0) {
    const cicil = transfer(ctx, p.id, BANK, Math.min(p.utang, R.PINJOL_CICILAN, Math.max(0, p.cuan)));
    p.utang -= cicil;
    if (cicil > 0) emit(ctx, { type: "cicilan", actor: p.id, payload: { jumlah: cicil, sisa: p.utang } });
  }
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
  if (p.cuan < hargaBeli(s, idx, "pelicin")) {
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
    payload: {
      dek: deckName,
      id: card.id,
      judul: card.judul,
      teks: card.teks,
      baik: card.baik,
      nasib: card.nasib?.map((t) => t.teks) ?? null,
    },
  });
  jalankanKartu(ctx, card, p.id);
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

function doBuy(ctx: Ctx, p: PlayerState, jalur: Jalur = "resmi"): void {
  const s = ctx.s;
  const idx = s.pendingTile!;
  const tile = s.tiles[idx];
  const rebut = tile.owner === GOV;
  const pelicin = !rebut && jalur === "pelicin";
  const harga = hargaBeli(s, idx, pelicin ? "pelicin" : "resmi");
  if (p.cuan < harga) throw new GameError("uang_kurang", "Uangmu nggak cukup.");
  if (pelicin && kenaOTT(ctx, p.id)) return finishResolution(ctx); // izinnya batal, petak tetap kosong
  transfer(ctx, p.id, rebut || pelicin ? GOV : BANK, harga);
  tile.owner = p.id; // bangunan Rezim ikut jadi milikmu kalau direbut
  emit(ctx, { type: "beli", actor: p.id, payload: { tile: idx, harga, rebut, pelicin } });
  if (pelicin) healRezim(ctx, R.PELICIN_REZIM, "pelicin");
  addSemangat(ctx, R.SEMANGAT_BELI, rebut ? "rebut_aset" : "usaha_baru");
  if (rebut) hitRezim(ctx, R.REBUT_DAMAGE, "rebut_aset");
  cekKampung(ctx, TILES[idx].group);
  finishResolution(ctx);
}

function doPayFine(ctx: Ctx, p: PlayerState, jalur: Jalur = "resmi"): void {
  if (p.jailTurns === 0) throw new GameError("tidak_ditilang", "Kamu nggak lagi ditilang.");
  // "Damai di tempat": separuh harga, tapi kalau ketahuan malah tambah parah.
  const fine = R.bulat(R.DENDA_TILANG * (jalur === "pelicin" ? 0.5 : 1));
  if (p.cuan < fine) throw new GameError("uang_kurang", "Uangmu nggak cukup buat bayar denda.");
  if (jalur === "pelicin" && kenaOTT(ctx, p.id)) return;
  transfer(ctx, p.id, GOV, fine);
  p.jailTurns = 0;
  emit(ctx, { type: "bayar_denda", actor: p.id, payload: { jumlah: fine, pelicin: jalur === "pelicin" } });
  if (jalur === "pelicin") healRezim(ctx, R.PELICIN_REZIM, "pelicin");
  else addSemangat(ctx, R.SEMANGAT_PUNGLI, "pungli", true);
}

function doUpgrade(ctx: Ctx, p: PlayerState, idx: number, jalur: Jalur = "resmi"): void {
  const s = ctx.s;
  const def = TILES[idx];
  if (!def || def.type !== "property") throw new GameError("bukan_usaha", "Petak ini bukan usaha.");
  const tile = s.tiles[idx];
  if (tile.owner !== p.id) throw new GameError("bukan_milikmu", "Usaha ini bukan milikmu.");
  if (tile.level >= R.MAX_LEVEL) throw new GameError("level_maks", "Usaha ini sudah Brand Lokal.");
  const cost = biayaUpgrade(idx, jalur);
  if (p.cuan < cost) throw new GameError("uang_kurang", "Uangmu nggak cukup buat upgrade.");
  if (jalur === "pelicin" && kenaOTT(ctx, p.id)) return;
  transfer(ctx, p.id, jalur === "pelicin" ? GOV : BANK, cost);
  tile.level += 1;
  emit(ctx, { type: "upgrade", actor: p.id, payload: { tile: idx, level: tile.level, biaya: cost, pelicin: jalur === "pelicin" } });
  if (jalur === "pelicin") healRezim(ctx, R.PELICIN_REZIM, "pelicin");
  addSemangat(ctx, R.SEMANGAT_UPGRADE, "upgrade");
}

/** Pinjol: uang cair seketika, utang langsung ditambah bunga, lalu berbunga lagi tiap ronde. */
function doPinjol(ctx: Ctx, p: PlayerState, amount: number): void {
  if (!Number.isInteger(amount) || amount < 1_000_000 || amount % 500_000 !== 0) {
    throw new GameError("jumlah_tidak_valid", "Pinjaman minimal DR 1 jt, kelipatan DR 500 rb.");
  }
  const utang = R.bulat(amount * (1 + R.PINJOL_BUNGA_AWAL));
  if (p.utang + utang > R.PINJOL_MAKS) throw new GameError("limit_pinjol", "Limit pinjolmu sudah mentok.");
  transfer(ctx, BANK, p.id, amount);
  p.utang += utang;
  emit(ctx, { type: "pinjol", actor: p.id, payload: { jumlah: amount, utang: p.utang } });
}

function doBayarUtang(ctx: Ctx, p: PlayerState, amount: number): void {
  const bayar = Math.min(amount, p.utang, p.cuan);
  if (!Number.isInteger(amount) || bayar <= 0) throw new GameError("jumlah_tidak_valid", "Tidak ada utang yang bisa dibayar.");
  transfer(ctx, p.id, BANK, bayar);
  p.utang -= bayar;
  emit(ctx, { type: "bayar_utang", actor: p.id, payload: { jumlah: bayar, sisa: p.utang } });
}

/** Gotong royong: bantu warga lain. Uangnya melunasi utang pinjolnya dulu, sisanya jadi pegangan. */
function doBantu(ctx: Ctx, p: PlayerState, targetId: string, amount: number): void {
  const s = ctx.s;
  const target = s.players[targetId];
  if (!target || target.id === p.id || target.bankrupt) throw new GameError("target_tidak_valid", "Warga itu tidak bisa dibantu.");
  if (!Number.isInteger(amount) || amount <= 0 || amount > p.cuan) throw new GameError("uang_kurang", "Uangmu nggak cukup.");
  const lunas = Math.min(amount, target.utang);
  target.utang -= lunas;
  transfer(ctx, p.id, BANK, lunas);
  transfer(ctx, p.id, target.id, amount - lunas);
  emit(ctx, { type: "bantu", actor: p.id, payload: { target: target.id, jumlah: amount, lunas } });
  jasa(ctx, p.id, amount / 250_000);
  if (!s.sudahBantu && amount >= 500_000) {
    s.sudahBantu = true;
    addSemangat(ctx, R.SEMANGAT_BANTU, "gotong_royong", true);
  }
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

/** Jurus pamungkas profesi. Terisi satu tiap giliran sendiri. */
function doJurus(ctx: Ctx, p: PlayerState): void {
  const s = ctx.s;
  if (p.jurus < R.JURUS_PENUH) throw new GameError("jurus_belum_siap", "Jurusmu belum terisi penuh.");
  if (p.profession === "ojol" && s.phase !== "awaiting_end") {
    throw new GameError("fase_salah", "Jalan Tikus dipakai setelah kamu melempar dadu.");
  }
  p.jurus = 0;
  emit(ctx, { type: "jurus", actor: p.id, payload: { profesi: p.profession } });
  const semangat = R.JURUS_SEMANGAT[p.profession];
  switch (p.profession) {
    case "pedagang": {
      // Cuci Gudang: omzet semua usaha cair sekarang juga.
      let omzet = 0;
      s.tiles.forEach((t, i) => {
        if (t.owner === p.id) omzet += omzetUsaha(s, i);
      });
      transfer(ctx, BANK, p.id, Math.max(R.JURUS_UANG, omzet * 2));
      break;
    }
    case "ojol":
      // Jalan Tikus: boleh melempar dadu sekali lagi.
      s.phase = "awaiting_roll";
      break;
    case "jurnalis":
      if (coop(s)) hitRezim(ctx, R.JURUS_DAMAGE, "bongkar_skandal");
      else transfer(ctx, BANK, p.id, R.JURUS_UANG);
      break;
    default:
      if (p.profession === "kreator" || !coop(s)) transfer(ctx, BANK, p.id, R.JURUS_UANG);
      if (coop(s) && semangat) addSemangat(ctx, semangat, "jurus");
  }
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
  s.sudahBantu = false;
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
  ctx.oleh = s.order[next];
  const giliran = s.players[s.order[next]];
  giliran.jurus = Math.min(R.JURUS_PENUH, giliran.jurus + 1);
  emit(ctx, { type: "giliran", actor: s.order[next], payload: { ronde: s.round } });
}

function endRound(ctx: Ctx): void {
  const s = ctx.s;
  rezimTurn(ctx);
  if (isOver(s)) return;

  // Bunga pinjol jalan terus. Utang menumpuk: debt collector meneror sampai tak bisa kerja.
  for (const p of alivePlayers(s)) {
    if (p.utang <= 0) continue;
    p.utang = R.bulat(p.utang * (1 + R.PINJOL_BUNGA_RONDE));
    if (p.utang >= R.PINJOL_TEROR) {
      p.skipNext = true;
      emit(ctx, { type: "teror_dc", actor: p.id, payload: { utang: p.utang } });
    }
  }

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
  // Efek giliran Rezim bukan jasa siapa pun, kecuali pemilik usaha yang didatangi pejabat.
  ctx.oleh = null;

  rekrutBuzzer(ctx);
  sabotaseBuzzer(ctx);
  if (isOver(s)) return;

  const card = pickRandom(ctx.rng, KEBIJAKAN);
  emit(ctx, {
    type: "kebijakan",
    payload: { id: card.id, judul: card.judul, teks: card.teks, baik: card.baik, jenis: card.jenis ?? "kebijakan", nasib: card.nasib?.map((t) => t.teks) ?? null },
  });
  jalankanKartu(ctx, card, "");
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
    ctx.oleh = tile.owner;
    hitRezim(ctx, damage, "rezim_mampir");
    ctx.oleh = null;
  }
}

/** Sabotase yang disiapkan buzzer muncul di akhir ronde, tanpa nama. Kadang meninggalkan jejak. */
function sabotaseBuzzer(ctx: Ctx): void {
  const s = ctx.s;
  const id = s.rahasia.buzzer;
  if (s.rahasia.antre === 0 || !id) return;
  s.rahasia.antre = 0;
  if (s.players[id].bankrupt || s.players[id].buzzer) return;

  const pilihan: string[] = [];
  if (s.semangat >= R.SABOTASE_SEMANGAT) pilihan.push("tagar");
  if (s.lumbung >= 1_500_000) pilihan.push("tilep");
  const vokal = [...alivePlayers(s)].filter((p) => p.id !== id && p.jailTurns === 0).sort((a, b) => b.jasa - a.jasa)[0];
  if (vokal && vokal.jasa > 0) pilihan.push("lapor");
  const jenis = pilihan.length > 0 ? pickRandom(ctx.rng, pilihan) : "tagar";

  if (jenis === "tilep") {
    const jumlah = transfer(ctx, LUMBUNG, BANK, R.bulat(s.lumbung * R.SABOTASE_LUMBUNG));
    emit(ctx, { type: "sabotase", payload: { jenis, jumlah } });
  } else if (jenis === "lapor" && vokal) {
    emit(ctx, { type: "sabotase", payload: { jenis, korban: vokal.id } });
    sendToJail(ctx, vokal.id, "dilaporkan");
  } else {
    emit(ctx, { type: "sabotase", payload: { jenis: "tagar" } });
    addSemangat(ctx, -R.SABOTASE_SEMANGAT, "sabotase");
  }

  // Jejak digital: sering mengarah ke buzzer, tapi kadang jejak palsu yang memfitnah warga lain.
  if (ctx.rng.int(1, 100) > R.PELUANG_JEJAK * 100) return;
  const lain = alivePlayers(s).filter((p) => p.id !== id);
  const jujur = ctx.rng.int(1, 100) <= R.JEJAK_JUJUR * 100 || lain.length === 0;
  const ke = jujur ? id : pickRandom(ctx.rng, lain).id;
  s.jejak[ke] = (s.jejak[ke] ?? 0) + 1;
  emit(ctx, { type: "jejak", payload: { ke, total: s.jejak[ke] } });
}

/**
 * Rezim menyuap warga di tengah permainan. Yang paling kepepet paling gampang dibeli,
 * jadi buzzer tidak ditentukan dari awal dan siapa pun bisa berubah kapan saja.
 */
function rekrutBuzzer(ctx: Ctx): void {
  const s = ctx.s;
  if (!s.rahasia.rekrut || s.rahasia.buzzer || s.round < 2) return;
  if (ctx.rng.int(1, 100) > R.PELUANG_REKRUT * 100) return;
  // Hanya bot yang bisa disuap; pemain manusia tidak pernah diubah perannya diam-diam.
  const calon = alivePlayers(s).filter((p) => p.bot && !s.bersih.includes(p.id)).sort((a, b) => a.cuan - b.cuan);
  if (calon.length === 0) return;
  // bobot: termiskin paling berat
  const bobot = calon.map((_, i) => calon.length - i);
  let acak = ctx.rng.int(1, bobot.reduce((a, b) => a + b, 0));
  let pilih = 0;
  while (acak > bobot[pilih]) acak -= bobot[pilih++];
  s.rahasia.buzzer = calon[pilih].id;
  s.rahasia.rekrut = false;
}

/** Menuduh seorang warga sebagai buzzer. Tiap pemain hanya punya satu kesempatan. */
function doTuduh(ctx: Ctx, p: PlayerState, targetId: string): void {
  const s = ctx.s;
  if (!coop(s)) throw new GameError("mode_salah", "Buzzer hanya ada di mode Rakyat Bersatu.");
  if (p.sudahTuduh) throw new GameError("sudah_tuduh", "Kesempatan menuduhmu sudah terpakai.");
  const target = s.players[targetId];
  if (!target || target.id === p.id || target.bankrupt || target.buzzer) {
    throw new GameError("target_tidak_valid", "Warga itu tidak bisa dituduh.");
  }
  p.sudahTuduh = true;
  if (s.rahasia.buzzer === target.id) {
    target.buzzer = true;
    s.rahasia.antre = 0;
    emit(ctx, { type: "buzzer_terbongkar", actor: p.id, payload: { target: target.id } });
    addSemangat(ctx, R.BONGKAR_SEMANGAT, "buzzer_terbongkar");
    hitRezim(ctx, R.BONGKAR_DAMAGE, "buzzer_terbongkar");
  } else {
    if (!s.bersih.includes(target.id)) s.bersih.push(target.id);
    emit(ctx, { type: "tuduh_salah", actor: p.id, payload: { target: target.id } });
    transfer(ctx, p.id, BANK, Math.min(p.cuan, R.FITNAH_DENDA));
    addSemangat(ctx, -R.FITNAH_SEMANGAT, "fitnah");
  }
}

export function netWorth(s: GameState, p: PlayerState): number {
  let total = p.cuan - p.utang;
  s.tiles.forEach((t, idx) => {
    if (t.owner === p.id) {
      const price = TILES[idx].price ?? 0;
      total += price + t.level * price * R.BIAYA_UPGRADE;
    }
  });
  return total;
}
