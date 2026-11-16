// Jalankan: node --test supabase/tests/
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GOV,
  GameError,
  applyAction,
  assignSecrets,
  createInitialState,
  scriptedRng,
  seededRng,
  type Action,
  type GameState,
  type MemberInput,
  type Profession,
} from "../functions/_shared/engine/mod.ts";
import * as R from "../functions/_shared/engine/rules.ts";

const A = "andi";
const B = "budi";
const C = "citra";

function setup(
  professions: Profession[] = ["buruh", "ojol", "jurnalis"],
  mode: "rakyat_bersatu" | "juragan" = "rakyat_bersatu",
): GameState {
  const ids = [A, B, C, "dewi", "eko", "fajar"];
  const members: MemberInput[] = professions.map((p, i) => ({
    id: ids[i],
    name: ids[i],
    seat: i,
    profession: p,
  }));
  return createInitialState("room-1", mode, members, seededRng(42));
}

function act(s: GameState, who: string, action: Action, dice: number[] = []) {
  return applyAction(s, who, action, scriptedRng(dice, seededRng(7)));
}

describe("setup", () => {
  it("membuat state awal yang benar", () => {
    const s = setup(["buruh", "pedagang", "jurnalis"]);
    assert.equal(s.order.length, 3);
    assert.equal(s.players[A].cuan, 1500);
    assert.equal(s.tiles[37].owner, GOV);
    assert.equal(s.tiles[39].owner, GOV);
    assert.equal(s.tiles[6].owner, B, "pedagang dapat lapak gratis di Pasar Kaget");
    assert.equal(s.phase, "awaiting_roll");
  });

  it("buzzer hanya muncul di 5+ pemain mode rakyat", () => {
    const five = ["a", "b", "c", "d", "e"];
    const sec5 = assignSecrets("rakyat_bersatu", five, seededRng(3));
    assert.equal(sec5.filter((x) => x.role === "buzzer").length, 1);
    assert.equal(assignSecrets("rakyat_bersatu", five.slice(0, 4), seededRng(3)).filter((x) => x.role === "buzzer").length, 0);
    assert.equal(assignSecrets("juragan", five, seededRng(3)).filter((x) => x.role === "buzzer").length, 0);
  });
});

describe("giliran", () => {
  it("menolak aksi dari pemain yang bukan gilirannya", () => {
    const s = setup();
    assert.throws(() => act(s, B, { type: "roll" }), (e: unknown) => e instanceof GameError && e.code === "bukan_giliran");
  });

  it("lempar dadu, beli petak, lalu akhiri giliran", () => {
    let s = setup();
    s = act(s, A, { type: "roll" }, [1, 2]).state; // ke petak 3 Kontrakan Petak
    assert.equal(s.players[A].position, 3);
    assert.equal(s.phase, "awaiting_buy");
    s = act(s, A, { type: "buy" }).state;
    assert.equal(s.tiles[3].owner, A);
    assert.equal(s.players[A].cuan, 1440);
    assert.equal(s.phase, "awaiting_end");
    s = act(s, A, { type: "end_turn" }).state;
    assert.equal(s.order[s.turn], B);
    assert.equal(s.phase, "awaiting_roll");
  });

  it("bayar sewa ke sesama rakyat dapat bonus Bangga Produk Lokal", () => {
    let s = setup();
    s.tiles[3].owner = A;
    s.turn = 1; // giliran Budi (ojol)
    const r = act(s, B, { type: "roll" }, [1, 2]);
    s = r.state;
    // sewa 6, bonus 1 untuk masing-masing, ojol dapat 20 per giliran
    assert.equal(s.players[B].cuan, 1500 - 6 + 1 + 20);
    assert.equal(s.players[A].cuan, 1500 + 6 + 1);
    assert.ok(r.events.some((e) => e.type === "bangga_produk_lokal"));
  });

  it("lewat petak Gajian dapat bonus", () => {
    let s = setup();
    s.players[A].position = 38;
    s = act(s, A, { type: "roll" }, [1, 2]).state; // 38 + 3 = 1
    assert.equal(s.players[A].position, 1);
    assert.equal(s.players[A].cuan, 1500 + R.BONUS_LEWAT_GAJIAN);
  });

  it("dadu kembar boleh lempar lagi", () => {
    let s = setup();
    s = act(s, A, { type: "roll" }, [2, 2]).state; // ke petak 4 Potongan Gaji
    assert.equal(s.players[A].cuan, 1350);
    assert.equal(s.phase, "awaiting_roll");
    assert.equal(s.order[s.turn], A);
  });

  it("tiga kali dadu kembar langsung kena tilang", () => {
    let s = setup();
    s.doublesInRow = 2;
    s = act(s, A, { type: "roll" }, [3, 3]).state;
    assert.equal(s.players[A].position, 10);
    assert.equal(s.players[A].jailTurns, 2);
    assert.equal(s.phase, "awaiting_end");
  });

  it("mendarat di Diciduk! langsung ke Kena Tilang", () => {
    let s = setup();
    s.players[A].position = 27;
    s = act(s, A, { type: "roll" }, [1, 2]).state;
    assert.equal(s.players[A].position, 10);
    assert.equal(s.players[A].jailTurns, 2);
  });

  it("kecurigaan tinggi + dadu kembar = OTT", () => {
    let s = setup();
    s.players[A].kecurigaan = 5;
    const r = act(s, A, { type: "roll" }, [4, 4]);
    s = r.state;
    assert.ok(r.events.some((e) => e.type === "ott"));
    assert.equal(s.players[A].position, 10);
    assert.equal(s.players[A].cuan, 1300);
    assert.equal(s.players[A].kecurigaan, 0);
  });
});

