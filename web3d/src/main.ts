import "./style.css";
import {
  ApiError,
  api,
  getEvents,
  getGame,
  getMembers,
  getRoom,
  getSecret,
  subscribeRoom,
  supabase,
  type EventRow,
  type SecretRow,
} from "./api.ts";
import { describeEvent, popupFor, resultText } from "./events.ts";
import { GameScene } from "./scene/game-scene.ts";
import {
  GOV,
  LEVEL_LABEL,
  MIMPI_LABEL,
  PROFESSION_EMOJI,
  PROFESSION_LABEL,
  TILES,
  colorForSeat,
  playersInOrder,
  rules,
  scaled,
  type Action,
  type GameState,
} from "./shared.ts";

const ui = document.getElementById("ui")!;
const sceneEl = document.getElementById("scene")!;
let cleanup: (() => void) | null = null;

// ------------------------------------------------------------------ helper DOM

type Child = Node | string | null | undefined | false;

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") el.className = String(v);
    else if (k === "style") el.setAttribute("style", String(v));
    else if (k.startsWith("on") && typeof v === "function") {
      el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    } else if (k in el) {
      (el as unknown as Record<string, unknown>)[k] = v;
    } else el.setAttribute(k, String(v));
  }
  for (const c of children) if (c) el.append(c);
  return el;
}

function nodes(...children: Child[]): (Node | string)[] {
  return children.filter((c): c is Node | string => !!c);
}

function show(view: HTMLElement): void {
  cleanup?.();
  cleanup = null;
  ui.replaceChildren(view);
}

function toast(msg: string): void {
  const t = h("div", { class: "toast" }, msg);
  ui.append(t);
  setTimeout(() => t.remove(), 2600);
}

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return "Koneksi bermasalah, coba lagi.";
}

function modal(content: HTMLElement, onClose?: () => void): () => void {
  const close = () => {
    overlay.remove();
    onClose?.();
  };
  const overlay = h("div", { class: "overlay", onclick: (e: Event) => e.target === overlay && close() }, content);
  ui.append(overlay);
  return close;
}

function confirmBox(title: string, text: string, okLabel: string): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: boolean) => {
      if (done) return;
      done = true;
      close();
      resolve(v);
    };
    const box = h(
      "div",
      { class: "modal col" },
      h("div", { class: "title", style: "font-size:22px" }, title),
      h("div", {}, text),
      h(
        "div",
        { class: "row" },
        h("button", { class: "btn alt", onclick: () => finish(false) }, "Batal"),
        h("button", { class: "btn red", onclick: () => finish(true) }, okLabel),
      ),
    );
    const close = modal(box, () => finish(false));
  });
}

function askAmount(title: string, max: number): Promise<number | null> {
  return new Promise((resolve) => {
    let done = false;
    const input = h("input", { type: "number", inputMode: "numeric", min: "1", placeholder: `Maksimal ₵${max}` });
    const finish = (v: number | null) => {
      if (done) return;
      done = true;
      close();
      resolve(v);
    };
    const box = h(
      "div",
      { class: "modal col" },
      h("div", { class: "title", style: "font-size:22px" }, title),
      input,
      h(
        "div",
        { class: "row" },
        h("button", { class: "btn alt", onclick: () => finish(null) }, "Batal"),
        h(
          "button",
          {
            class: "btn",
            onclick: () => {
              const n = Math.floor(Number(input.value));
              finish(n > 0 ? Math.min(n, max) : null);
            },
          },
          "OK",
        ),
      ),
    );
    const close = modal(box, () => finish(null));
    setTimeout(() => input.focus(), 50);
  });
}

// ------------------------------------------------------------------ login & beranda

async function displayName(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const n = data.user?.user_metadata?.display_name;
  return typeof n === "string" ? n : "Warga";
}

