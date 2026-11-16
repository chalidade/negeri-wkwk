// Jalankan: npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BOT_NAMES,
  GOV,
  NASIB_WNI,
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
/** nyawa Rezim di babak 1 untuk n pemain */
const K = (n: number) => Math.round(R.KEKUASAAN_AWAL[n] * R.nyawaBabak(1));
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
    assert.equal(s.schema, 3);
    assert.equal(s.level, 1);
    assert.equal(s.players.andi.jurus, R.JURUS_AWAL);
    assert.equal(TILES.length, R.BOARD_SIZE);
    assert.equal(s.tiles.length, 32);
    assert.equal(s.players.andi.cuan, 20 * JT);
    assert.equal(s.kekuasaan, K(4));
    assert.equal(setup(2).kekuasaan, K(2));
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
    assert.equal(r.state.kekuasaan, K(4) - R.DEMO_DAMAGE);
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
    assert.equal(r.state.kekuasaan, K(4) - R.LIPUTAN_DAMAGE);
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
    assert.equal(r.state.kekuasaan, K(4) - R.KAMPUNG_DAMAGE);
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
    assert.equal(r.state.kekuasaan, K(2) - R.REZIM_KENA[2]);
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

describe("dadu kendali, jurus, babak", () => {
  it("tenaga lemparan: jitu jatuh di kisaran, meleset jadi acak", () => {
    // urutan angka acak: undian akurasi, lalu dadu (diulang sampai masuk kisaran)
    let r = act(setup(), "andi", { type: "roll", gaya: "kencang" }, [10, 1, 1, 6, 5]);
    assert.deepEqual(r.events[0].payload, { dadu: [6, 5], gaya: "kencang", kena: true });
    assert.equal(r.state.players.andi.position, 11);
    r = act(setup(), "andi", { type: "roll", gaya: "kencang" }, [90, 1, 3]);
    assert.deepEqual(r.events[0].payload, { dadu: [1, 3], gaya: "kencang", kena: false });
  });

  it("jurus terisi tiap giliran sendiri dan kosong setelah dipakai", () => {
    let s = setup(2, "jurnalis");
    assert.throws(() => act(s, "andi", { type: "jurus" }), (e: GameError) => e.code === "jurus_belum_siap");
    s.players.andi.jurus = R.JURUS_PENUH;
    const r = act(s, "andi", { type: "jurus" });
    assert.equal(r.state.players.andi.jurus, 0);
    assert.equal(r.state.kekuasaan, s.kekuasaanMaks - R.JURUS_DAMAGE);
    assert.equal(r.state.players.andi.jasa, R.JURUS_DAMAGE * 3);
    // giliran pindah ke budi: jurus budi bertambah satu
    s = act(s, "andi", { type: "roll" }, [4, 4]).state;
    s = act(s, "andi", { type: "roll" }, [4, 3]).state;
    if (s.phase === "awaiting_buy") s = act(s, "andi", { type: "skip_buy" }).state;
    s = act(s, "andi", { type: "end_turn" }).state;
    assert.equal(s.players.budi.jurus, R.JURUS_AWAL + 1);
  });

  it("Jalan Tikus (ojol) memberi satu lemparan tambahan setelah jalan", () => {
    const s = setup(2, "ojol");
    s.players.andi.jurus = R.JURUS_PENUH;
    assert.throws(() => act(s, "andi", { type: "jurus" }), (e: GameError) => e.code === "fase_salah");
    s.phase = "awaiting_end";
    assert.equal(act(s, "andi", { type: "jurus" }).state.phase, "awaiting_roll");
  });

  it("babak lebih tinggi: Rezim lebih tebal dan pungutannya lebih mahal", () => {
    const members = IDS.map((id, i) => ({ id, name: id, seat: i, profession: "buruh" as Profession }));
    const s = createInitialState("room", "rakyat_bersatu", members, seededRng(1), 6);
    assert.equal(s.level, 6);
    assert.equal(s.kekuasaanMaks, Math.round(R.KEKUASAAN_AWAL[4] * R.nyawaBabak(6)));
    s.players.andi.position = 3;
    const r = act(s, "andi", { type: "roll" }, [1, 2]); // Potongan Gaji DR 1 jt
    assert.equal(r.state.players.andi.cuan, 20 * JT - R.bulat(JT * R.pungutanBabak(6)));
  });
});

