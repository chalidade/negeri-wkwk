// Jalankan: npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BOT_NAMES,
  GOV,
  GameError,
  TILES,
  applyAction,
  assignSecrets,
  createInitialState,
  decideBotAction,
  omzetUsaha,
  scriptedRng,
  seededRng,
  type Action,
  type GameState,
  type Profession,
} from "../functions/_shared/engine/mod.ts";
import * as R from "../functions/_shared/engine/rules.ts";

const JT = 1_000_000;
const IDS = ["andi", "budi", "citra", "dewi"];

function setup(n = 4, pro: Profession = "buruh", mode: "rakyat_bersatu" | "juragan" = "rakyat_bersatu"): GameState {
  const members = IDS.slice(0, n).map((id, i) => ({ id, name: id, seat: i, profession: pro }));
  return createInitialState("room", mode, members, seededRng(1));
}

/** Jalankan aksi dengan angka acak yang ditentukan (dadu, lalu pilihan kartu). */
function act(s: GameState, who: string, action: Action, rolls: number[] = []) {
  return applyAction(s, who, action, scriptedRng(rolls, seededRng(9)));
}

const types = (r: { events: { type: string }[] }) => r.events.map((e) => e.type);

describe("setup", () => {
  it("state awal: uang DR, papan 32 petak, nyawa Rezim sesuai jumlah pemain", () => {
    const s = setup(4);
    assert.equal(s.schema, 2);
    assert.equal(TILES.length, R.BOARD_SIZE);
    assert.equal(s.tiles.length, 32);
    assert.equal(s.players.andi.cuan, 20 * JT);
    assert.equal(s.kekuasaan, R.KEKUASAAN_AWAL[4]);
    assert.equal(setup(2).kekuasaan, R.KEKUASAAN_AWAL[2]);
    assert.equal(s.semangat, 0);
  });

  it("pedagang mulai dengan satu lapak gratis", () => {
    const s = setup(2, "pedagang");
    assert.equal(s.tiles[1].owner, "andi");
    assert.equal(s.tiles[2].owner, "budi");
  });

  it("semua harga kelipatan DR 50.000", () => {
    for (const t of TILES) {
      for (const v of [t.price, t.amount]) if (v) assert.equal(v % 50_000, 0, t.name);
    }
  });
});

describe("giliran", () => {
  it("mendarat di usaha kosong: ditawari, beli, Semangat naik", () => {
    let r = act(setup(), "andi", { type: "roll" }, [1, 3]);
    assert.equal(r.state.phase, "awaiting_buy");
    assert.equal(r.state.pendingTile, 4);
    r = act(r.state, "andi", { type: "buy" });
    assert.equal(r.state.tiles[4].owner, "andi");
    assert.equal(r.state.players.andi.cuan, 20 * JT - 1.6 * JT);
    assert.equal(r.state.semangat, R.SEMANGAT_BELI);
    assert.equal(r.state.phase, "awaiting_end");
  });

  it("bukan giliran dan fase salah ditolak", () => {
    const s = setup();
    assert.throws(() => act(s, "budi", { type: "roll" }), (e: GameError) => e.code === "bukan_giliran");
    assert.throws(() => act(s, "andi", { type: "end_turn" }), (e: GameError) => e.code === "fase_salah");
  });

  it("lewat Gajian: gaji + omzet, 20% gaji masuk Lumbung", () => {
    const s = setup();
    s.players.andi.position = 30;
    s.tiles[4].owner = "andi";
    const omzet = omzetUsaha(s, 4);
    const r = act(s, "andi", { type: "roll" }, [1, 2]);
    assert.ok(types(r).includes("gajian"));
    assert.equal(r.state.lumbung, 0.6 * JT);
    assert.equal(r.state.players.andi.cuan, 20 * JT + 3 * JT - 0.6 * JT + omzet);
  });

  it("kena pungli: uang berkurang, Semangat naik", () => {
    const s = setup();
    s.players.andi.position = 3;
    const r = act(s, "andi", { type: "roll" }, [1, 2]);
    assert.equal(r.state.players.andi.cuan, 19 * JT);
    assert.equal(r.state.semangat, R.SEMANGAT_PUNGLI);
  });

  it("aset Rezim: bayar pungli lalu bisa direbut", () => {
    const s = setup();
    s.tiles[4] = { owner: GOV, level: 1 };
    let r = act(s, "andi", { type: "roll" }, [1, 3]);
    assert.ok(types(r).includes("pungli"));
    assert.equal(r.state.phase, "awaiting_buy");
    const before = r.state.kekuasaan;
    r = act(r.state, "andi", { type: "buy" });
    assert.equal(r.state.tiles[4].owner, "andi");
    assert.equal(r.state.tiles[4].level, 1);
    assert.equal(r.state.kekuasaan, before - R.REBUT_DAMAGE);
  });

  it("dadu kembar lempar lagi, tiga kali kembar kena tilang", () => {
    let r = act(setup(), "andi", { type: "roll" }, [4, 4]); // petak 8: cuma lewat
    assert.equal(r.state.phase, "awaiting_roll");
    r = act(r.state, "andi", { type: "roll" }, [4, 4]); // petak 16: titik demo
    r = act(r.state, "andi", { type: "roll" }, [1, 1]);
    assert.equal(r.state.players.andi.position, R.JAIL_TILE);
    assert.equal(r.state.players.andi.jailTurns, R.LAMA_TILANG);
    assert.equal(r.state.phase, "awaiting_end");
  });
});

