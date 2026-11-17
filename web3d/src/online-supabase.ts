// Jalur online lama lewat Supabase (Edge Functions + realtime).
// Tidak dipakai saat BACKEND = "p2p", dan baru dimuat kalau diaktifkan, jadi supabase-js tidak ikut terunduh.
import { ApiError, api, getGame, getMembers, getRoom, getSecret, subscribeRoom, supabase, type GameRow } from "./api.ts";
import { confirmBox, h, toast } from "./dom.ts";
import type { Driver } from "./driver.ts";
import { ava, ic } from "./icons.ts";
import { PROFESSIONS, PROFESSION_LABEL, type Mode, type Profession } from "./shared.ts";

interface Konteks {
  show(view: HTMLElement): void;
  runGame(driver: Driver): void;
  homeScreen(): void;
  setCleanup(fn: (() => void) | null): void;
}
let K: Konteks;
const homeScreen = () => K.homeScreen();
const show = (v: HTMLElement) => K.show(v);
const runGame = (d: Driver) => K.runGame(d);
const errorMessage = (e: unknown): string => (e instanceof ApiError ? e.message : "Koneksi bermasalah, coba lagi.");
const savedProf = (): Profession | null => {
  const p = localStorage.getItem("wkwk.profesi") as Profession | null;
  return p && PROFESSIONS.includes(p) ? p : null;
};

/** Pintu masuk dari beranda. */
export async function bukaOnlineSupabase(nama: string, ctx: Konteks): Promise<void> {
  K = ctx;
  if (await ensureSignedIn(nama)) await onlineScreen();
}

// ------------------------------------------------------------------ online

async function onlineGame(roomId: string): Promise<Driver | null> {
  const first = await getGame(roomId);
  if (!first || first.state.schema !== 3) return null;
  const me = (await supabase.auth.getUser()).data.user?.id ?? "";
  const secret = await getSecret(roomId);
  let cur: GameRow = first;
  const subs = new Set<(row: GameRow) => void>();
  let stop: (() => void) | null = null;
  let poll: ReturnType<typeof setInterval> | undefined;

  const push = (row: GameRow) => {
    if (!row?.state || row.version <= cur.version) return;
    cur = { version: row.version, state: row.state };
    subs.forEach((cb) => cb(cur));
  };
  const refresh = async () => {
    const g = await getGame(roomId).catch(() => null);
    if (g) push(g);
  };
  const stale = (e: unknown) =>
    e instanceof ApiError && (e.code === "state_basi" || e.code === "bukan_giliran_bot");

  return {
    local: false,
    me,
    current: () => cur,
    async send(action) {
      try {
        push(await api.action(roomId, cur.version, action));
      } catch (e) {
        if (!stale(e)) throw e;
        await refresh();
      }
    },
    async botStep() {
      try {
        push(await api.botStep(roomId, cur.version));
      } catch (e) {
        if (!stale(e)) throw e;
        await refresh();
      }
    },
    subscribe(cb) {
      subs.add(cb);
      if (!stop) {
        stop = subscribeRoom(roomId, { onGame: push });
        // Jaga-jaga kalau realtime terputus.
        poll = setInterval(() => void refresh(), 8000);
      }
      return () => {
        subs.delete(cb);
        if (subs.size > 0) return;
        stop?.();
        stop = null;
        clearInterval(poll);
      };
    },
    role: () => secret?.role ?? "rakyat",
    forget: () => localStorage.removeItem("lastRoom"),
  };
}


async function ensureSignedIn(name: string): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    const { error } = await supabase.auth.signInAnonymously({ options: { data: { display_name: name } } });
    if (error) {
      toast(`Gagal tersambung: ${error.message}`);
      return false;
    }
    return true;
  }
  const user = data.session.user;
  if (user.user_metadata?.display_name !== name) {
    await supabase.auth.updateUser({ data: { display_name: name } });
    await supabase.from("profiles").update({ display_name: name }).eq("id", user.id);
  }
  return true;
}

async function enterRoom(roomId: string): Promise<void> {
  const driver = await onlineGame(roomId).catch(() => null);
  if (!driver) {
    localStorage.removeItem("lastRoom");
    toast("Room itu sudah tidak bisa dibuka. Bikin room baru ya.");
    return onlineScreen();
  }
  runGame(driver);
}

