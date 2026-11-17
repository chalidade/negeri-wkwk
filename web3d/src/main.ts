import "@fontsource/bagel-fat-one/latin.css";
import "@fontsource/plus-jakarta-sans/latin-600.css";
import "@fontsource/plus-jakarta-sans/latin-700.css";
import "@fontsource/plus-jakarta-sans/latin-800.css";
import "./style.css";
import { confirmBox, h, sceneEl, toast, ui } from "./dom.ts";
import { BACKEND, diAplikasi } from "./config.ts";
import { hasSoloSave, newSoloGame, resumeSoloGame, type Driver } from "./driver.ts";
import { layarBareng } from "./online.ts";
import { startGame } from "./game.ts";
import { getStats, showHelp } from "./help.ts";
import { ava, ic, rezimAva } from "./icons.ts";
import { mulaiMusik, sfx } from "./sfx.ts";
import { ringkasMisi, showMisi, showToko, terapkanKosmetik } from "./toko.ts";
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

const savedName = (): string => (localStorage.getItem(NAME_KEY) ?? "").trim();
const savedProf = (): Profession | null => {
  const p = localStorage.getItem(PROF_KEY) as Profession | null;
  return p && PROFESSIONS.includes(p) ? p : null;
};

function runGame(
  driver: Driver,
  onReplay?: (level: number) => void,
  opsi: { onExit?: () => void; menu?: { label: string; ikon: string; aksi: () => void }[] } = {},
): void {
  cleanup?.();
  cleanup = startGame(driver, { onExit: opsi.onExit ?? (() => homeScreen()), onReplay, menu: opsi.menu });
}

/** Buka "Main bareng teman": tanpa server (bawaan), atau jalur Supabase kalau saklarnya dinyalakan. */
async function bareng(nama: string, prof: Profession, babak: number, kode?: string): Promise<void> {
  if (BACKEND === "supabase") {
    const { bukaOnlineSupabase } = await import("./online-supabase.ts");
    return bukaOnlineSupabase(nama, { show, runGame: (d) => runGame(d), homeScreen, setCleanup: (f) => (cleanup = f) });
  }
  layarBareng(
    {
      nama,
      profesi: prof,
      babak,
      show,
      setCleanup: (f) => (cleanup = f),
      runGame: (d, o) => runGame(d, undefined, o),
      home: () => homeScreen(),
    },
    kode,
  );
}

// ------------------------------------------------------------------ beranda

/** Beranda: kartu warga (nama, pekerjaan, pangkat) jadi pusatnya, lalu lawan dan tombol main. */
function homeScreen(): void {
  mulaiMusik(false);
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
  const misi = ringkasMisi();
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
          "div",
          { class: "row dua" },
          h("button", { class: `btn grey${misi.adaHadiah ? " titik" : ""}`, onclick: () => showMisi(() => homeScreen()) }, ic("bintang"), `Misi ${misi.selesai}/${misi.total}`),
          h("button", { class: "btn grey", onclick: () => showToko(() => homeScreen()) }, ic("koin"), `Toko, ${st.emas} emas`),
        ),
        h(
          "button",
          {
            class: "btn grey block",
            onclick: async () => {
              const n = needName();
              if (n) void bareng(n, prof, babak);
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

// ------------------------------------------------------------------ mulai

async function boot(): Promise<void> {
  await Promise.all([
    document.fonts.load('40px "Bagel Fat One"'),
    document.fonts.load('800 16px "Plus Jakarta Sans"'),
    document.fonts.load('600 16px "Plus Jakarta Sans"'),
  ]).catch(() => undefined);
  terapkanKosmetik();
  // peramban baru mengizinkan suara setelah sentuhan pertama
  addEventListener("pointerdown", () => mulaiMusik(), { once: true });
  daftarkanSW();
  homeScreen();
  // dibuka lewat link undangan (?gabung=KODE): langsung masuk ruang tunggu kalau nama sudah ada
  const kode = new URLSearchParams(location.search).get("gabung");
  if (kode && /^[A-Z0-9]{6}$/i.test(kode)) {
    history.replaceState(null, "", location.pathname);
    const nama = savedName();
    if (nama.length >= 2) void bareng(nama, savedProf() ?? "buruh", getStats().babak, kode);
    else toast(`Isi nama dulu, lalu tekan Main bareng teman dan masukkan kode ${kode.toUpperCase()}.`);
  }
}

/** Service worker: aset game disimpan di HP, jadi game tetap bisa dibuka tanpa internet. */
function daftarkanSW(): void {
  // di aplikasi Android aset sudah ada di dalam paketnya, service worker tidak diperlukan
  if (!("serviceWorker" in navigator) || import.meta.env.DEV || diAplikasi() || new URLSearchParams(location.search).has("debug")) return;
  navigator.serviceWorker.register("/sw.js").catch(() => undefined);
}

void boot();
