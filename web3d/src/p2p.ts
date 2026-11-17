// Bermain bareng tanpa server: HP tuan rumah menjalankan aturan (engine yang sama dengan solo)
// dan menyimpan permainan di localStorage-nya. HP tamu mengirim aksi dan menerima state.
import type { Driver } from "./driver.ts";
import { ApiError, type GameRow } from "./errors.ts";
import { modeUji, saluranInternet, type Pesan, type Saluran } from "./net.ts";
import {
  BOT_NAMES,
  GameError,
  PROFESSIONS,
  applyAction,
  createInitialState,
  cryptoRng,
  decideBotAction,
  type Action,
  type GameState,
  type Profession,
} from "./shared.ts";

export type Jenis = "internet" | "lokal";

export interface Anggota {
  id: string;
  nama: string;
  profesi: Profession | null;
  bot?: boolean;
  /** tamu yang sedang tersambung (tuan rumah dan bot selalu dianggap tersambung) */
  ada?: boolean;
}

export interface InfoLobi {
  kode: string;
  jenis: Jenis;
  publik: boolean;
  babak: number;
  tuan: string;
  anggota: Anggota[];
  maks: number;
  mulai: boolean;
}

export const MAKS_PEMAIN = 6;
const TUAN_KEY = "wkwk.tuan.v1";
const TAMU_KEY = "wkwk.tamu.v1";
const PID_KEY = "wkwk.pid";
/** Tamu terputus selama ini saat gilirannya: tuan rumah memainkannya seperti bot sampai dia kembali. */
const TUNGGU_PUTUS_MS = 25_000;

/** Id pemain yang menetap di HP ini, supaya bisa masuk lagi ke room yang sama setelah terputus. */
export function pidSaya(): string {
  // mode uji: beberapa tab di satu peramban harus jadi pemain berbeda
  const simpan = modeUji() ? sessionStorage : localStorage;
  let id = simpan.getItem(PID_KEY);
  if (!id) {
    id = `w${Math.random().toString(36).slice(2, 10)}`;
    simpan.setItem(PID_KEY, id);
  }
  return id;
}

/** Kode room: 6 huruf, tanpa huruf yang mudah tertukar (O/0, I/1). */
export function kodeBaru(): string {
  const H = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => H[cryptoRng.int(0, H.length - 1)]).join("");
}

/** Versi state untuk satu tamu: rahasia orang lain disembunyikan. */
function untuk(state: GameState, pid: string): GameState {
  const r = state.rahasia;
  const diaBuzzer = r.buzzer === pid;
  return {
    ...state,
    rahasia: {
      buzzer: diaBuzzer ? pid : null,
      antre: diaBuzzer ? r.antre : 0,
      rekrut: false,
      tawaran: r.tawaran === pid ? pid : null,
    },
    lastEvents: state.lastEvents.filter((e) => !e.visibleTo || e.visibleTo === pid),
  };
}

// ------------------------------------------------------------------ tuan rumah

interface SimpananTuan {
  info: InfoLobi;
  row: GameRow | null;
}

export interface Tuan {
  info(): InfoLobi;
  onUbah(cb: () => void): void;
  tambahBot(): void;
  hapus(id: string): void;
  setPublik(v: boolean): void;
  /** Mulai permainan; mengembalikan driver untuk layar game tuan rumah. */
  mulai(): Driver;
  /** Driver kalau permainan sudah berjalan (melanjutkan setelah aplikasi ditutup). */
  driver(): Driver | null;
  bubar(): void;
}

export const adaRoomTuan = (): boolean => {
  try {
    const s = JSON.parse(localStorage.getItem(TUAN_KEY) ?? "null") as SimpananTuan | null;
    return !!s && s.row?.state.phase !== "game_over";
  } catch {
    return false;
  }
};

/**
 * Buka room sebagai tuan rumah. `saluran` bisa dari internet atau lokal (QR).
 * `lanjut`: muat room yang tersimpan di HP ini, bukan bikin baru.
 */