function loginScreen(): void {
  const name = h("input", { placeholder: "Nama warga, misal: Budi Sabar", maxLength: 24 });
  const btn = h("button", { class: "btn block" }, "Masuk sebagai Warga");
  const go = async () => {
    const n = name.value.trim();
    if (n.length < 2) return toast("Nama minimal 2 huruf ya.");
    btn.disabled = true;
    const { error } = await supabase.auth.signInAnonymously({ options: { data: { display_name: n } } });
    btn.disabled = false;
    if (error) return toast(`Gagal masuk: ${error.message}`);
    void homeScreen();
  };
  btn.addEventListener("click", go);
  name.addEventListener("keydown", (e) => e.key === "Enter" && go());
  show(
    h(
      "div",
      { class: "screen stars" },
      h(
        "div",
        { class: "col" },
        h(
          "div",
          { class: "logo" },
          h("div", { style: "font-size:58px" }, "🇮🇩😭"),
          h("div", { class: "title big" }, "Negeri Wkwk"),
          h("div", { class: "muted" }, "Bertahan hidup, saling jaga, lawan Pemerintah."),
        ),
        h("div", { class: "panel col" }, h("label", {}, "Nama kamu"), name, btn),
        h(
          "div",
          { class: "muted", style: "text-align:center" },
          "Game satire fiksi. Tidak mewakili lembaga, partai, atau tokoh nyata.",
        ),
      ),
    ),
  );
  setTimeout(() => name.focus(), 50);
}

async function homeScreen(): Promise<void> {
  sceneEl.style.display = "none";
  const nm = await displayName();
  let mode = "rakyat_bersatu";
  const prof = h(
    "select",
    {},
    h("option", { value: "" }, "🎰 Acak"),
    ...Object.entries(PROFESSION_LABEL).map(([k, v]) => h("option", { value: k }, `${PROFESSION_EMOJI[k]} ${v}`)),
  );
  const segA = h("button", { class: "on" }, "✊ Rakyat Bersatu");
  const segB = h("button", {}, "💰 Juragan");
  const modeHint = h("div", { class: "muted" });
  const setMode = (m: string) => {
    mode = m;
    segA.className = m === "rakyat_bersatu" ? "on" : "";
    segB.className = m === "juragan" ? "on" : "";
    modeHint.textContent =
      m === "rakyat_bersatu"
        ? "Semua satu tim melawan Pemerintah. Hati-hati ada Buzzer (5+ pemain)."
        : "Saling bersaing jadi juragan, Pemerintah tetap mengganggu.";
  };
  segA.onclick = () => setMode("rakyat_bersatu");
  segB.onclick = () => setMode("juragan");
  setMode(mode);

  const code = h("input", { placeholder: "Kode room", maxLength: 6, style: "text-transform:uppercase" });
  const busyWrap = async (fn: () => Promise<string>) => {
    try {
      const roomId = await fn();
      localStorage.setItem("lastRoom", roomId);
      void lobbyScreen(roomId);
    } catch (e) {
      toast(errorMessage(e));
    }
  };
  const last = localStorage.getItem("lastRoom");
  const soloBtn = h("button", { class: "btn alt block" }, "🤖 Main Solo vs 3 Bot");
  soloBtn.onclick = async () => {
    soloBtn.disabled = true;
    try {
      soloBtn.textContent = "⏳ Nyiapin room…";
      const { roomId } = await api.createRoom(mode, prof.value || null);
      localStorage.setItem("lastRoom", roomId);
      for (let i = 0; i < 3; i++) {
        soloBtn.textContent = `⏳ Manggil bot ${i + 1}/3…`;
        await api.addBot(roomId);
      }
      soloBtn.textContent = "⏳ Mulai!";
      await api.startGame(roomId);
      void gameScreen(roomId);
    } catch (e) {
      toast(errorMessage(e));
      soloBtn.disabled = false;
      soloBtn.textContent = "🤖 Main Solo vs 3 Bot";
    }
  };

  show(
    h(
      "div",
      { class: "screen stars" },
      h(
        "div",
        { class: "col" },
        h(
          "div",
          { class: "row", style: "justify-content:space-between" },
          h("div", { class: "title", style: "font-size:26px;color:var(--gold)" }, "Negeri Wkwk"),
          h(
            "div",
            { class: "row" },
            h("button", { class: "iconbtn", title: "Keluar", onclick: () => void supabase.auth.signOut() }, "🚪"),
            h(
              "button",
              {
                class: "iconbtn",
                title: "Hapus akun",
                onclick: async () => {
                  if (!(await confirmBox("Hapus akun?", "Akun dan data permainanmu dihapus permanen.", "Hapus"))) return;
                  try {
                    await api.deleteAccount();
                    await supabase.auth.signOut();
                  } catch (e) {
                    toast(errorMessage(e));
                  }
                },
              },
              "🗑️",
            ),
          ),
        ),
        h("div", { class: "title", style: "font-size:24px" }, `Halo, ${nm} 👋`),
        last &&
          h(
            "button",
            { class: "btn alt block", onclick: () => void lobbyScreen(last) },
            "▶️ Lanjutkan room terakhir",
          ),
        h("div", { class: "panel col" }, h("label", {}, "Profesi"), prof),
        h(
          "div",
          { class: "panel col" },
          h("label", {}, "Bikin room baru"),
          h("div", { class: "seg" }, segA, segB),
          modeHint,
          h(
            "button",
            {
              class: "btn block",
              onclick: () =>
                busyWrap(async () => (await api.createRoom(mode, prof.value || null)).roomId),
            },
            "➕ Bikin Room",
          ),
          soloBtn,
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
                class: "btn alt",
                onclick: () => {
                  const c = code.value.trim().toUpperCase();
                  if (c.length !== 6) return toast("Kode room 6 karakter.");
                  void busyWrap(async () => (await api.joinRoom(c, prof.value || null)).roomId);
                },
              },
              "Gabung",
            ),
          ),
        ),
      ),
    ),
  );
}

