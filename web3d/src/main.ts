import "@fontsource/lilita-one";
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/800.css";
import "@fontsource/nunito/900.css";
import "./style.css";
import { ApiError, api, getGame, getMembers, getRoom, subscribeRoom, supabase } from "./api.ts";
import { confirmBox, h, sceneEl, toast, ui } from "./dom.ts";
import { hasSoloSave, newSoloGame, onlineGame, resumeSoloGame, type Driver } from "./driver.ts";
import { startGame } from "./game.ts";
import { getStats, showHelp } from "./help.ts";
import { sfx } from "./sfx.ts";
import {
  BABAK,
  JURUS,
  PROFESSIONS,
  PROFESSION_EMOJI,
  PROFESSION_LABEL,
  PROFESSION_SKILL,
  colorForSeat,
  pangkat,
  type Mode,
  type Profession,
} from "./shared.ts";

const NAME_KEY = "wkwk.nama";
const PROF_KEY = "wkwk.profesi";
let cleanup: (() => void) | null = null;

function show(view: HTMLElement): void {
  cleanup?.();
  cleanup = null;
  sceneEl.style.display = "none";
  ui.replaceChildren(view);
}

const errorMessage = (e: unknown): string => (e instanceof ApiError ? e.message : "Koneksi bermasalah, coba lagi.");
const savedName = (): string => (localStorage.getItem(NAME_KEY) ?? "").trim();
const savedProf = (): Profession | null => {
  const p = localStorage.getItem(PROF_KEY) as Profession | null;
  return p && PROFESSIONS.includes(p) ? p : null;
};

function runGame(driver: Driver, onReplay?: (level: number) => void): void {
  cleanup?.();
  cleanup = startGame(driver, { onExit: () => homeScreen(), onReplay });
}

const logo = () =>
  h(
    "div",
    { class: "logo" },
    h("div", { class: "logo-top" }, "NEGERI"),
    h("div", { class: "logo-main" }, "WKWK"),
    h("div", { class: "logo-tag" }, "Monopoli rakyat lawan Rezim"),
  );

// ------------------------------------------------------------------ beranda

function homeScreen(): void {
  const name = h("input", { placeholder: "Nama kamu, misal: Budi Sabar", maxLength: 24, value: savedName() });
  name.addEventListener("input", () => localStorage.setItem(NAME_KEY, name.value.trim()));
  let prof = savedProf() ?? "buruh";
  const skill = h("div", { class: "skill" });
  const profBtns = PROFESSIONS.map((p) =>
    h(
      "button",
      {
        class: "prof",
        onclick: () => {
          prof = p;
          localStorage.setItem(PROF_KEY, p);
          sfx.click();
          paint();
        },
      },
      h("span", { class: "prof-emoji" }, PROFESSION_EMOJI[p]),
      h("span", {}, PROFESSION_LABEL[p]),
    ),
  );
  const paint = () => {
    profBtns.forEach((b, i) => b.classList.toggle("on", PROFESSIONS[i] === prof));
    skill.replaceChildren(
      h("div", {}, `Keahlian: ${PROFESSION_SKILL[prof]}`),
      h("div", {}, `⚡ Jurus ${JURUS[prof].nama}: ${JURUS[prof].efek}.`),
    );
  };
  paint();

  const needName = (): string | null => {
    const n = name.value.trim();
    if (n.length >= 2) return n;
    toast("Isi nama dulu ya, minimal 2 huruf.");
    name.focus();
    return null;
  };
  const solo = (resume: boolean) => {
    const n = needName();
    if (!n) return;
    sfx.click();
    const again = (level: number) => runGame(newSoloGame(n, prof, "rakyat_bersatu", 3, level), again);
    const saved = resume ? resumeSoloGame() : null;
    if (saved) runGame(saved, again);
    else again(babak);
  };
  const st = getStats();
  const pk = pangkat(st.xp);

  // Tangga babak: tiap menang, Rezim berikutnya terbuka.
  let babak = st.babak;
  const babakBox = h("div", { class: "babak-mid" });
  const prev = h("button", { class: "icon", onclick: () => geser(-1) }, "◀");
  const next = h("button", { class: "icon", onclick: () => geser(1) }, "▶");
  const paintBabak = () => {
    const b = BABAK[babak - 1];
    const bintang = st.bintang[babak] ?? 0;
    babakBox.replaceChildren(
      h("div", { class: "babak-emoji" }, b.emoji),
      h("label", {}, `Babak ${babak} dari ${BABAK.length}`),
      h("div", { class: "babak-nama" }, b.nama),
      h("div", { class: "stars mini" }, ...[1, 2, 3].map((i) => h("span", { class: i <= bintang ? "on" : "" }, "★"))),
    );
    prev.disabled = babak <= 1;
    next.disabled = babak >= st.babak;
  };
  const geser = (d: number) => {
    babak = Math.max(1, Math.min(st.babak, babak + d));
    sfx.click();
    paintBabak();
  };
  paintBabak();

  show(
    h(
      "div",
      { class: "screen" },
      h(
        "div",
        { class: "col" },
        logo(),
        h(
          "div",
          { class: "statline" },
          h("div", {}, `🎖️ ${pk.nama}  ·  🪙 ${st.emas} Emas Antum${st.streak > 1 ? `  ·  🔥 ${st.streak} beruntun` : ""}`),
          h("div", { class: "xpbar thin" }, h("i", { style: `width:${Math.round(pk.maju * 100)}%` })),
        ),
        h("div", { class: "panel babak" }, prev, babakBox, next),
        h(
          "div",
          { class: "panel col" },
          h("label", {}, "Nama warga"),
          name,
          h("label", {}, "Pilih profesi"),
          h("div", { class: "profs" }, ...profBtns),
          skill,
        ),
        hasSoloSave() ? h("button", { class: "btn big green block", onclick: () => solo(true) }, "▶ Lanjutkan Permainan") : null,
        h("button", { class: "btn big block", onclick: () => solo(false) }, hasSoloSave() ? `🎲 Mulai Baru: Babak ${st.babak}` : "🎲 MAIN SEKARANG"),
        h("div", { class: "muted center" }, "Solo: kamu + 3 warga bot melawan Rezim. Langsung main, tanpa internet."),
        h(
          "div",
          { class: "row" },
          h(
            "button",
            {
              class: "btn blue",
              style: "flex:1",
              onclick: async () => {
                const n = needName();
                if (n && (await ensureSignedIn(n))) void onlineScreen();
              },
            },
            "👥 Main Bareng Teman",
          ),
          h("button", { class: "btn grey", onclick: () => showHelp() }, "❓ Cara Main"),
        ),
        h("div", { class: "muted center small" }, "Game satire fiksi. Tidak mewakili lembaga, partai, atau tokoh nyata."),
      ),
    ),
  );
}