export function bukaTuan(
  saluran: Saluran,
  opsi: { jenis: Jenis; publik: boolean; babak: number; nama: string; profesi: Profession; kode?: string; lanjut?: boolean },
): Tuan {
  const me = pidSaya();
  let simpan: SimpananTuan | null = null;
  if (opsi.lanjut) {
    try {
      simpan = JSON.parse(localStorage.getItem(TUAN_KEY) ?? "null");
    } catch {
      simpan = null;
    }
  }
  const info: InfoLobi = simpan?.info ?? {
    kode: opsi.kode ?? kodeBaru(),
    jenis: opsi.jenis,
    publik: opsi.publik,
    babak: opsi.babak,
    tuan: me,
    anggota: [{ id: me, nama: opsi.nama, profesi: opsi.profesi, ada: true }],
    maks: MAKS_PEMAIN,
    mulai: false,
  };
  let row: GameRow | null = simpan?.row ?? null;
  // rekan (id saluran) <-> pemain
  const rekanKe = new Map<string, string>();
  const pemainKe = new Map<string, string>();
  const putusSejak = new Map<string, number>();
  const ubah = new Set<() => void>();
  const subs = new Set<(row: GameRow) => void>();

  const tulis = () => {
    try {
      localStorage.setItem(TUAN_KEY, JSON.stringify({ info, row }));
    } catch {
      /* penyimpanan penuh: lanjut tanpa simpan */
    }
  };
  const kabari = () => {
    tulis();
    saluran.kirim({ t: "lobi", info });
    ubah.forEach((cb) => cb());
  };
  const kirimState = (pid?: string) => {
    if (!row) return;
    for (const [p, rekan] of pemainKe) {
      if (pid && p !== pid) continue;
      saluran.kirim({ t: "state", version: row.version, state: untuk(row.state, p) }, rekan);
    }
  };

  const commit = (actor: string, action: Action) => {
    if (!row) throw new ApiError("Permainan belum dimulai.");
    try {
      const { state } = applyAction(row.state, actor, action, cryptoRng);
      row = { version: row.version + 1, state };
    } catch (e) {
      if (e instanceof GameError) throw new ApiError(e.message, e.code);
      throw e;
    }
    tulis();
    kirimState();
    subs.forEach((cb) => cb(row!));
  };

  saluran.onPesan((p, rekan) => {
    if (p.t === "halo") {
      const pid = String(p.pid);
      const lama = info.anggota.find((a) => a.id === pid);
      if (!lama) {
        if (info.mulai) return saluran.kirim({ t: "tolak", alasan: "Permainan sudah dimulai." }, rekan);
        if (info.anggota.length >= info.maks) return saluran.kirim({ t: "tolak", alasan: "Room sudah penuh." }, rekan);
        const prof = PROFESSIONS.includes(p.profesi as Profession) ? (p.profesi as Profession) : null;
        info.anggota.push({ id: pid, nama: String(p.nama ?? "Warga").slice(0, 24), profesi: prof, ada: true });
      } else lama.ada = true;
      rekanKe.set(rekan, pid);
      pemainKe.set(pid, rekan);
      putusSejak.delete(pid);
      kabari();
      if (info.mulai) kirimState(pid);
      return;
    }
    const pid = rekanKe.get(rekan);
    if (!pid) return;
    if (p.t === "aksi") {
      try {
        commit(pid, p.action as Action);
        saluran.kirim({ t: "hasil", id: p.id }, rekan);
      } catch (e) {
        const err = e instanceof ApiError ? e : new ApiError("Aksi gagal.");
        saluran.kirim({ t: "hasil", id: p.id, galat: err.message, kode: err.code ?? null }, rekan);
        kirimState(pid); // mungkin dia ketinggalan state
      }
    } else if (p.t === "minta") kirimState(pid);
    else if (p.t === "pamit" && !info.mulai) {
      info.anggota = info.anggota.filter((a) => a.id !== pid);
      kabari();
    }
  });
  saluran.onMasuk((rekan) => saluran.kirim({ t: "lobi", info }, rekan));
  saluran.onKeluar((rekan) => {
    const pid = rekanKe.get(rekan);
    rekanKe.delete(rekan);
    if (!pid || pemainKe.get(pid) !== rekan) return;
    pemainKe.delete(pid);
    putusSejak.set(pid, Date.now());
    const a = info.anggota.find((x) => x.id === pid);
    if (!a) return;
    if (!info.mulai) info.anggota = info.anggota.filter((x) => x.id !== pid);
    else a.ada = false;
    kabari();
  });

  // Tamu yang terputus lama tidak boleh membekukan permainan: dimainkan sementara oleh AI.
  const jaga = setInterval(() => {
    if (!row || row.state.phase === "game_over") return;
    const s = row.state;
    const lama = (pid: string) => (putusSejak.get(pid) ?? Infinity) + TUNGGU_PUTUS_MS < Date.now();
    try {
      if (s.phase === "voting" && s.sidang) {
        const v = s.order.find((id) => !s.players[id].bankrupt && s.sidang!.suara[id] === undefined && lama(id));
        if (v) commit(v, { type: "vote", target: null });
        return;
      }
      const cur = s.order[s.turn];
      if (lama(cur) && !s.players[cur].bot) {
        if (s.rahasia.tawaran === cur) commit(cur, { type: "jawab_suap", terima: false });
        else commit(cur, decideBotAction(s, cur, "rakyat"));
      }
    } catch {
      /* dicoba lagi di putaran berikutnya */
    }
  }, 3000);

  // Room publik mengumumkan diri di ruang lobi bersama.
  let iklan: Saluran | null = null;
  let iklanTimer: ReturnType<typeof setInterval> | undefined;
  const pasangIklan = async () => {
    if (info.jenis !== "internet" || !info.publik || info.mulai) {
      clearInterval(iklanTimer);
      iklan?.tutup();
      iklan = null;
      return;
    }
    if (iklan) return;
    iklan = await saluranInternet("lobi-publik");
    const umumkan = (ke?: string) =>
      iklan?.kirim(
        {
          t: "iklan",
          kode: info.kode,
          tuan: info.anggota[0].nama,
          babak: info.babak,
          isi: info.anggota.length,
          maks: info.maks,
        },
        ke,
      );
    iklan.onMasuk((r) => umumkan(r));
    iklanTimer = setInterval(() => umumkan(), 4000);
    umumkan();
  };
  void pasangIklan();
  tulis();

  let drv: Driver | null = null;
  const buatDriver = (): Driver => {
    drv ??= {
      local: false,
      me,
      current: () => row!,
      send: async (action) => commit(me, action),
      botStep: async () => {
        const s = row?.state;
        if (!s || s.phase === "game_over" || s.phase === "voting") return;
        const id = s.order[s.turn];
        if (!s.players[id]?.bot) return;
        commit(id, decideBotAction(s, id, s.rahasia.buzzer === id ? "buzzer" : "rakyat"));
      },
      subscribe(cb) {
        subs.add(cb);
        return () => subs.delete(cb);
      },
      role: () => "rakyat",
      forget: () => {
        localStorage.removeItem(TUAN_KEY);
      },
    };
    return drv;
  };

  return {
    info: () => info,
    onUbah: (cb) => void ubah.add(cb),
    tambahBot() {
      if (info.mulai || info.anggota.length >= info.maks) return;
      const dipakai = new Set(info.anggota.map((a) => a.nama));
      const nama = BOT_NAMES.find((n) => !dipakai.has(n)) ?? `Warga ${info.anggota.length}`;
      info.anggota.push({ id: `bot${Date.now().toString(36)}${info.anggota.length}`, nama, profesi: null, bot: true });
      kabari();
    },
    hapus(id) {
      if (info.mulai || id === me) return;
      info.anggota = info.anggota.filter((a) => a.id !== id);
      const rekan = pemainKe.get(id);
      if (rekan) saluran.kirim({ t: "tolak", alasan: "Kamu dikeluarkan dari room." }, rekan);
      kabari();
    },
    setPublik(v) {
      info.publik = v;
      kabari();
      void pasangIklan();
    },
    mulai() {
      if (info.anggota.length < 2) throw new ApiError("Butuh minimal 2 pemain. Tambah bot kalau teman belum datang.");
      const members = info.anggota.map((a, seat) => ({ id: a.id, name: a.nama, seat, profession: a.profesi, ...(a.bot ? { bot: true } : {}) }));
      const adaBot = info.anggota.some((a) => a.bot);
      const state = createInitialState(info.kode, "rakyat_bersatu", members, cryptoRng, info.babak, null, adaBot || info.anggota.length >= 3);
      // amplop Rezim boleh disodorkan ke pemain manusia juga; jawabannya rahasia
      state.rahasia.suapManusia = true;
      row = { version: 1, state };
      info.mulai = true;
      kabari();
      void pasangIklan();
      kirimState();
      return buatDriver();
    },
    driver: () => (row ? buatDriver() : null),
    bubar() {
      clearInterval(jaga);
      clearInterval(iklanTimer);
      iklan?.tutup();
      saluran.kirim({ t: "bubar" });
      saluran.tutup();
    },
  };
}

