// Pastikan data yang diduplikasi ke aplikasi Flutter tetap sama dengan server.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import * as R from "../functions/_shared/engine/rules.ts";

const root = new URL("../../", import.meta.url);

it("app/assets/board.json sama dengan versi server", () => {
  const server = readFileSync(new URL("supabase/functions/_shared/board.json", root), "utf8");
  const app = readFileSync(new URL("app/assets/board.json", root), "utf8");
  assert.equal(app, server, "jalankan scripts/sync_board.sh");
});

it("angka di app/lib/models/rules_mirror.dart sama dengan rules.ts", () => {
  const dart = readFileSync(new URL("app/lib/models/rules_mirror.dart", root), "utf8");
  const read = (name: string) => {
    const m = dart.match(new RegExp(`const ${name} = ([0-9.]+);`));
    assert.ok(m, `${name} tidak ditemukan`);
    return Number(m[1]);
  };
  assert.equal(read("petisiBiaya"), R.PETISI_BIAYA);
  assert.equal(read("liputanBiayaLumbung"), R.LIPUTAN_BIAYA_LUMBUNG);
  assert.equal(read("dendaTilang"), R.DENDA_TILANG);
  assert.equal(read("biayaUpgrade"), R.BIAYA_UPGRADE);
  assert.equal(read("maxLevel"), R.MAX_LEVEL);
  assert.equal(read("gerakanMenang"), R.GERAKAN_MENANG);
});