async function onlineScreen(): Promise<void> {
  let mode: Mode = "rakyat_bersatu";
  const segA = h("button", {}, "Rakyat Bersatu");
  const segB = h("button", {}, "Juragan");
  const modeHint = h("div", { class: "muted" });
  const setMode = (m: Mode) => {
    mode = m;
    segA.className = m === "rakyat_bersatu" ? "on" : "";
    segB.className = m === "juragan" ? "on" : "";
    modeHint.textContent =
      m === "rakyat_bersatu"
        ? "Semua warga satu tim menumbangkan Rezim."
        : "Saling bersaing jadi yang paling tajir, Rezim tetap mengganggu.";
  };
  segA.onclick = () => setMode("rakyat_bersatu");
  segB.onclick = () => setMode("juragan");
  setMode(mode);

  const code = h("input", { placeholder: "KODE ROOM", maxLength: 6, style: "text-transform:uppercase" });
  const go = async (fn: () => Promise<string>) => {
    try {
      const roomId = await fn();
      localStorage.setItem("lastRoom", roomId);
      void lobbyScreen(roomId);
    } catch (e) {
      toast(errorMessage(e));
    }
  };
  const last = localStorage.getItem("lastRoom");
  const prof = savedProf();

  show(
    h(
      "div",
      { class: "screen" },
      h(
        "div",
        { class: "col" },
        h("div", { class: "row" }, h("button", { class: "icon", "aria-label": "Kembali", onclick: () => homeScreen() }, ic("kiri")), h("div", { class: "h1" }, "Main Bareng Teman")),
        last ? h("button", { class: "btn green block", onclick: () => void lobbyScreen(last) }, ic("main"), "Lanjutkan room terakhir") : null,
        h(
          "div",
          { class: "panel col" },
          h("label", {}, "Bikin room baru"),
          h("div", { class: "seg" }, segA, segB),
          modeHint,
          h("button", { class: "btn block", onclick: () => go(async () => (await api.createRoom(mode, prof)).roomId) }, ic("tambah"), "Bikin room"),
        ),
        h(
          "div",
          { class: "panel col" },
          h("label", {}, "Gabung room teman"),
          h(
            "div",
            { class: "row" },
            code,
            h(
              "button",
              {
                class: "btn blue",
                onclick: () => {
                  const c = code.value.trim().toUpperCase();
                  if (c.length !== 6) return toast("Kode room 6 karakter.");
                  void go(async () => (await api.joinRoom(c, prof)).roomId);
                },
              },
              "Gabung",
            ),
          ),
        ),
        h(
          "div",
          { class: "row center" },
          h(
            "button",
            {
              class: "btn small grey",
              onclick: async () => {
                await supabase.auth.signOut();
                localStorage.removeItem("lastRoom");
                homeScreen();
              },
            },
            ic("keluar"),
            "Keluar akun",
          ),
          h(
            "button",
            {
              class: "btn small grey",
              onclick: async () => {
                if (!(await confirmBox("Hapus akun?", "Akun online dan data permainanmu dihapus permanen.", "Hapus"))) return;
                try {
                  await api.deleteAccount();
                  await supabase.auth.signOut();
                  localStorage.removeItem("lastRoom");
                  homeScreen();
                } catch (e) {
                  toast(errorMessage(e));
                }
              },
            },
            "Hapus akun",
          ),
        ),
      ),
    ),
  );
}

async function lobbyScreen(roomId: string): Promise<void> {
  if (await getGame(roomId).catch(() => null)) return enterRoom(roomId);
  let room;
  try {
    room = await getRoom(roomId);
  } catch {
    localStorage.removeItem("lastRoom");
    toast("Room tidak ditemukan.");
    return onlineScreen();
  }
  const me = (await supabase.auth.getUser()).data.user?.id;
  const host = room.host_id === me;
  const list = h("div", { class: "col", style: "gap:8px" });
  const counter = h("label", {});
  const startBtn = h("button", { class: "btn big red block" }, "Mulai permainan");
  const addBotBtn = h("button", { class: "btn grey block" }, ic("robot"), "Tambah bot");

  const renderMembers = async () => {
    const members = await getMembers(roomId);
    counter.textContent = `Warga (${members.length}/${room.max_players})`;
    list.replaceChildren(
      ...members.map((m) =>
        h(
          "div",
          { class: "member" },
          ava(m.profession, m.seat),
          h(
            "div",
            { style: "flex:1" },
            h("b", {}, m.is_bot ? ic("robot") : null, m.is_bot ? ` ${m.display_name}` : m.display_name),
            h("div", { class: "muted" }, m.profession ? PROFESSION_LABEL[m.profession] : "Profesi acak"),
          ),
          m.user_id === room.host_id ? h("span", { class: "tag", style: "background:var(--ink)" }, ic("mahkota"), "Host") : null,
          m.is_bot && host
            ? h(
                "button",
                {
                  class: "icon",
                  onclick: async () => {
                    await api.removeBot(roomId, m.user_id).catch((e) => toast(errorMessage(e)));
                    await renderMembers();
                  },
                },
                ic("silang"),
              )
            : null,
        ),
      ),
    );
    startBtn.disabled = members.length < 2;
    startBtn.textContent = members.length < 2 ? "Tunggu teman, atau tambah bot" : "Mulai permainan";
    addBotBtn.style.display = members.length >= room.max_players ? "none" : "";
  };

  addBotBtn.onclick = async () => {
    addBotBtn.disabled = true;
    await api.addBot(roomId).catch((e) => toast(errorMessage(e)));
    await renderMembers();
    addBotBtn.disabled = false;
  };
  startBtn.onclick = async () => {
    startBtn.disabled = true;
    try {
      await api.startGame(roomId);
      void enterRoom(roomId);
    } catch (e) {
      toast(errorMessage(e));
      startBtn.disabled = false;
    }
  };

  show(
    h(
      "div",
      { class: "screen" },
      h(
        "div",
        { class: "col" },
        h("div", { class: "row" }, h("button", { class: "icon", "aria-label": "Kembali", onclick: () => void onlineScreen() }, ic("kiri")), h("div", { class: "h1" }, "Ruang Tunggu")),
        h(
          "div",
          { class: "panel col center" },
          h("label", {}, "Kode room"),
          h(
            "div",
            {
              class: "code",
              onclick: () => void navigator.clipboard?.writeText(room.code).then(() => toast("Kode disalin!")),
            },
            room.code,
          ),
          h("div", { class: "muted" }, "Ketuk kode untuk menyalin, lalu kirim ke teman."),
          h("div", {}, room.mode === "rakyat_bersatu" ? "Mode Rakyat Bersatu" : "Mode Juragan"),
        ),
        counter,
        list,
        host ? addBotBtn : null,
        host ? startBtn : h("div", { class: "panel center" }, "Menunggu host memulai…"),
      ),
    ),
  );

  await renderMembers();
  K.setCleanup(subscribeRoom(roomId, {
    onMembers: () => void renderMembers(),
    onGame: () => void enterRoom(roomId),
  }));
}