// ------------------------------------------------------------------ online

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
  const segA = h("button", {}, "✊ Rakyat Bersatu");
  const segB = h("button", {}, "💰 Juragan");
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
        h("div", { class: "row" }, h("button", { class: "icon", onclick: () => homeScreen() }, "←"), h("div", { class: "h1" }, "Main Bareng Teman")),
        last ? h("button", { class: "btn green block", onclick: () => void lobbyScreen(last) }, "▶ Lanjutkan room terakhir") : null,
        h(
          "div",
          { class: "panel col" },
          h("label", {}, "Bikin room baru"),
          h("div", { class: "seg" }, segA, segB),
          modeHint,
          h("button", { class: "btn block", onclick: () => go(async () => (await api.createRoom(mode, prof)).roomId) }, "➕ Bikin Room"),
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
            "🚪 Keluar akun",
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
            "🗑️ Hapus akun",
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
  const startBtn = h("button", { class: "btn big block" }, "🚀 Mulai Permainan");
  const addBotBtn = h("button", { class: "btn blue block" }, "🤖 Tambah Bot");

  const renderMembers = async () => {
    const members = await getMembers(roomId);
    counter.textContent = `Warga (${members.length}/${room.max_players})`;
    list.replaceChildren(
      ...members.map((m) =>
        h(
          "div",
          { class: "member" },
          h("div", { class: "ava", style: `background:${colorForSeat(m.seat)}` }, PROFESSION_EMOJI[m.profession ?? ""] ?? "🎲"),
          h(
            "div",
            { style: "flex:1" },
            h("b", {}, `${m.is_bot ? "🤖 " : ""}${m.display_name}`),
            h("div", { class: "muted" }, m.profession ? PROFESSION_LABEL[m.profession] : "Profesi acak"),
          ),
          m.user_id === room.host_id ? h("span", { class: "tag", style: "background:#ffb300" }, "👑 Host") : null,
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
                "✕",
              )
            : null,
        ),
      ),
    );
    startBtn.disabled = members.length < 2;
    startBtn.textContent = members.length < 2 ? "Tunggu teman, atau tambah bot" : "🚀 Mulai Permainan";
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
        h("div", { class: "row" }, h("button", { class: "icon", onclick: () => void onlineScreen() }, "←"), h("div", { class: "h1" }, "Ruang Tunggu")),
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
          h("div", {}, room.mode === "rakyat_bersatu" ? "Mode: ✊ Rakyat Bersatu" : "Mode: 💰 Juragan"),
        ),
        counter,
        list,
        host ? addBotBtn : null,
        host ? startBtn : h("div", { class: "panel center" }, "⏳ Menunggu host memulai…"),
      ),
    ),
  );

  await renderMembers();
  cleanup = subscribeRoom(roomId, {
    onMembers: () => void renderMembers(),
    onGame: () => void enterRoom(roomId),
  });
}

// ------------------------------------------------------------------ mulai

async function boot(): Promise<void> {
  await Promise.all([
    document.fonts.load('40px "Lilita One"'),
    document.fonts.load('800 16px Nunito'),
  ]).catch(() => undefined);
  homeScreen();
}

void boot();