// ------------------------------------------------------------------ lobby

async function lobbyScreen(roomId: string): Promise<void> {
  sceneEl.style.display = "none";
  const existing = await getGame(roomId).catch(() => null);
  if (existing) return gameScreen(roomId);

  let room;
  try {
    room = await getRoom(roomId);
  } catch {
    localStorage.removeItem("lastRoom");
    toast("Room tidak ditemukan.");
    return homeScreen();
  }
  const me = (await supabase.auth.getUser()).data.user?.id;
  const list = h("div", { class: "col", style: "gap:8px" });
  const startBtn = h("button", { class: "btn block" }, "🚀 Mulai Permainan");
  const counter = h("label", {});
  const addBotBtn = h("button", { class: "btn alt block" }, "🤖 Tambah Bot");
  addBotBtn.addEventListener("click", async () => {
    addBotBtn.disabled = true;
    try {
      await api.addBot(roomId);
      await renderMembers();
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      addBotBtn.disabled = false;
    }
  });

  const renderMembers = async () => {
    const members = await getMembers(roomId);
    counter.textContent = `Warga (${members.length}/${room.max_players})`;
    list.replaceChildren(
      ...members.map((m) =>
        h(
          "div",
          { class: "member" },
          h("div", { class: "avatar", style: `background:${colorForSeat(m.seat)}` }, PROFESSION_EMOJI[m.profession ?? ""] ?? "🎰"),
          h(
            "div",
            { style: "flex:1" },
            h("div", { class: "title", style: "font-size:17px" }, `${m.is_bot ? "🤖 " : ""}${m.display_name}`),
            h("div", { class: "muted" }, m.profession ? PROFESSION_LABEL[m.profession] : "Profesi acak"),
          ),
          m.user_id === room.host_id && h("div", { class: "badge", style: "background:var(--gold);color:#000" }, "👑 Host"),
          m.is_bot && room.host_id === me &&
            h(
              "button",
              {
                class: "iconbtn",
                title: "Keluarkan bot",
                onclick: async () => {
                  try {
                    await api.removeBot(roomId, m.user_id);
                    await renderMembers();
                  } catch (e) {
                    toast(errorMessage(e));
                  }
                },
              },
              "✕",
            ),
        ),
      ),
    );
    startBtn.disabled = members.length < 2;
    startBtn.textContent = members.length < 2 ? "Tunggu teman, atau tambah bot" : "🚀 Mulai Permainan";
    addBotBtn.style.display = members.length >= room.max_players ? "none" : "";
  };

  startBtn.addEventListener("click", async () => {
    startBtn.disabled = true;
    try {
      await api.startGame(roomId);
      void gameScreen(roomId);
    } catch (e) {
      toast(errorMessage(e));
      startBtn.disabled = false;
    }
  });

  show(
    h(
      "div",
      { class: "screen stars" },
      h(
        "div",
        { class: "col" },
        h("button", { class: "iconbtn", onclick: () => void homeScreen() }, "←"),
        h(
          "div",
          { class: "panel col", style: "text-align:center" },
          h("label", {}, "Kode room"),
          h(
            "div",
            {
              class: "code",
              onclick: () => {
                void navigator.clipboard?.writeText(room.code).then(() => toast("Kode disalin!"));
              },
            },
            room.code,
          ),
          h("div", { class: "muted" }, "Ketuk kode untuk menyalin, lalu share ke grup."),
          h("div", {}, room.mode === "rakyat_bersatu" ? "Mode: ✊ Rakyat Bersatu" : "Mode: 💰 Juragan"),
        ),
        counter,
        list,
        room.host_id === me ? addBotBtn : null,
        room.host_id === me ? startBtn : h("div", { class: "waiting" }, "⏳ Menunggu host memulai…"),
      ),
    ),
  );

  await renderMembers();
  const unsub = subscribeRoom(roomId, {
    onMembers: () => void renderMembers(),
    onGame: () => void gameScreen(roomId),
  });
  cleanup = unsub;
}