describe("bangkrut", () => {
  it("tabungan darurat dipakai dulu sebelum bangkrut", () => {
    let s = setup();
    s.players[A].cuan = 100;
    s.players[A].tabungan = 100;
    s.players[A].position = 34;
    s = act(s, A, { type: "roll" }, [1, 2]).state; // petak 37 Kursi Komisaris, setor 150
    assert.equal(s.players[A].bankrupt, false);
    assert.equal(s.players[A].cuan, 0);
    assert.equal(s.players[A].tabungan, 50);
  });

  it("dua pemain bangkrut = rakyat kalah", () => {
    let s = setup();
    s.players[B].bankrupt = true;
    s.players[A].cuan = 10;
    s.players[A].position = 34;
    s = act(s, A, { type: "roll" }, [1, 2]).state;
    assert.equal(s.players[A].bankrupt, true);
    assert.equal(s.phase, "game_over");
    assert.deepEqual(s.result, { kind: "rakyat_kalah", reason: "dua_bangkrut" });
  });

  it("satu pemain bangkrut menurunkan Meter Gerakan dan giliran pindah", () => {
    let s = setup();
    s.gerakan = 30;
    s.players[A].cuan = 10;
    s.players[A].position = 34;
    s = act(s, A, { type: "roll" }, [1, 2]).state;
    assert.equal(s.players[A].bankrupt, true);
    assert.equal(s.gerakan, 10);
    assert.equal(s.order[s.turn], B);
  });
});

describe("gerakan rakyat", () => {
  it("petisi menaikkan meter dan hanya sekali per giliran", () => {
    let s = setup();
    s = act(s, A, { type: "petisi" }).state;
    assert.equal(s.gerakan, R.PETISI_GERAKAN);
    assert.equal(s.players[A].cuan, 1500 - R.PETISI_BIAYA);
    assert.throws(() => act(s, A, { type: "petisi" }), (e: unknown) => e instanceof GameError && e.code === "aksi_sudah_dipakai");
  });

  it("meter gerakan 100 = rakyat menang", () => {
    let s = setup(["kreator", "ojol", "buruh"]);
    s.gerakan = R.GERAKAN_MENANG - R.PETISI_GERAKAN * 2;
    s = act(s, A, { type: "petisi" }).state; // kreator dapat 2x
    assert.equal(s.phase, "game_over");
    assert.deepEqual(s.result, { kind: "rakyat_menang" });
  });

  it("donasi ke lumbung memberi token Suara Rakyat, liputan memakai lumbung", () => {
    let s = setup();
    s = act(s, A, { type: "donasi_lumbung", amount: 300 }).state;
    assert.equal(s.lumbung, 300);
    assert.equal(s.players[A].suaraRakyat, 3);
    s = act(s, A, { type: "liputan_media" }).state;
    assert.equal(s.lumbung, 300 - R.LIPUTAN_BIAYA_LUMBUNG);
    assert.equal(s.gerakan, R.LIPUTAN_GERAKAN);
  });

  it("menolak setor tabungan melebihi cuan", () => {
    const s = setup();
    assert.throws(() => act(s, A, { type: "setor_tabungan", amount: 99999 }), GameError);
    assert.throws(() => act(s, A, { type: "setor_tabungan", amount: -5 }), GameError);
  });
});