describe("melawan Rezim", () => {
  it("Semangat penuh memicu Demo Akbar yang memangkas Kekuasaan", () => {
    const s = setup();
    s.semangat = 99;
    s.players.andi.position = 3;
    const r = act(s, "andi", { type: "roll" }, [1, 2]);
    assert.ok(types(r).includes("demo_akbar"));
    assert.equal(r.state.semangat, 0);
    assert.equal(r.state.demoCount, 1);
    assert.equal(r.state.kekuasaan, R.KEKUASAAN_AWAL[4] - R.DEMO_DAMAGE);
  });

  it("Kekuasaan habis: rakyat menang", () => {
    const s = setup();
    s.kekuasaan = 5;
    s.semangat = 99;
    s.players.andi.position = 3;
    const r = act(s, "andi", { type: "roll" }, [1, 2]);
    assert.deepEqual(r.state.result, { kind: "rakyat_menang" });
    assert.equal(r.state.phase, "game_over");
  });

  it("petisi dan liputan: satu aksi per giliran", () => {
    const s = setup();
    s.lumbung = 6 * JT;
    let r = act(s, "andi", { type: "liputan_media" });
    assert.equal(r.state.kekuasaan, R.KEKUASAAN_AWAL[4] - R.LIPUTAN_DAMAGE);
    assert.equal(r.state.lumbung, 6 * JT - R.LIPUTAN_BIAYA_LUMBUNG);
    assert.throws(() => act(r.state, "andi", { type: "petisi" }), (e: GameError) => e.code === "aksi_sudah_dipakai");
    r = act(setup(), "andi", { type: "petisi" });
    assert.equal(r.state.semangat, R.SEMANGAT_PETISI);
    assert.equal(r.state.players.andi.cuan, 20 * JT - R.PETISI_BIAYA);
  });

  it("satu grup warna dikuasai rakyat jadi Kampung Mandiri", () => {
    const s = setup();
    s.tiles[1].owner = "budi";
    let r = act(s, "andi", { type: "roll" }, [1, 1]); // petak 2, kembar
    r = act(r.state, "andi", { type: "buy" });
    assert.ok(types(r).includes("kampung_mandiri"));
    assert.deepEqual(r.state.kampung, ["coklat"]);
    assert.equal(r.state.kekuasaan, R.KEKUASAAN_AWAL[4] - R.KAMPUNG_DAMAGE);
  });

  it("akhir ronde: Rezim keluarkan kebijakan dan mobil pejabat jalan", () => {
    let s = setup(2);
    for (const id of ["andi", "budi"]) {
      s = act(s, id, { type: "roll" }, [4, 4]).state; // petak 8
      s = act(s, id, { type: "roll" }, [4, 3]).state; // petak 15
      if (s.phase === "awaiting_buy") s = act(s, id, { type: "skip_buy" }).state;
      if (id === "andi") s = act(s, id, { type: "end_turn" }).state;
    }
    // kebijakan ke-0 (BBM naik), dadu Rezim 1+2 -> petak 19 (kosong) dicaplok
    const r = act(s, "budi", { type: "end_turn" }, [0, 1, 2]);
    assert.deepEqual(
      types(r).filter((t) => ["kebijakan", "rezim_gerak", "rezim_caplok", "ronde_baru"].includes(t)),
      ["kebijakan", "rezim_gerak", "rezim_caplok", "ronde_baru"],
    );
    assert.equal(r.state.tiles[19].owner, GOV);
    assert.equal(r.state.round, 2);
    assert.equal(r.state.rezimPos, 19);
    assert.equal(r.state.turn, 0);
  });

  it("mobil pejabat mampir ke usaha rakyat: bayar sewa dan Kekuasaan turun", () => {
    let s = setup(2);
    s.tiles[19] = { owner: "andi", level: 2 };
    s.turn = 1;
    s.phase = "awaiting_end";
    const r = act(s, "budi", { type: "end_turn" }, [4, 1, 2]); // kebijakan ke-4: pengalihan isu
    assert.ok(types(r).includes("rezim_bayar"));
    assert.equal(r.state.kekuasaan, R.KEKUASAAN_AWAL[2] - R.REZIM_KENA[2]);
    assert.ok(r.state.players.andi.cuan > 20 * JT);
  });

  it("Pemilu tiba dan Rezim masih berkuasa: rakyat kalah", () => {
    const s = setup(2);
    s.round = R.MAX_ROUNDS;
    s.turn = 1;
    s.phase = "awaiting_end";
    const r = act(s, "budi", { type: "end_turn" }, [4, 1, 1]);
    assert.deepEqual(r.state.result, { kind: "rakyat_kalah", reason: "pemilu" });
  });
});