// ------------------------------------------------------------------ permainan

async function gameScreen(roomId: string): Promise<void> {
  const row = await getGame(roomId);
  if (!row) return lobbyScreen(roomId);
  const me = (await supabase.auth.getUser()).data.user?.id ?? "";
  const secret: SecretRow | null = await getSecret(roomId);
  let state: GameState = row.state;
  let version = row.version;
  let events: EventRow[] = await getEvents(roomId);
  let busy = false;
  let drawerOpen = false;
  let disposed = false;
  const seenEvents = new Set(events.map((e) => e.id));

  // Tekstur papan memakai font web: pastikan sudah termuat sebelum digambar.
  await Promise.all([
    document.fonts.load('150px "Lilita One"'),
    document.fonts.load('800 30px Nunito'),
  ]).catch(() => undefined);
  sceneEl.style.display = "block";
  sceneEl.replaceChildren();
  const scene = new GameScene(sceneEl, (i) => showTile(i));

  const top = h("div", { class: "hud-top" });
  const bottom = h("div", { class: "hud-bottom" });
  const drawer = h("div", { class: "drawer" });
  const root = h("div", { style: "position:absolute;inset:0" }, top, bottom, drawer);
  show(root);

  const send = async (action: Action) => {
    if (busy) return;
    busy = true;
    renderBottom();
    try {
      const res = await api.action(roomId, version, action);
      applyState(res.state, res.version);
    } catch (e) {
      if (!(e instanceof ApiError && e.code === "state_basi")) toast(errorMessage(e));
    } finally {
      busy = false;
      renderBottom();
    }
  };

  function applyState(s: GameState, v: number) {
    if (v < version) return;
    state = s;
    version = v;
    scene.update(state, version);
    renderTop();
    renderBottom();
    if (drawerOpen) renderDrawer();
    if (state.phase === "game_over") showGameOver();
    scheduleBot();
  }

  // --- penggerak bot: tiap pemain manusia "menyenggol" server saat giliran bot.
  // Server yang memutuskan aksinya; jeda di sini supaya dadu & pion sempat terlihat.
  let botTimer: ReturnType<typeof setTimeout> | undefined;
  let botVersion = -1;
  function scheduleBot(retry = false) {
    const cur = state.players[state.order[state.turn]];
    if (state.phase === "game_over" || !cur?.bot || !state.players[me]) return;
    if (botVersion === version && !retry) return;
    botVersion = version;
    clearTimeout(botTimer);
    // Habis lempar dadu tunggu animasi dadu + pion jalan; aksi lain lebih cepat.
    const base = state.phase === "awaiting_roll" ? 1100 : 2500;
    // Kalau ada beberapa manusia, yang kursinya belakangan menunggu lebih lama (cadangan).
    const humans = playersInOrder(state).filter((p) => !p.bot);
    const extra = Math.max(0, humans.findIndex((p) => p.id === me)) * 2500;
    const at = version;
    botTimer = setTimeout(async () => {
      if (version !== at || disposed) return;
      try {
        const res = await api.botStep(roomId, at);
        applyState(res.state, res.version);
      } catch (e) {
        if (e instanceof ApiError && (e.code === "state_basi" || e.code === "bukan_giliran_bot")) {
          const g = await getGame(roomId).catch(() => null);
          if (g) applyState(g.state, g.version);
          return;
        }
        if (e instanceof ApiError && e.code === "bukan_pemain") return;
        setTimeout(() => scheduleBot(true), 3000);
      }
    }, retry ? 0 : base + extra);
  }

  function onEvent(e: EventRow) {
    if (seenEvents.has(e.id)) return;
    seenEvents.add(e.id);
    events.push(e);
    if (events.length > 60) events = events.slice(-60);
    if (e.type === "dadu" && Array.isArray(e.payload.dadu)) scene.rollDice(e.payload.dadu as number[]);
    const pop = popupFor(e);
    if (pop) setTimeout(() => showCard(pop, e), e.type === "kartu" ? 900 : 300);
    renderBottom();
    if (drawerOpen) renderDrawer();
  }

  // --- HUD atas
  function renderTop() {
    const meters = state.mode === "rakyat_bersatu"
      ? h(
          "div",
          { class: "meters" },
          meter("✊ Gerakan", state.gerakan, "linear-gradient(90deg,#ff8a95,#e63946)"),
          meter("😤 Kesabaran", state.kesabaran, "linear-gradient(90deg,#ffd27a,#ff9f1c)"),
        )
      : null;
    top.replaceChildren(
      ...nodes(
      h(
        "div",
        { class: "chips" },
        h("button", { class: "iconbtn", onclick: () => void homeScreen() }, "←"),
        h("div", { class: "chip" }, `🗓️ Ronde ${state.round}/${state.maxRounds}`),
        h("div", { class: "chip" }, `📈 Inflasi ${state.inflationLevel}`),
        state.mode === "rakyat_bersatu" && h("div", { class: "chip" }, `🌾 ₵${state.lumbung}`),
        h("div", { class: "chip" }, `🏛️ ₵${state.kasPemerintah}`),
      ),
      meters,
      h(
        "div",
        { class: "players" },
        ...playersInOrder(state).map((p) =>
          h(
            "div",
            {
              class: `pill${p.id === state.order[state.turn] && state.phase !== "game_over" ? " active" : ""}${p.bankrupt ? " dead" : ""}`,
            },
            h("div", { class: "avatar", style: `background:${colorForSeat(p.seat)}` }, PROFESSION_EMOJI[p.profession] ?? "🙂"),
            h(
              "div",
              {},
              h("div", { class: "nm" }, `${p.bot ? "🤖 " : ""}${p.name}${p.id === me ? " (kamu)" : ""}`),
              h("div", { class: "cu" }, `₵${p.cuan}${p.jailTurns > 0 ? " 🚓" : ""}`),
            ),
          ),
        ),
      ),
      ),
    );
  }

  function meter(label: string, value: number, bg: string) {
    return h(
      "div",
      { class: "meter" },
      h("div", { class: "lbl" }, h("span", {}, label), h("span", {}, String(value))),
      h("div", { class: "bar" }, h("i", { style: `width:${Math.max(0, Math.min(100, value))}%;background:${bg}` })),
    );
  }

  // --- HUD bawah
  function renderBottom() {
    const latest = [...events].reverse().map((e) => describeEvent(e, state)).find((x) => x);
    const ticker = h(
      "div",
      { class: "ticker row", onclick: () => toggleDrawer() },
      h("span", { style: "flex:1" }, latest ?? "Selamat bermain!"),
      h("span", {}, "📜"),
    );
    const meP = state.players[me];
    let actions: HTMLElement;
    if (state.phase === "game_over") {
      actions = h("div", {});
    } else if (!meP) {
      actions = h("div", { class: "waiting" }, "👀 Kamu menonton");
    } else if (meP.bankrupt) {
      actions = h("div", { class: "waiting" }, "💀 Kamu bangkrut. Dukung teman ya.");
    } else if (state.order[state.turn] !== me) {
      const cur = state.players[state.order[state.turn]];
      actions = h("div", { class: "waiting" }, cur.bot ? `🤖 ${cur.name} lagi mikir…` : `⏳ Giliran ${cur.name}…`);
    } else {
      const btns: HTMLElement[] = [];
      const add = (label: string, fn: () => void, kind = "", disabled = false) =>
        btns.push(h("button", { class: `btn ${kind}`, disabled: busy || disabled, onclick: fn }, label));
      if (state.phase === "awaiting_roll") {
        add("🎲 Lempar Dadu", () => void send({ type: "roll" }));
        if (meP.jailTurns > 0) {
          add(`🧾 Denda ₵${scaled(state, rules.DENDA_TILANG)}`, () => void send({ type: "bayar_denda" }), "alt small");
        }
      } else if (state.phase === "awaiting_buy" && state.pendingTile !== null) {
        const price = scaled(state, TILES[state.pendingTile].price ?? 0);
        add(`🏪 Beli ${TILES[state.pendingTile].name} ₵${price}`, () => void send({ type: "buy" }), "", meP.cuan < price);
        add("Lewati", () => void send({ type: "skip_buy" }), "alt small");
      } else if (state.phase === "awaiting_end") {
        add("✅ Akhiri Giliran", () => void send({ type: "end_turn" }));
      }
      if (state.phase === "awaiting_roll" || state.phase === "awaiting_end") {
        if (state.mode === "rakyat_bersatu" && !state.aksiDipakai) {
          add(`✍️ Petisi ₵${scaled(state, rules.PETISI_BIAYA)}`, () => void send({ type: "petisi" }), "alt small");
          if (state.lumbung >= rules.LIPUTAN_BIAYA_LUMBUNG) {
            add("📰 Liputan", () => void send({ type: "liputan_media" }), "alt small");
          }
        }
        if (state.mode === "rakyat_bersatu") {
          add("🌾 Donasi", async () => {
            const n = await askAmount("Donasi ke Lumbung Bersama", meP.cuan);
            if (n) void send({ type: "donasi_lumbung", amount: n });
          }, "alt small");
        }
        add("🐷 Nabung", async () => {
          const n = await askAmount("Setor ke Tabungan Darurat", meP.cuan);
          if (n) void send({ type: "setor_tabungan", amount: n });
        }, "alt small");
      }
      actions = h("div", { class: "actions" }, ...btns);
    }
    bottom.replaceChildren(ticker, actions);
  }

  // --- laci info: panel pribadi + log
  function toggleDrawer() {
    drawerOpen = !drawerOpen;
    drawer.classList.toggle("open", drawerOpen);
    if (drawerOpen) renderDrawer();
  }

  function renderDrawer() {
    const p = state.players[me];
    const lines = [...events].reverse().map((e) => describeEvent(e, state)).filter((x): x is string => !!x).slice(0, 40);
    drawer.replaceChildren(
      ...nodes(
      h(
        "div",
        { class: "row", style: "justify-content:space-between" },
        h("div", { class: "title", style: "font-size:20px" }, p ? `${PROFESSION_EMOJI[p.profession]} ${PROFESSION_LABEL[p.profession]}` : "Penonton"),
        secret &&
          h(
            "div",
            { class: "badge", style: `background:${secret.role === "buzzer" ? "var(--red)" : "var(--green)"}` },
            secret.role === "buzzer" ? "🕵️ BUZZER" : "✊ RAKYAT",
          ),
        h("button", { class: "iconbtn", onclick: () => toggleDrawer() }, "✕"),
      ),
      p
        ? h(
            "div",
            { class: "stats" },
            stat("💰", "Cuan", `₵${p.cuan}`),
            stat("🐷", "Tabungan", `₵${p.tabungan}`),
            stat("🗳️", "Suara", String(p.suaraRakyat)),
            stat("🤫", "Curiga", String(p.kecurigaan)),
          )
        : null,
      secret && h("div", { style: "font-weight:800" }, `🌟 Mimpi pribadi: ${MIMPI_LABEL[secret.mimpi] ?? secret.mimpi}`),
      secret?.role === "buzzer" && h("div", { class: "muted", style: "color:#ffa8a8" }, "Rahasiakan peranmu! Tugasmu: jaga rezim tetap berkuasa."),
      h("div", { class: "title", style: "font-size:18px;margin-top:14px" }, "📢 Kabar Terkini"),
      h("div", { class: "log" }, ...lines.map((l) => h("div", {}, l))),
      ),
    );
  }

  function stat(icon: string, label: string, value: string) {
    return h("div", {}, h("div", { style: "font-size:22px" }, icon), h("b", {}, value), h("span", {}, label));
  }

  // --- detail petak
  function showTile(i: number) {
    const t = TILES[i];
    const ts = state.tiles[i];
    const owner = ts.owner === null ? "Belum dimiliki" : ts.owner === GOV ? "Pemerintah" : state.players[ts.owner]?.name ?? "-";
    const myTurn = state.order[state.turn] === me && (state.phase === "awaiting_roll" || state.phase === "awaiting_end");
    const canUpgrade = ts.owner === me && t.type === "property" && ts.level < rules.MAX_LEVEL && myTurn;
    const cost = scaled(state, (t.price ?? 0) * rules.BIAYA_UPGRADE);
    let close = () => {};
    const box = h(
      "div",
      { class: "modal col" },
      h("div", { class: "title", style: "font-size:24px" }, t.name),
      t.price ? h("div", {}, `🏷️ Harga sekarang: ₵${scaled(state, t.price)}`) : null,
      t.rent ? h("div", {}, `🤝 Sewa dasar: ₵${scaled(state, t.rent)}`) : null,
      Boolean(t.price || t.type === "gov_seat") && h("div", {}, `👤 Pemilik: ${owner}`),
      t.type === "property" && ts.owner && h("div", {}, `🏪 Level: ${LEVEL_LABEL[ts.level]}`),
      t.umkm && h("div", { class: "muted" }, "Usaha UMKM"),
      ts.disabledUntilRound >= state.round && h("div", {}, "🌊 Sedang libur tagih sewa karena bencana"),
      canUpgrade &&
        h(
          "button",
          {
            class: "btn block",
            onclick: () => {
              close();
              void send({ type: "upgrade", tile: i });
            },
          },
          `⬆️ Upgrade jadi ${LEVEL_LABEL[ts.level + 1]} (₵${cost})`,
        ),
      h("button", { class: "btn alt block", onclick: () => close() }, "Tutup"),
    );
    close = modal(box);
  }

  // --- kartu popup
  function showCard(pop: { title: string; body: string; tone: string }, e: EventRow) {
    const kicker: Record<string, [string, string]> = {
      wa: ["💬 Grup WA Keluarga", "#25d366"],
      nasib: ["🎲 Nasib WNI", "#7e57c2"],
      gov: ["🏛️ Pemerintah", "#263238"],
      demo: ["📣 Kabar Penting", "#e63946"],
    };
    const [k, color] = kicker[pop.tone] ?? kicker.demo;
    const who = e.actor_id && state.players[e.actor_id] ? `untuk ${state.players[e.actor_id].name}` : "";
    const card = h(
      "div",
      { class: "card" },
      h("div", { class: "kicker", style: `background:${color}` }, k),
      h("h2", {}, pop.title),
      h("p", {}, pop.body),
      who && h("div", { class: "muted", style: "color:#7a4f27;margin-top:10px" }, who),
    );
    const close = modal(card);
    setTimeout(close, 3200);
  }

  // --- akhir permainan
  let shownGameOver = false;
  function showGameOver() {
    if (shownGameOver) return;
    shownGameOver = true;
    const r = state.result as Record<string, unknown> | null;
    const menang = r?.kind === "rakyat_menang" || (r?.kind === "juragan_menang" && r.winner === me);
    const ranking = [...playersInOrder(state)].sort((a, b) => b.cuan + b.tabungan - (a.cuan + a.tabungan));
    const box = h(
      "div",
      { class: "modal col", style: `border-color:${menang ? "var(--green)" : "var(--red)"}` },
      h("div", { class: "title", style: "font-size:26px" }, `${menang ? "🎉" : "😭"} ${resultText(r)}`),
      h("div", {}, `Bertahan sampai ronde ${state.round}. Meter Gerakan akhir ${state.gerakan}/${rules.GERAKAN_MENANG}.`),
      ...ranking.map((p) => h("div", {}, `${p.bankrupt ? "💀" : "🧍"} ${p.name}: ₵${p.cuan + p.tabungan}`)),
      h("div", { class: "muted" }, "💡 Sisihkan Tabungan Darurat 3x gaji, dan jauhi pinjol ilegal."),
      h(
        "button",
        {
          class: "btn block",
          onclick: () => {
            localStorage.removeItem("lastRoom");
            void homeScreen();
          },
        },
        "Kembali ke Beranda",
      ),
    );
    modal(box);
  }

  scene.update(state, version);
  renderTop();
  renderBottom();
  if (state.phase === "game_over") showGameOver();
  scheduleBot();

  const unsub = subscribeRoom(roomId, {
    onGame: (g) => applyState(g.state, g.version),
    onEvent: onEvent,
  });
  // Jaga-jaga kalau realtime terputus: sinkron ulang tiap 15 detik.
  const poll = setInterval(async () => {
    const g = await getGame(roomId).catch(() => null);
    if (g && g.version > version) applyState(g.state, g.version);
  }, 15000);
  cleanup = () => {
    disposed = true;
    clearTimeout(botTimer);
    unsub();
    clearInterval(poll);
    scene.dispose();
    sceneEl.style.display = "none";
  };
}

// ------------------------------------------------------------------ mulai

async function boot(): Promise<void> {
  await document.fonts.ready.catch(() => undefined);
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      cleanup?.();
      cleanup = null;
      loginScreen();
    }
  });
  const { data } = await supabase.auth.getSession();
  if (!data.session) return loginScreen();
  const last = localStorage.getItem("lastRoom");
  if (last) {
    const g = await getGame(last).catch(() => null);
    if (g && g.state.phase !== "game_over") return gameScreen(last);
  }
  return homeScreen();
}

void boot();