describe("ronde & pemerintah", () => {
  it("akhir ronde: biaya hidup dipotong dan Pemerintah ambil kebijakan", () => {
    let s = setup();
    const before = s.players[C].cuan;
    s.turn = 2;
    s.phase = "awaiting_end";
    const r = act(s, C, { type: "end_turn" });
    s = r.state;
    assert.equal(s.round, 2);
    assert.equal(s.order[s.turn], A);
    assert.ok(r.events.some((e) => e.type === "biaya_hidup"));
    assert.ok(r.events.some((e) => e.type === "gajian"), "gaji dibayar tiap ronde");
    assert.ok(r.events.some((e) => e.type === "kebijakan"));
    assert.notEqual(s.players[C].cuan, before);
  });

  it("Pemerintah meredam gerakan tiap akhir ronde", () => {
    let s = setup();
    s.gerakan = 50;
    s.turn = 2;
    s.phase = "awaiting_end";
    s = act(s, C, { type: "end_turn" }).state;
    assert.ok(s.gerakan < 50);
  });

  it("state asli tidak berubah (fungsi murni)", () => {
    const s = setup();
    const snapshot = JSON.stringify(s);
    act(s, A, { type: "roll" }, [1, 2]);
    assert.equal(JSON.stringify(s), snapshot);
  });
});

describe("simulasi acak", () => {
  it("1.000 game acak selalu selesai tanpa state rusak", () => {
    const pros: Profession[] = ["buruh", "pedagang", "ojol", "kreator", "jurnalis", "mahasiswa"];
    let finished = 0;
    for (let g = 0; g < 1000; g++) {
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

      for (let step = 0; step < 5000 && s.phase !== "game_over"; step++) {
        const me = s.order[s.turn];
        const p = s.players[me];
        const options: Action[] = [];
        if (s.phase === "awaiting_roll") options.push({ type: "roll" });
        if (s.phase === "awaiting_buy") options.push({ type: "buy" }, { type: "skip_buy" });
        if (s.phase === "awaiting_end") options.push({ type: "end_turn" });
        if (s.phase === "awaiting_roll" || s.phase === "awaiting_end") {
          if (mode === "rakyat_bersatu" && rng.int(0, 9) === 0) options.push({ type: "petisi" });
          if (p.cuan > 300 && rng.int(0, 9) === 0) options.push({ type: "donasi_lumbung", amount: 100 });
          const mine = s.tiles.findIndex((t, i) => t.owner === me && t.level < 3 && i % 2 === 1);
          if (mine >= 0 && rng.int(0, 4) === 0) options.push({ type: "upgrade", tile: mine });
        }
        const action = options[rng.int(0, options.length - 1)];
        try {
          s = applyAction(s, me, action, rng).state;
        } catch (e) {
          if (!(e instanceof GameError)) throw e;
          // aksi opsional boleh ditolak (cuan kurang, dll), aksi wajib tidak boleh
          if (["roll", "end_turn", "skip_buy"].includes(action.type)) throw e;
        }

        for (const pl of Object.values(s.players)) {
          assert.ok(Number.isFinite(pl.cuan), "cuan harus angka");
          if (!pl.bankrupt) assert.ok(pl.cuan >= 0, `cuan minus pada pemain hidup: ${pl.cuan}`);
          assert.ok(pl.position >= 0 && pl.position < 40);
        }
        assert.ok(s.gerakan >= 0 && s.gerakan <= 100);
        assert.ok(s.lumbung >= 0);
        if (s.phase !== "game_over") assert.equal(s.players[s.order[s.turn]].bankrupt, false);
      }
      assert.equal(s.phase, "game_over", `game ${g} tidak selesai`);
      finished++;
    }
    assert.equal(finished, 1000);
  });
});
