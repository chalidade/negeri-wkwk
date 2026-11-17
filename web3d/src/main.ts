import "@fontsource/bagel-fat-one/latin.css";
import "@fontsource/plus-jakarta-sans/latin-600.css";
import "@fontsource/plus-jakarta-sans/latin-700.css";
import "@fontsource/plus-jakarta-sans/latin-800.css";
import "./style.css";
import { ApiError, api, getGame, getMembers, getRoom, subscribeRoom, supabase } from "./api.ts";
import { confirmBox, h, sceneEl, toast, ui } from "./dom.ts";
import { hasSoloSave, newSoloGame, onlineGame, resumeSoloGame, type Driver } from "./driver.ts";
import { startGame } from "./game.ts";
import { getStats, showHelp } from "./help.ts";
import { ava, ic, rezimAva } from "./icons.ts";
import { sfx } from "./sfx.ts";
import {
  BABAK,
  JURUS,
  PROFESSIONS,
  PROFESSION_LABEL,
  PROFESSION_SKILL,
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

// ------------------------------------------------------------------ beranda

/** Beranda: kartu warga (nama, pekerjaan, pangkat) jadi pusatnya, lalu lawan dan tombol main. */
function homeScreen(): void {
  const st = getStats();
  const pk = pangkat(st.xp);
  const name = h("input", { placeholder: "Tulis namamu", maxLength: 24, value: savedName(), "aria-label": "Nama warga" });
  name.addEventListener("input", () => localStorage.setItem(NAME_KEY, name.value.trim()));
  let prof = savedProf() ?? "buruh";
  const foto = h("div", { class: "ktp-photo" });
  const kerja = h("dd", {});
  const skill = h("div", { class: "skill" });
  const profBtns = PROFESSIONS.map((p, i) =>
    h(
      "button",
      {
        class: "prof",
        "aria-label": PROFESSION_LABEL[p],
        onclick: () => {
          if (prof === p) return;
          prof = p;
          localStorage.setItem(PROF_KEY, p);
          sfx.click();
          paint(true);
        },
      },
      ava(p, i),
    ),
  );
  const paint = (ganti = false) => {
    profBtns.forEach((b, i) => b.classList.toggle("on", PROFESSIONS[i] === prof));
    const pasFoto = ava(prof, 0, ganti ? "ganti" : "");
    pasFoto.style.background = "#e5432f"; // latar pas foto merah, seperti di kartu sungguhan
    foto.replaceChildren(pasFoto, h("span", { class: "stempel" }, pk.nama));
    kerja.textContent = PROFESSION_LABEL[prof];
    skill.replaceChildren(
      h("div", {}, PROFESSION_SKILL[prof]),
      h("div", {}, ic("petir"), h("b", {}, ` Jurus ${JURUS[prof].nama}: `), `${JURUS[prof].efek}.`),
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

  // Tangga babak: tiap menang, Rezim berikutnya terbuka.
  let babak = st.babak;
  const lawanMid = h("div", { class: "lawan-mid" });
  const prev = h("button", { class: "icon", "aria-label": "Babak sebelumnya", onclick: () => geser(-1) }, ic("kiri"));
  const next = h("button", { class: "icon", "aria-label": "Babak berikutnya", onclick: () => geser(1) }, ic("kanan"));
  const paintBabak = () => {
    const bintang = st.bintang[babak] ?? 0;
    lawanMid.replaceChildren(
      h("small", {}, `Lawan babak ${babak} dari ${BABAK.length}`),
      h("b", {}, BABAK[babak - 1].nama),
      h("div", { class: "stars mini" }, ...[1, 2, 3].map((i) => ic("bintang", i <= bintang ? "on" : ""))),
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

  const adaSimpanan = hasSoloSave();
  show(
    h(
      "div",
      { class: "screen home" },
      h(
        "div",
        { class: "col" },
        h(
          "div",
          { class: "home-top" },
          h("div", {}, h("div", { class: "wordmark" }, h("small", {}, "NEGERI"), h("b", {}, "WKWK")), h("div", { class: "tagline" }, "Monopoli rakyat lawan Rezim")),
          h("button", { class: "icon", "aria-label": "Cara main", onclick: () => showHelp() }, ic("tanya")),
        ),
        h(
          "div",
          { class: "ktp" },
          h("div", { class: "ktp-head" }, h("i", { class: "ktp-flag" }), h("span", {}, "Kartu Warga"), h("span", {}, `No. ${String(st.main + 1).padStart(5, "0")}`)),
          h(
            "div",
            { class: "ktp-body" },
            h(
              "dl",
              { class: "ktp-fields" },
              h("dt", {}, "Nama"),
              h("dd", {}, name),
              h("dt", {}, "Pekerjaan"),
              kerja,
              h("dt", {}, "Menang"),
              h("dd", {}, st.main > 0 ? `${st.menang} dari ${st.main} main` : "belum main"),
              h("dt", {}, "Emas Antum"),
              h("dd", {}, String(st.emas)),
              h("dt", {}, "Berlaku"),
              h("dd", {}, "selama sabar"),
            ),
            foto,
          ),
          h("div", { class: "ktp-xp", title: pk.berikut ? `Menuju ${pk.berikut}` : pk.nama }, h("i", { style: `width:${Math.round(pk.maju * 100)}%` })),
        ),
        h("div", { class: "pilih" }, "Pilih pekerjaanmu"),
        h("div", { class: "profs" }, ...profBtns),
        skill,
        h("div", { class: "lawan" }, rezimAva(), lawanMid, prev, next),
        adaSimpanan ? h("button", { class: "btn big green block", onclick: () => solo(true) }, ic("main"), "Lanjutkan permainan") : null,
        adaSimpanan
          ? h("button", { class: "btn grey block", onclick: () => solo(false) }, ic("dadu"), `Mulai baru dari babak ${st.babak}`)
          : h("button", { class: "btn big red block", onclick: () => solo(false) }, ic("dadu"), "Main sekarang"),
        h("div", { class: "catatan" }, "Solo bareng 3 warga bot. Bisa tanpa internet."),
        h(
          "button",
          {
            class: "btn grey block",
            onclick: async () => {
              const n = needName();
              if (n && (await ensureSignedIn(n))) void onlineScreen();
            },
          },
          ic("warga"),
          "Main bareng teman",
        ),
        h("div", { class: "catatan small" }, "Game satire fiksi. Tidak mewakili lembaga, partai, atau tokoh nyata."),
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
  cleanup = subscribeRoom(roomId, {
    onMembers: () => void renderMembers(),
    onGame: () => void enterRoom(roomId),
  });
}

// ------------------------------------------------------------------ mulai

async function boot(): Promise<void> {
  await Promise.all([
    document.fonts.load('40px "Bagel Fat One"'),
    document.fonts.load('800 16px "Plus Jakarta Sans"'),
    document.fonts.load('600 16px "Plus Jakarta Sans"'),
  ]).catch(() => undefined);
  homeScreen();
}

void boot();