describe("talangan & bangkrut", () => {
  it("Lumbung menalangi warga yang tidak sanggup bayar", () => {
    const s = setup();
    s.players.andi.cuan = 100_000;
    s.players.andi.position = 3;
    s.lumbung = 5 * JT;
    const r = act(s, "andi", { type: "roll" }, [1, 2]);
    assert.ok(types(r).includes("talangan"));
    assert.equal(r.state.players.andi.cuan, 0);
    assert.equal(r.state.lumbung, 4_100_000);
    assert.equal(r.state.players.andi.bankrupt, false);
  });

  it("tanpa Lumbung: usaha dijual rugi, lalu bangkrut; dua warga bangkrut = kalah", () => {
    const s = setup();
    s.players.andi.cuan = 100_000;
    s.players.andi.position = 3;
    s.tiles[1].owner = "andi";
    let r = act(s, "andi", { type: "roll" }, [1, 2]);
    assert.ok(types(r).includes("jual_rugi"));
    assert.equal(r.state.tiles[1].owner, null);
    assert.equal(r.state.players.andi.bankrupt, true);
    assert.equal(r.state.phase, "awaiting_roll");
    assert.equal(r.state.order[r.state.turn], "budi");

    r.state.players.budi.cuan = 0;
    r.state.players.budi.position = 3;
    r = act(r.state, "budi", { type: "roll" }, [1, 2]);
    assert.deepEqual(r.state.result, { kind: "rakyat_kalah", reason: "bangkrut" });
  });

  it("kalau satu-satunya pemain manusia bangkrut, game selesai", () => {
    const s = setup();
    for (const id of ["budi", "citra", "dewi"]) s.players[id].bot = true;
    s.players.andi.cuan = 0;
    s.players.andi.position = 3;
    const r = act(s, "andi", { type: "roll" }, [1, 2]);
    assert.deepEqual(r.state.result, { kind: "rakyat_kalah", reason: "bangkrut" });
  });
});

describe("kontrak dengan klien", () => {
  it("lastEvents berisi event aksi terakhir dan state lama tidak berubah", () => {
    const s = setup();
    const snapshot = JSON.stringify(s);
    const r = act(s, "andi", { type: "roll" }, [1, 3]);
    assert.deepEqual(r.state.lastEvents.map((e) => e.type), ["dadu", "gerak", "tawaran_beli"]);
    assert.equal(JSON.stringify(s), snapshot);
  });

  it("state versi lama ditolak dengan pesan jelas", () => {
    const old = { ...setup(), schema: 1 } as unknown as GameState;
    assert.throws(() => act(old, "andi", { type: "roll" }), (e: GameError) => e.code === "game_lama");
  });

  it("mode Juragan: tidak ada meter, yang terkaya menang di akhir", () => {
    const s = setup(2, "buruh", "juragan");
    s.round = R.MAX_ROUNDS;
    s.turn = 1;
    s.phase = "awaiting_end";
    s.players.budi.cuan += JT;
    const r = act(s, "budi", { type: "end_turn" }, [0, 1, 1]);
    assert.equal(r.state.result?.kind, "juragan_menang");
    assert.equal(r.state.semangat, 0);
  });
});