describe("Dadu Nasib & buzzer", () => {
  it("kartu Dadu Nasib: angka besar berarti apes", () => {
    const idx = NASIB_WNI.findIndex((c) => c.id === "ortu_sakit");
    const s = setup();
    s.players.andi.position = 8;
    // dadu jalan 1+2 -> petak 11 (Nasib WNI), pilih kartu, lalu Dadu Nasib 6+6
    const r = act(s, "andi", { type: "roll" }, [1, 2, idx, 6, 6]);
    const nasib = r.events.find((e) => e.type === "dadu_nasib")!;
    assert.equal(nasib.payload.tingkat, 2);
    assert.equal(r.state.players.andi.cuan, 20 * JT - 2.5 * JT);
    assert.equal(r.state.players.andi.skipNext, true);
    // angka kecil: mujur
    const r2 = act(s, "andi", { type: "roll" }, [1, 2, idx, 1, 2]);
    assert.equal(r2.state.players.andi.cuan, 20 * JT - 0.1 * JT);
  });

  function denganBuzzer(): GameState {
    const members = IDS.map((id, i) => ({ id, name: id, seat: i, profession: "buruh" as Profession }));
    return createInitialState("room", "rakyat_bersatu", members, seededRng(1), 1, "budi");
  }

  it("sabotase buzzer muncul di akhir ronde tanpa nama, kadang meninggalkan jejak", () => {
    const s = denganBuzzer();
    assert.throws(() => act(s, "andi", { type: "sabotase" }), (e: GameError) => e.code === "bukan_buzzer");
    s.turn = 1;
    const q = act(s, "budi", { type: "sabotase" });
    assert.equal(q.state.rahasia.antre, 1);
    assert.deepEqual(q.state.lastEvents, []);
    const t = q.state;
    t.semangat = 50;
    t.turn = 3;
    t.phase = "awaiting_end";
    // pilih "tagar", jejak muncul (10 <= 60), jejaknya jujur (20 <= 55), kebijakan ke-4, dadu Rezim 1+1
    const r = act(t, "dewi", { type: "end_turn" }, [0, 10, 20, 4, 1, 1]);
    assert.ok(types(r).includes("sabotase"));
    assert.deepEqual(r.state.jejak, { budi: 1 });
    assert.equal(r.state.semangat, 50 - R.SABOTASE_SEMANGAT - 10);
    // jejak palsu (90 > 55) memfitnah warga lain: yang pertama di daftar adalah andi
    const palsu = act(t, "dewi", { type: "end_turn" }, [0, 10, 90, 0, 4, 1, 1]);
    assert.deepEqual(palsu.state.jejak, { andi: 1 });
    assert.ok(r.events.every((e) => e.actor !== "budi" || e.type === "giliran"));
  });

  it("Rezim menyuap bot yang paling kepepet di tengah permainan", () => {
    const members = IDS.map((id, i) => ({ id, name: id, seat: i, profession: "buruh" as Profession, bot: i > 0 }));
    const s = createInitialState("room", "rakyat_bersatu", members, seededRng(1), 1, null, true);
    assert.equal(s.rahasia.buzzer, null);
    s.round = 3;
    s.turn = 3;
    s.phase = "awaiting_end";
    s.players.citra.cuan = 1 * JT; // paling miskin, bobot terbesar
    // suap berhasil (5 <= 28), undian bobot 1 -> yang termiskin; kebijakan ke-4, dadu Rezim 1+1
    const r = act(s, "dewi", { type: "end_turn" }, [5, 1, 4, 1, 1]);
    assert.equal(r.state.rahasia.buzzer, "citra");
    assert.equal(r.state.rahasia.rekrut, false);
    assert.ok(!types(r).includes("sabotase"));
  });

  it("menuduh: benar membongkar buzzer, salah kena denda, cuma satu kesempatan", () => {
    const s = denganBuzzer();
    const benar = act(s, "andi", { type: "tuduh", target: "budi" });
    assert.equal(benar.state.players.budi.buzzer, true);
    assert.equal(benar.state.kekuasaan, s.kekuasaanMaks - R.BONGKAR_DAMAGE);
    assert.equal(benar.state.semangat, R.BONGKAR_SEMANGAT);
    assert.throws(() => act(benar.state, "andi", { type: "tuduh", target: "citra" }), (e: GameError) => e.code === "sudah_tuduh");

    s.semangat = 30;
    const salah = act(s, "andi", { type: "tuduh", target: "citra" });
    assert.ok(types(salah).includes("tuduh_salah"));
    assert.equal(salah.state.players.andi.cuan, 20 * JT - R.FITNAH_DENDA);
    assert.equal(salah.state.semangat, 30 - R.FITNAH_SEMANGAT);
    assert.deepEqual(salah.state.bersih, ["citra"]);
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
      let s = createInitialState(`room-${g}`, mode, members, rng, 1 + (g % 10), g % 2 ? `p${g % n}` : null, g % 4 === 0);
      for (let step = 0; step < 4000 && s.phase !== "game_over"; step++) {
        const me = s.order[s.turn];
        const options: Action[] = [];
        if (s.phase === "awaiting_roll") {
          options.push({ type: "roll" }, { type: "roll", gaya: (["pelan", "sedang", "kencang"] as const)[rng.int(0, 2)] });
        }
        if (s.phase === "awaiting_buy") options.push({ type: "buy" }, { type: "skip_buy" });
        if (s.phase === "awaiting_end") options.push({ type: "end_turn" });
        if (s.phase === "awaiting_roll" || s.phase === "awaiting_end") {
          if (rng.int(0, 9) === 0) options.push({ type: "petisi" }, { type: "liputan_media" });
          if (rng.int(0, 9) === 0) options.push({ type: "donasi_lumbung", amount: 500_000 });
          if (rng.int(0, 5) === 0) options.push({ type: "jurus" });
          if (rng.int(0, 7) === 0) options.push({ type: "sabotase" }, { type: "tuduh", target: `p${rng.int(0, n - 1)}` });
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
          assert.ok(pl.jurus >= 0 && pl.jurus <= R.JURUS_PENUH && pl.jasa >= 0);
        }
        assert.ok(s.semangat >= 0 && s.semangat < R.SEMANGAT_PENUH);
        assert.ok(s.kekuasaan >= 0 && s.kekuasaan <= s.kekuasaanMaks);
        assert.ok(s.lumbung >= 0);
        if (s.phase !== "game_over") assert.equal(s.players[s.order[s.turn]].bankrupt, false);
      }
      assert.equal(s.phase, "game_over", `game ${g} tidak selesai`);
    }
  });

  it("400 game penuh bot di babak 3 (sebagian disusupi buzzer): tidak pernah macet", () => {
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
      let s = createInitialState(`bot-${g}`, "rakyat_bersatu", members, rng, 3, null, g % 5 !== 0);
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
      assert.ok(rate > 0.1 && rate < 0.95, `${n} pemain di babak 3: bot menang ${Math.round(rate * 100)}%`);
    }
  });
});