// ------------------------------------------------------------------ tamu

export interface Tamu {
  info(): InfoLobi | null;
  onUbah(cb: () => void): void;
  /** dipanggil sekali begitu state permainan pertama tiba */
  onMulai(cb: (driver: Driver) => void): void;
  onTolak(cb: (alasan: string) => void): void;
  tersambung(): boolean;
  keluar(): void;
}

export const simpananTamu = (): { kode: string; jenis: Jenis } | null => {
  try {
    return JSON.parse(localStorage.getItem(TAMU_KEY) ?? "null");
  } catch {
    return null;
  }
};

export function bukaTamu(saluran: Saluran, opsi: { nama: string; profesi: Profession; kode: string; jenis: Jenis }): Tamu {
  const me = pidSaya();
  let info: InfoLobi | null = null;
  let row: GameRow | null = null;
  let tuan: string | null = null;
  let urut = 0;
  const tunggu = new Map<number, { ok: () => void; gagal: (e: Error) => void }>();
  const ubah = new Set<() => void>();
  const mulaiCb = new Set<(d: Driver) => void>();
  const tolakCb = new Set<(a: string) => void>();
  const subs = new Set<(row: GameRow) => void>();
  if (opsi.jenis === "internet") localStorage.setItem(TAMU_KEY, JSON.stringify({ kode: opsi.kode, jenis: opsi.jenis }));

  const halo = (ke?: string) => saluran.kirim({ t: "halo", pid: me, nama: opsi.nama, profesi: opsi.profesi }, ke);
  saluran.onMasuk((r) => halo(r));
  halo();

  const driver: Driver = {
    local: false,
    me,
    current: () => row!,
    send(action) {
      if (!tuan) return Promise.reject(new ApiError("Belum tersambung ke tuan rumah. Tunggu sebentar."));
      const id = ++urut;
      saluran.kirim({ t: "aksi", id, action, versi: row?.version ?? 0 }, tuan);
      return new Promise<void>((ok, gagal) => {
        tunggu.set(id, { ok, gagal });
        setTimeout(() => {
          if (!tunggu.delete(id)) return;
          gagal(new ApiError("Tuan rumah tidak menjawab. Cek sambungannya."));
        }, 12_000);
      });
    },
    botStep: async () => undefined, // bot dijalankan HP tuan rumah
    subscribe(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    role: () => "rakyat",
    forget: () => localStorage.removeItem(TAMU_KEY),
  };

  saluran.onPesan((p: Pesan, dari) => {
    if (p.t === "lobi") {
      const i = p.info as InfoLobi;
      if (opsi.kode && i.kode !== opsi.kode) return; // tanpa internet: kode belum diketahui
      tuan = dari;
      info = i;
      ubah.forEach((cb) => cb());
      // bukan anggota lagi (misal tuan rumah memuat ulang lobi): perkenalkan diri ulang
      if (!i.anggota.some((a) => a.id === me) && !i.mulai) halo(dari);
    } else if (p.t === "state" && dari === tuan) {
      const baru = { version: Number(p.version), state: p.state as GameState };
      const pertama = !row;
      if (row && baru.version <= row.version) return;
      row = baru;
      if (pertama) mulaiCb.forEach((cb) => cb(driver));
      else subs.forEach((cb) => cb(row!));
    } else if (p.t === "hasil") {
      const w = tunggu.get(Number(p.id));
      if (!w) return;
      tunggu.delete(Number(p.id));
      if (p.galat) w.gagal(new ApiError(String(p.galat), p.kode ? String(p.kode) : undefined));
      else w.ok();
    } else if (p.t === "tolak") {
      localStorage.removeItem(TAMU_KEY);
      tolakCb.forEach((cb) => cb(String(p.alasan)));
    } else if (p.t === "bubar") {
      localStorage.removeItem(TAMU_KEY);
      tolakCb.forEach((cb) => cb("Tuan rumah membubarkan room."));
    }
  });
  saluran.onKeluar((r) => {
    if (r !== tuan) return;
    tuan = null;
    ubah.forEach((cb) => cb());
  });

  return {
    info: () => info,
    onUbah: (cb) => void ubah.add(cb),
    onMulai(cb) {
      mulaiCb.add(cb);
      if (row) cb(driver);
    },
    onTolak: (cb) => void tolakCb.add(cb),
    tersambung: () => !!tuan,
    keluar() {
      if (tuan && !info?.mulai) saluran.kirim({ t: "pamit" }, tuan);
      localStorage.removeItem(TAMU_KEY);
      saluran.tutup();
    },
  };
}

// ------------------------------------------------------------------ daftar room publik

export interface Iklan {
  kode: string;
  tuan: string;
  babak: number;
  isi: number;
  maks: number;
  terlihat: number;
}

/** Pantau room publik yang sedang menunggu pemain. Mengembalikan fungsi untuk berhenti. */
export async function pantauRoom(cb: (daftar: Iklan[]) => void): Promise<() => void> {
  const sal = await saluranInternet("lobi-publik");
  const daftar = new Map<string, Iklan>();
  const lapor = () => {
    const kini = Date.now();
    for (const [k, v] of daftar) if (kini - v.terlihat > 12_000) daftar.delete(k);
    cb([...daftar.values()].filter((x) => x.isi < x.maks).sort((a, b) => b.isi - a.isi));
  };
  sal.onPesan((p) => {
    if (p.t !== "iklan") return;
    daftar.set(String(p.kode), {
      kode: String(p.kode),
      tuan: String(p.tuan).slice(0, 24),
      babak: Number(p.babak) || 1,
      isi: Number(p.isi) || 1,
      maks: Number(p.maks) || MAKS_PEMAIN,
      terlihat: Date.now(),
    });
    lapor();
  });
  const t = setInterval(lapor, 3000);
  lapor();
  return () => {
    clearInterval(t);
    sal.tutup();
  };
}