describe("simulasi", () => {
  it("600 game acak selalu selesai tanpa state rusak", () => {
    const pros: Profession[] = ["buruh", "pedagang", "ojol", "kreator", "jurnalis", "mahasiswa"];
    for (let g = 0; g < 600; g++) {
      const rng = seededRng(g + 1);
      const n = 2 + (g % 5);
      const mode = g % 4 === 0 ? "juragan" : "rakyat_bersatu";
      const members = Array.from({ length: n }, (_, i) => ({
        id: `p${i}`,
        name: `P${i}`,
        seat: i,
        profession: pros[(g + i) % pros.length],
      }));
      let s = createInitialState(`room-${g}`, mode, members, rng);
      for (let step = 0; step < 4000 && s.phase !== "game_over"; step++) {
        const me = s.order[s.turn];
        const options: Action[] = [];
        if (s.phase === "awaiting_roll") options.push({ type: "roll" });
        if (s.phase === "awaiting_buy") options.push({ type: "buy" }, { type: "skip_buy" });
        if (s.phase === "awaiting_end") options.push({ type: "end_turn" });
        if (s.phase === "awaiting_roll" || s.phase === "awaiting_end") {
          if (rng.int(0, 9) === 0) options.push({ type: "petisi" }, { type: "liputan_media" });
          if (rng.int(0, 9) === 0) options.push({ type: "donasi_lumbung", amount: 500_000 });
          const mine = s.tiles.findIndex((t) => t.owner === me && t.level < 3);
          if (mine >= 0 && rng.int(0, 3) === 0) options.push({ type: "upgrade", tile: mine });
        }
        const action = options[rng.int(0, options.length - 1)];
        try {
          s = applyAction(s, me, action, rng).state;
        } catch (e) {
          if (!(e instanceof GameError)) throw e;
          // aksi opsional boleh ditolak (uang kurang, dll), aksi wajib tidak boleh
          if (["roll", "end_turn", "skip_buy", "buy"].includes(action.type)) throw e;
        }
        for (const pl of Object.values(s.players)) {
          assert.ok(Number.isFinite(pl.cuan));
          assert.ok(pl.cuan >= 0, `uang minus: ${pl.cuan}`);
          assert.equal(pl.cuan % 1000, 0, `uang bukan kelipatan 1.000: ${pl.cuan}`);
          assert.ok(pl.position >= 0 && pl.position < R.BOARD_SIZE);
        }
        assert.ok(s.semangat >= 0 && s.semangat < R.SEMANGAT_PENUH);
        assert.ok(s.kekuasaan >= 0 && s.kekuasaan <= s.kekuasaanMaks);
        assert.ok(s.lumbung >= 0);
        if (s.phase !== "game_over") assert.equal(s.players[s.order[s.turn]].bankrupt, false);
      }
      assert.equal(s.phase, "game_over", `game ${g} tidak selesai`);
    }
  });

  it("400 game penuh bot: tidak pernah macet, menang-kalahnya seimbang", () => {
    const menang: Record<number, number> = {};
    const total: Record<number, number> = {};
    for (let g = 0; g < 400; g++) {
      const rng = seededRng(5000 + g);
      const n = 2 + (g % 5);
      const members = Array.from({ length: n }, (_, i) => ({
        id: `b${i}`,
        name: BOT_NAMES[i],
        seat: i,
        profession: null,
        bot: true,
      }));
      let s = createInitialState(`bot-${g}`, "rakyat_bersatu", members, rng);
      const roles = Object.fromEntries(assignSecrets(s.mode, s.order, rng).map((x) => [x.userId, x.role]));
      let perTurn = 0;
      let last = "";
      for (let steps = 0; s.phase !== "game_over"; steps++) {
        const me = s.order[s.turn];
        const key = `${s.round}:${s.turn}`;
        perTurn = key === last ? perTurn + 1 : 0;
        last = key;
        assert.ok(perTurn < 60, `bot macet di satu giliran (game ${g})`);
        assert.ok(steps < 20000, `game ${g} kepanjangan`);
        s = applyAction(s, me, decideBotAction(s, me, roles[me]), rng).state; // tidak boleh melempar
      }
      total[n] = (total[n] ?? 0) + 1;
      if (s.result!.kind === "rakyat_menang") menang[n] = (menang[n] ?? 0) + 1;
    }
    for (const n of [2, 3, 4, 5, 6]) {
      const rate = (menang[n] ?? 0) / total[n];
      assert.ok(rate > 0.3 && rate < 0.9, `${n} pemain: bot menang ${Math.round(rate * 100)}%`);
    }
  });
});
