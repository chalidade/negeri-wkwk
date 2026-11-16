// Layar permainan: HUD, urutan cerita (animasi per event), dan tombol aksi.
import { ApiError, type GameRow } from "./api.ts";
import { h, modal, sceneEl, toast, ui } from "./dom.ts";
import type { Driver } from "./driver.ts";
import { HELP_SEEN, recordGame, showHelp } from "./help.ts";
import { GameScene } from "./scene/game-scene.ts";
import { isMuted, sfx, toggleMute } from "./sfx.ts";
import { describe, resultTitle } from "./story.ts";
import {
  BABAK,
  DENDA_TILANG,
  GAYA,
  GOV,
  JURUS,
  JURUS_PENUH,
  MAX_BABAK,
  pangkat,
  GROUP_COLOR,
  GROUP_LABEL,
  KAMPUNG_DAMAGE,
  LEVEL_LABEL,
  LIPUTAN_BIAYA_LUMBUNG,
  LIPUTAN_DAMAGE,
  MAX_LEVEL,
  PETISI_BIAYA,
  PROFESSION_EMOJI,
  PROFESSION_LABEL,
  PROFESSION_SKILL,
  REBUT_DAMAGE,
  REZIM_KENA,
  SEMANGAT_TITIK_DEMO,
  TILES,
  TILE_ICON,
  batasPanik,
  biayaUpgrade,
  colorForSeat,
  dr,
  drPendek,
  groupTiles,
  hargaBeli,
  kampungMandiri,
  netWorth,
  omzetUsaha,
  playersInOrder,
  pungliAset,
  sewaUsaha,
  type Action,
  type GameEvent,
  type GameState,
} from "./shared.ts";

interface Pt {
  x: number;
  y: number;
}

const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
/** rotasi kubus CSS supaya sisi bernilai v menghadap pemain */
const FACE_ROT: Record<number, [number, number]> = { 1: [0, 0], 6: [0, 180], 2: [0, -90], 5: [0, 90], 3: [-90, 0], 4: [90, 0] };

export function startGame(
  driver: Driver,
  opts: { onExit: () => void; onReplay?: (level: number) => void },
): () => void {
  let { state, version } = driver.current();
  const me = driver.me;
  const coop = state.mode === "rakyat_bersatu";
  let disposed = false;
  let sending = false;
  let playing = false;
  // ?speed=N di URL hanya untuk pengujian otomatis
  const dbgSpeed = Number(new URLSearchParams(location.search).get("speed"));
  let speed = dbgSpeed >= 1 && dbgSpeed <= 12 ? dbgSpeed : Number(localStorage.getItem("wkwk.speed")) === 2 ? 2 : 1;
  let shownK = state.kekuasaan;
  let shownS = state.semangat;
  const log: string[] = [];
  const queue: GameRow[] = [];

  sceneEl.style.display = "block";
  sceneEl.replaceChildren();
  const scene = new GameScene(sceneEl, (i) => !playing && showTile(i));
  scene.speed = speed;
  scene.onStep = () => sfx.step();
  scene.sync(state);

  /** pengali tempo tambahan: giliran bot diputar lebih cepat supaya kamu cepat main lagi */
  let tempo = 1;
  const wait = (ms: number) => new Promise<void>((r) => (disposed ? r() : setTimeout(r, ms / (speed * tempo))));
  const nm = (id: string | undefined) => (id === me ? "Kamu" : (state.players[id ?? ""]?.name ?? "Warga"));
  const myTurn = () => state.phase !== "game_over" && state.order[state.turn] === me;

  // ------------------------------------------------------------------ kerangka HUD

  const roundChip = h("button", { class: "chip round", onclick: () => showBoss() });
  const lumbungChip = h("button", { class: "chip lumbung", onclick: () => showLumbung() });
  const hpFill = h("i", {});
  const hpText = h("b", {});
  const smFill = h("i", {});
  const smText = h("b", {});
  const panikBadge = h("span", { class: "panik" }, "PANIK");
  const hpBar = h("div", { class: "bar hp" }, hpFill, hpText);
  const smBar = h("div", { class: "bar sm" }, smFill, smText);
  const boss = h(
    "div",
    { class: "boss", onclick: () => showBoss() },
    h("div", { class: "boss-face" }, driver.local ? BABAK[state.level - 1].emoji : "🏛️", panikBadge),
    h("div", { class: "boss-main" }, hpBar, smBar),
  );
  const chipEls = new Map<string, { el: HTMLElement; money: HTMLElement; badge: HTMLElement }>();
  const players = h(
    "div",
    { class: "players" },
    ...playersInOrder(state).map((p) => {
      const money = h("div", { class: "money" });
      const badge = h("span", { class: "pbadge" });
      const el = h(
        "div",
        { class: "pchip", onclick: () => showPlayer(p.id) },
        badge,
        h("div", { class: "ava", style: `background:${colorForSeat(p.seat)}` }, PROFESSION_EMOJI[p.profession] ?? "🙂"),
        h("div", { class: "pinfo" }, h("div", { class: "pname" }, p.id === me ? "Kamu" : p.bot ? (p.name.split(" ").pop() ?? p.name) : p.name.split(" ")[0]), money),
      );
      chipEls.set(p.id, { el, money, badge });
      return el;
    }),
  );
  // Daftar warga ringkas (avatar saja); ketuk panah untuk melihat nama dan uangnya.
  let chipsOpen = localStorage.getItem("wkwk.chips") === "1";
  const expandBtn = h("button", { class: "chip tiny", onclick: () => {
    chipsOpen = !chipsOpen;
    localStorage.setItem("wkwk.chips", chipsOpen ? "1" : "0");
    paintChips();
  } });
  const paintChips = () => {
    players.classList.toggle("mini", !chipsOpen);
    expandBtn.textContent = chipsOpen ? "‹" : "›";
    requestAnimationFrame(() => fit());
  };
  players.classList.toggle("mini", !chipsOpen);
  expandBtn.textContent = chipsOpen ? "‹" : "›";
  const top = h(
    "div",
    { class: "hud-top" },
    h("div", { class: "toprow" }, h("button", { class: "icon", onclick: () => showMenu() }, "☰"), coop ? boss : h("div", { style: "flex:1" }), roundChip),
    h("div", { class: "row2" }, players, expandBtn, h("div", { style: "flex:1" }), coop ? lumbungChip : null),
  );
  const feed = h("div", { class: "feed" });
  const bottom = h("div", { class: "hud-bottom" });
  // Dompetku dan tombol Aksi selalu di tempat yang sama, dekat jempol.
  const walletMoney = h("b", {});
  const walletDebt = h("small", {});
  const wallet = h("button", { class: "wallet", onclick: () => state.players[me] && showPlayer(me) }, walletMoney, walletDebt);
  const aksiBtn = h("button", { class: "fab", onclick: () => showAksi() }, h("span", {}, "⚡"), h("small", {}, "Aksi"));
  const fx = h("div", { class: "fx" });
  const root = h("div", { class: "game" }, top, feed, bottom, fx);
  ui.replaceChildren(root);

  function updateTop(): void {
    const sisa = Math.max(0, state.maxRounds - state.round + 1);
    roundChip.textContent = `🗳️ ${sisa}`;
    roundChip.classList.toggle("warn", sisa <= 5);
    lumbungChip.textContent = `🌾 ${drPendek(state.lumbung)}`;
    const aku = state.players[me];
    walletMoney.textContent = aku ? `💰 ${drPendek(aku.cuan)}` : "👀";
    walletDebt.textContent = aku && aku.utang > 0 ? `utang ${drPendek(aku.utang)}` : "";
    hpFill.style.width = `${(shownK / state.kekuasaanMaks) * 100}%`;
    hpText.textContent = `❤️ ${shownK}`;
    smFill.style.width = `${shownS}%`;
    smText.textContent = shownS >= 100 ? "✊ DEMO!" : `✊ ${shownS}%`;
    smBar.classList.toggle("hot", shownS >= 75);
    panikBadge.style.display = shownK > 0 && shownK <= batasPanik(state) ? "" : "none";
    const jasaMaks = Math.max(...playersInOrder(state).map((p) => p.jasa));
    for (const p of playersInOrder(state)) {
      const c = chipEls.get(p.id)!;
      c.money.textContent = p.bankrupt ? "bangkrut" : `${drPendek(p.cuan)}${p.jailTurns > 0 ? " 🚓" : ""}`;
      c.el.classList.toggle("active", state.phase !== "game_over" && state.order[state.turn] === p.id);
      c.el.classList.toggle("dead", p.bankrupt);
      c.el.classList.toggle("mvp", coop && p.jasa > 0 && p.jasa === jasaMaks);
      c.el.classList.toggle("buzzer", !!p.buzzer);
      const n = state.jejak[p.id] ?? 0;
      c.badge.textContent = p.buzzer ? "🕵️" : state.bersih.includes(p.id) ? "✅" : n > 0 && p.id !== me ? `🔎${n}` : "";
    }
  }

  function toggleSpeed(): void {
    speed = speed >= 2 ? 1 : 2;
    scene.speed = speed;
    localStorage.setItem("wkwk.speed", String(speed));
  }

  // ------------------------------------------------------------------ efek layar

  const center = (el: Element): Pt => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  const chipPos = (id: string | undefined): Pt => center(chipEls.get(id ?? "")?.el ?? roundChip);
  const bossPos = (): Pt => (coop ? center(hpBar) : { x: innerWidth / 2, y: -20 });
  const bankPos = (): Pt => ({ x: innerWidth / 2, y: innerHeight + 30 });

  /** Satu baris kabar singkat di bawah HUD. Baris baru menggantikan yang lama. */
  function say(text: string, kind = ""): void {
    log.push(text);
    if (log.length > 80) log.shift();
    const line = h("div", { class: `line ${kind}` }, text);
    feed.replaceChildren(line);
    setTimeout(() => line.remove(), 2800);
  }

  function floatAt(p: Pt, text: string, kind: string): void {
    const el = h("div", { class: `float ${kind}`, style: `left:${p.x}px;top:${p.y}px` }, text);
    fx.append(el);
    setTimeout(() => el.remove(), 1500);
  }

  /** Uang kertas DR beterbangan dari satu titik ke titik lain. */
  function bills(from: Pt, to: Pt, amount: number): void {
    const n = Math.max(3, Math.min(9, Math.round(Math.abs(amount) / 350_000)));
    const denom = amount >= 2e6 ? [100, 50, 100] : amount >= 8e5 ? [50, 20, 100] : [20, 10, 5, 2, 1];
    for (let i = 0; i < n; i++) {
      const d = denom[i % denom.length];
      const el = h("div", { class: `bill d${d}` }, h("small", {}, "DR"), `${d}rb`);
      fx.append(el);
      const mx = (from.x + to.x) / 2 + (Math.random() - 0.5) * 90;
      const my = Math.min(from.y, to.y) - 30 + (Math.random() - 0.5) * 70;
      const rot = () => Math.round((Math.random() - 0.5) * 80);
      const anim = el.animate(
        [
          { transform: `translate(${from.x}px,${from.y}px) rotate(${rot()}deg) scale(.5)`, opacity: 0 },
          { transform: `translate(${mx}px,${my}px) rotate(${rot()}deg) scale(1.05)`, opacity: 1, offset: 0.45 },
          { transform: `translate(${to.x}px,${to.y}px) rotate(${rot()}deg) scale(.55)`, opacity: 0.2 },
        ],
        { duration: (700 + i * 50) / speed, delay: (i * 55) / speed, easing: "ease-in-out", fill: "both" },
      );
      anim.onfinish = () => el.remove();
    }
  }

  async function banner(kind: string, title: string, sub: string, ms: number): Promise<void> {
    const el = h("div", { class: `banner ${kind}` }, h("div", { class: "b-title" }, title), sub ? h("div", { class: "b-sub" }, sub) : null);
    fx.append(el);
    await wait(ms);
    el.classList.add("out");
    setTimeout(() => el.remove(), 260);
  }

  /** Kartu besar di tengah layar. Tutup sendiri, atau ketuk untuk lanjut. */
  /** Kartu Dadu Nasib yang masih terbuka, menunggu hasil lemparan. */
  let kartuNasib: { rows: HTMLElement[]; tutup: () => void } | null = null;

  /**
   * Kartu besar di tengah layar. Kartu biasa menutup sendiri atau saat diketuk.
   * Kartu Dadu Nasib menampilkan tiga kemungkinan dan tetap terbuka sampai dadu dilempar.
   */
  function cardPop(
    c: { kicker: string; icon: string; title: string; text: string; kind: string; foot?: string; nasib?: string[] | null },
    ms: number,
  ): Promise<void> {
    return new Promise((resolve) => {
      let lanjutDone = false;
      let tutupDone = false;
      const tutup = () => {
        if (tutupDone) return;
        tutupDone = true;
        el.classList.add("out");
        setTimeout(() => el.remove(), 220);
      };
      const rows = (c.nasib ?? []).map((t, i) => h("div", { class: "n-row" }, h("b", {}, ["2–5", "6–8", "9–12"][i]), h("span", {}, t)));
      const lempar = c.nasib ? h("button", { class: "btn" }, "🎲 Lempar Dadu Nasib") : null;
      const lanjut = () => {
        if (lanjutDone) return;
        lanjutDone = true;
        if (c.nasib) {
          lempar?.remove();
          kartuNasib = { rows, tutup };
        } else tutup();
        resolve();
      };
      const el = h(
        "div",
        { class: "cardwrap", onclick: () => !c.nasib && lanjut() },
        h(
          "div",
          { class: `kartu ${c.kind}` },
          h("div", { class: "k-kicker" }, c.kicker),
          h("div", { class: "k-icon" }, c.icon),
          h("div", { class: "k-title" }, c.title),
          h("div", { class: "k-text" }, c.text),
          rows.length > 0 ? h("div", { class: "n-rows" }, ...rows) : null,
          lempar,
          c.foot ? h("div", { class: "k-foot" }, c.foot) : null,
        ),
      );
      if (lempar) lempar.onclick = lanjut;
      root.append(el);
      sfx.card();
      setTimeout(lanjut, ms / speed);
    });
  }

  function die(value: number): HTMLElement {
    const face = (v: number, cls: string) =>
      h("div", { class: `face ${cls}` }, ...Array.from({ length: 9 }, (_, i) => h("i", { class: PIPS[v].includes(i) ? "pip" : "" })));
    return h("div", { class: "die" }, face(1, "f1"), face(6, "f6"), face(2, "f2"), face(5, "f5"), face(3, "f3"), face(4, "f4"));
  }

  async function rollDice(values: number[], tag = "", diAtasKartu = false): Promise<void> {
    sfx.dice();
    navigator.vibrate?.(30);
    const dice = values.map((v) => {
      const d = die(v);
      const [rx, ry] = FACE_ROT[v];
      d.style.transform = `rotateX(${rx + 720}deg) rotateY(${ry - 540}deg) rotateZ(180deg)`;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          d.style.transition = `transform ${0.7 / speed}s cubic-bezier(.2,.9,.3,1.15)`;
          d.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
        }),
      );
      return d;
    });
    const kembar = values[0] === values[1];
    const total = h("div", { class: "dice-total" }, kembar ? `${values[0] + values[1]} · KEMBAR!` : String(values[0] + values[1]));
    const wrap = h("div", { class: "dice" }, h("div", { class: "dice-row" }, ...dice), total, tag ? h("div", { class: "dice-tag" }, tag) : null);
    if (diAtasKartu) wrap.classList.add("ontop");
    (diAtasKartu ? root : fx).append(wrap);
    await wait(diAtasKartu ? 1500 : 1050);
    wrap.classList.add("out");
    setTimeout(() => wrap.remove(), 220);
  }

  /** Lapisan efek satu layar penuh: sirene, hujan, kabut, malam, alarm. */
  function screenFx(kind: string, ms: number): void {
    const el = h("div", { class: `sfx sfx-${kind}` });
    fx.append(el);
    setTimeout(() => el.remove(), ms / speed);
  }

  /** Emoji beterbangan melintasi layar (serbuan buzzer, wartawan, dll). */
  function emojiFly(list: string[], n: number): void {
    for (let i = 0; i < n; i++) {
      const y = innerHeight * (0.25 + Math.random() * 0.4);
      const el = h("div", { class: "fly" }, list[i % list.length]);
      fx.append(el);
      const anim = el.animate(
        [
          { transform: `translate(-60px, ${y}px) rotate(-10deg)` },
          { transform: `translate(${innerWidth / 2}px, ${y - 40 + Math.random() * 80}px) rotate(8deg)`, offset: 0.5 },
          { transform: `translate(${innerWidth + 60}px, ${y + (Math.random() - 0.5) * 120}px) rotate(-6deg)` },
        ],
        { duration: (1100 + Math.random() * 700) / speed, delay: (i * 60) / speed, easing: "linear", fill: "both" },
      );
      anim.onfinish = () => el.remove();
    }
  }

  const CHANTS = ["TURUNKAN HARGA!", "RAKYAT BERSATU!", "REFORMASI!", "#KawalTerus", "CABUT ATURAN NGAWUR!", "KAMI MUAK!", "HIDUP RAKYAT!", "USUT TUNTAS!"];
  /** Teriakan massa bermunculan di sekitar Istana. */
  function chants(n: number): void {
    const c = scene.screenOfIstana();
    const start = Math.floor(Math.random() * CHANTS.length);
    for (let i = 0; i < n; i++) {
      setTimeout(() => {
        if (disposed) return;
        const el = h(
          "div",
          { class: "bubble", style: `left:${Math.max(70, Math.min(innerWidth - 70, innerWidth / 2 + (Math.random() - 0.5) * innerWidth * 0.7))}px;top:${c.y + 40 + Math.random() * 190}px` },
          CHANTS[(start + i) % CHANTS.length],
        );
        fx.append(el);
        setTimeout(() => el.remove(), 1500);
      }, (i * 230) / speed);
    }
  }

  /** Efek peta sesuai isi kartu akhir ronde. */
  async function kebijakanFx(id: string, next: GameState): Promise<void> {
    const hidup = playersInOrder(next).filter((p) => !p.bankrupt);
    switch (id) {
      case "banjir_bandang":
        screenFx("rain", 2800);
        await scene.flood(2800);
        break;
      case "gempa":
        sceneEl.classList.add("quake");
        navigator.vibrate?.([120, 60, 160, 60, 200]);
        sfx.hit();
        await scene.quake(1900);
        sceneEl.classList.remove("quake");
        break;
      case "kabut_asap":
        screenFx("haze", 2800);
        await scene.haze(2800);
        break;
      case "pengalihan_isu":
      case "serangan_buzzer":
        emojiFly(id === "serangan_buzzer" ? ["🤖", "🐦", "#️⃣", "📱", "🤖"] : ["💃", "📺", "🎤", "📸", "🤩"], 22);
        await wait(1300);
        break;
      case "bansos_politik":
        sfx.coin();
        for (const p of hidup) bills({ x: innerWidth / 2, y: -30 }, chipPos(p.id), 500_000);
        await wait(800);
        break;
      case "ruu_kilat":
        screenFx("night", 1500);
        await wait(1300);
        break;
      case "razia":
      case "aktivis_diamankan":
        screenFx("siren", 1100);
        await wait(450);
        break;
      case "dana_disunat":
        floatAt(center(lumbungChip), "✂️", "hit");
        await wait(300);
        break;
      case "penggusuran":
      case "proyek_mercusuar":
      case "rangkap_jabatan":
        break;
      default:
        // pungutan massal: gelombang merah dari Istana menghantam semua warga
        scene.overview();
        void scene.shockwave();
        await wait(520);
        sfx.pay();
        for (const p of hidup) {
          scene.burstAtPawn(p.id, "dust");
          floatAt(scene.screenOfPawn(p.id), "💸", "hit");
          bills(chipPos(p.id), bossPos(), 400_000);
        }
        await wait(700);
    }
  }

  function setBars(k: number | null, s: number | null): void {
    if (k !== null) shownK = k;
    if (s !== null) shownS = s;
    updateTop();
  }

  // ------------------------------------------------------------------ pemutar cerita

  async function play(events: GameEvent[], next: GameState): Promise<void> {
    for (const e of events) {
      if (disposed) return;
      tempo = e.actor && e.actor !== me && next.players[e.actor]?.bot ? 1.9 : 1;
      scene.speed = speed * tempo;
      const p = e.payload as Record<string, never>;
      const a = e.actor;
      const mine = a === me;
      const line = describe(e, next, me);
      switch (e.type) {
        case "dadu": {
          if (a) scene.focusPawn(a);
          const g = GAYA.find((x) => x.id === p.gaya);
          await rollDice(p.dadu as number[], g ? (p.kena ? `${g.label} ✓` : "MELESET!") : "");
          break;
        }
        case "jurus": {
          const j = JURUS[String(p.profesi)];
          sfx.fanfare();
          navigator.vibrate?.(60);
          if (a) {
            scene.focusPawn(a);
            scene.burstAtPawn(a, "confetti");
          }
          say(line!, "good");
          await banner("gold", `${j.emoji} ${j.nama.toUpperCase()}!`, `${mine ? "Jurusmu" : `Jurus ${nm(a)}`}: ${j.efek}`, mine ? 1500 : 1100);
          break;
        }
        case "gerak":
          if (a) await scene.movePawn(a, Number(p.dari), Number(p.ke));
          break;
        case "gajian": {
          const total = Number(p.gaji) + Number(p.omzet) - Number(p.iuran);
          sfx.coin();
          if (a) scene.burstAtPawn(a, "coins");
          bills(bankPos(), chipPos(a), total);
          if (Number(p.iuran) > 0) bills(bankPos(), center(lumbungChip), Number(p.iuran));
          if (mine) await banner("gold", "GAJIAN!", `+${dr(total)}${Number(p.omzet) > 0 ? ` (omzet usaha ${dr(p.omzet)})` : ""}`, 1100);
          else {
            say(line!, "good");
            await wait(500);
          }
          break;
        }
        case "beli":
          sfx.build();
          scene.syncTile(Number(p.tile), next.tiles[Number(p.tile)], next);
          scene.burstAtTile(Number(p.tile), p.rebut ? "confetti" : "spark");
          say(line!, "good");
          if (p.rebut) await banner("good", "DIREBUT!", `${TILES[Number(p.tile)].name} kembali ke tangan rakyat`, 1000);
          else await wait(600);
          break;
        case "upgrade":
          sfx.build();
          scene.focusTile(Number(p.tile));
          scene.syncTile(Number(p.tile), next.tiles[Number(p.tile)], next);
          scene.burstAtTile(Number(p.tile), "spark");
          say(line!, "good");
          await wait(600);
          break;
        case "bayar_sewa":
          sfx.coin();
          bills(chipPos(a), chipPos(String(p.ke)), Number(p.jumlah));
          say(line!);
          await wait(650);
          break;
        case "mampir_sendiri":
          sfx.coin();
          if (a) scene.burstAtPawn(a, "coins");
          bills(bankPos(), chipPos(a), Number(p.jumlah));
          say(line!, "good");
          await wait(500);
          break;
        case "pungli":
          sfx.pay();
          if (a) scene.burstAtPawn(a, "dust");
          bills(chipPos(a), bossPos(), Number(p.jumlah));
          say(line!, "bad");
          if (mine) await banner("bad", "KENA PUNGLI", `−${dr(p.jumlah)} ke Rezim`, 900);
          else await wait(600);
          break;
        case "kartu": {
          const baik = Boolean(p.baik);
          baik ? sfx.good() : sfx.bad();
          if (!mine) {
            if (a) scene.burstAtPawn(a, baik ? "coins" : "dust");
            say(line!, baik ? "good" : "bad");
            await wait(800);
            break;
          }
          await cardPop(
            {
              kicker: p.dek === "grup_wa" ? "💬 GRUP WA KELUARGA" : "🎴 NASIB WNI",
              icon: baik ? "😄" : "😩",
              title: String(p.judul),
              text: String(p.teks),
              kind: baik ? "good" : "bad",
              nasib: p.nasib as string[] | null,
            },
            p.nasib ? 7000 : 3200,
          );
          if (a) scene.burstAtPawn(a, baik ? "coins" : "dust");
          say(line!, baik ? "good" : "bad");
          break;
        }
        case "kebijakan": {
          const bencana = p.jenis === "bencana";
          scene.overview();
          sfx.siren();
          await cardPop(
            {
              kicker: bencana ? "🌋 BENCANA ALAM" : "📜 KEBIJAKAN REZIM",
              icon: bencana ? "🌊" : p.baik ? "🎁" : "🏛️",
              title: String(p.judul),
              text: String(p.teks),
              kind: bencana ? "bencana" : "rezim",
              foot: "Berlaku untuk semua warga",
              nasib: p.nasib as string[] | null,
            },
            p.nasib ? 6000 : 2600,
          );
          say(line!, "bad");
          if (!p.nasib) await kebijakanFx(String(p.id), next);
          break;
        }
        case "dadu_nasib": {
          const dadu = p.dadu as number[];
          const t = Number(p.tingkat);
          const label = ["MUJUR!", "LUMAYAN", "APES!"][t];
          if (!kartuNasib) {
            // kartu milik bot: cukup kabar singkat
            say(`🎲 ${dadu[0] + dadu[1]} ${label} ${p.teks}`, t === 0 ? "good" : "bad");
            await wait(1100);
            break;
          }
          await rollDice(dadu, label, true);
          kartuNasib.rows.forEach((r, i) => r.classList.add(i === t ? "kena" : "lewat"));
          t === 0 ? sfx.good() : t === 2 ? sfx.bad() : sfx.click();
          navigator.vibrate?.(t === 2 ? [80, 40, 120] : 40);
          await wait(2000);
          kartuNasib.tutup();
          kartuNasib = null;
          // kartu akhir ronde: efek peta hanya kalau memang kena
          if (!a && t > 0) await kebijakanFx(String(p.id), next);
          else if (!a) say("😮‍💨 Selamat, kali ini lolos.", "good");
          break;
        }
        case "sabotase": {
          sfx.siren();
          screenFx("alarm", 1500);
          say(line!, "bad");
          const isi =
            p.jenis === "tilep"
              ? `Kas Lumbung ditilep ${dr(p.jumlah)}`
              : p.jenis === "lapor"
                ? `${nm(String(p.korban))} dilaporkan ke aparat`
                : "Tagar tandingan dikerahkan: Semangat turun";
          await banner("bad", "🕵️ SABOTASE!", isi, 1700);
          break;
        }
        case "jejak":
          sfx.click();
          state = { ...state, jejak: { ...state.jejak, [String(p.ke)]: Number(p.total) } };
          updateTop();
          say(line!);
          await banner("info", "🔎 JEJAK DIGITAL", `Mengarah ke ${String(p.ke) === me ? "kamu (jelas palsu!)" : nm(String(p.ke))}. Bisa asli, bisa fitnah.`, 2000);
          break;
        case "buzzer_terbongkar":
          sfx.fanfare();
          scene.burstAtPawn(String(p.target), "confetti");
          say(line!, "good");
          await banner("good", "BUZZER TERBONGKAR!", `${nm(String(p.target))} ternyata dibayar Rezim. ${mine ? "Tuduhanmu" : `Tuduhan ${nm(a)}`} tepat!`, 2400);
          break;
        case "tuduh_salah":
          sfx.bad();
          say(line!, "bad");
          await banner("bad", "SALAH TUDUH!", `${nm(String(p.target))} bukan buzzer. Semangat turun, ${mine ? "kamu" : nm(a)} kena denda.`, 2200);
          break;
        case "kena_tilang":
          sfx.siren();
          screenFx("siren", 1000);
          if (a) await scene.teleportPawn(a, next.players[a].position);
          say(line!, "bad");
          if (mine) await banner("bad", "KENA TILANG!", "Lempar dadu kembar atau bayar denda buat bebas", 1300);
          else await wait(500);
          break;
        case "semangat":
          setBars(null, Number(p.ke));
          if (Number(p.ke) > Number(p.dari)) floatAt(center(smFill.parentElement!), `+${Number(p.ke) - Number(p.dari)} ✊`, "plus");
          else floatAt(center(smFill.parentElement!), `${Number(p.ke) - Number(p.dari)} ✊`, "minus");
          await wait(220);
          break;
        case "demo_akbar":
          setBars(null, 100);
          sfx.fanfare();
          navigator.vibrate?.([60, 40, 60, 40, 120]);
          say(line!, "good");
          void scene.demo(2900);
          chants(9);
          await banner("demo", "DEMO AKBAR!", `Rakyat turun ke jalan. Kekuasaan Rezim −${p.damage}`, 2600);
          setBars(null, 0);
          break;
        case "kekuasaan": {
          const d = Number(p.ke) - Number(p.dari);
          setBars(Number(p.ke), null);
          scene.setRezim(Number(p.ke) / next.kekuasaanMaks, Number(p.ke) <= batasPanik(next));
          floatAt(bossPos(), d < 0 ? `${d} ❤️` : `+${d} ❤️`, d < 0 ? "hit" : "minus");
          if (d < 0) {
            sfx.hit();
            hpBar.classList.remove("shake");
            void hpBar.offsetWidth;
            hpBar.classList.add("shake");
            void scene.hitIstana();
          }
          await wait(520);
          break;
        }
        case "rezim_panik":
          sfx.siren();
          screenFx("alarm", 1900);
          say(line!, "bad");
          await banner("bad", "REZIM PANIK!", "Kekuasaan tinggal separuh. Semua pungutan naik 1,5x", 1900);
          break;
        case "kampung_mandiri":
          sfx.good();
          scene.overview();
          scene.waveTiles(groupTiles(String(p.grup)));
          say(line!, "good");
          await banner("good", "KAMPUNG MANDIRI!", `Satu warna dikuasai rakyat: omzet & sewa 2x, Kekuasaan −${p.damage}`, 1900);
          break;
        case "petisi":
          sfx.good();
          if (a) {
            scene.burstAtPawn(a, "spark");
            floatAt(scene.screenOfPawn(a), "✍️ Petisi!", "plus");
          }
          say(line!, "good");
          await wait(450);
          break;
        case "titik_demo":
          sfx.good();
          if (a) {
            scene.burstAtPawn(a, "confetti");
            floatAt(scene.screenOfPawn(a), "✊ Orasi!", "plus");
          }
          say(line!, "good");
          await wait(550);
          break;
        case "gotong_royong":
          sfx.coin();
          bills(bankPos(), center(lumbungChip), Number(p.jumlah));
          say(line!, "good");
          await wait(550);
          break;
        case "liputan_media":
          sfx.good();
          emojiFly(["📰", "📸", "🎥", "🎙️"], 12);
          say(line!, "good");
          await banner("good", "LIPUTAN MEDIA", `Borok Rezim terbongkar. Kekuasaan −${p.damage}`, 1200);
          break;
        case "talangan":
          sfx.coin();
          if (a) scene.burstAtPawn(a, "coins");
          bills(center(lumbungChip), chipPos(a), Number(p.jumlah));
          say(line!, "good");
          await banner("gold", "DITALANGI LUMBUNG", `${nm(a)} diselamatkan warga: ${dr(p.jumlah)}`, 1500);
          break;
        case "jual_rugi":
          sfx.bad();
          scene.burstAtTile(Number(p.tile), "dust");
          scene.syncTile(Number(p.tile), next.tiles[Number(p.tile)], next);
          say(line!, "bad");
          await wait(800);
          break;
        case "bangkrut":
          sfx.lose();
          if (a) {
            scene.burstAtPawn(a, "smoke");
            scene.killPawn(a);
          }
          say(line!, "bad");
          await banner("bad", "BANGKRUT", `${nm(a)} tumbang. Satu lagi bangkrut, semua kalah.`, 1900);
          break;
        case "rezim_gerak":
          scene.focusCar();
          sfx.siren();
          await wait(250);
          await scene.moveCar(Number(p.dari), Number(p.ke));
          await wait(200);
          break;
        case "rezim_caplok":
          sfx.bad();
          scene.focusTile(Number(p.tile));
          await wait(250);
          scene.burstAtTile(Number(p.tile), "smoke");
          scene.shake(300, 0.14);
          scene.syncTile(Number(p.tile), next.tiles[Number(p.tile)], next);
          say(line!, "bad");
          await banner("bad", p.alasan === "gusur" ? "DIGUSUR!" : "DICAPLOK REZIM", `${TILES[Number(p.tile)].name} sekarang aset Rezim`, 1300);
          break;
        case "rezim_upgrade":
        case "usaha_rusak":
          scene.burstAtTile(Number(p.tile), e.type === "usaha_rusak" ? "dust" : "smoke");
          scene.syncTile(Number(p.tile), next.tiles[Number(p.tile)], next);
          say(line!, "bad");
          await wait(450);
          break;
        case "rezim_bayar":
          sfx.coin();
          scene.burstAtTile(Number(p.tile), "coins");
          bills(bossPos(), chipPos(String(p.ke)), Number(p.jumlah));
          say(line!, "good");
          await banner("good", "PEJABAT KEPERGOK!", `Mampir di ${TILES[Number(p.tile)].name}: bayar ${dr(p.jumlah)} ke ${nm(String(p.ke)).toLowerCase() === "kamu" ? "kamu" : nm(String(p.ke))}`, 1500);
          break;
        case "lumbung_disunat":
          sfx.pay();
          bills(center(lumbungChip), bossPos(), Number(p.jumlah));
          say(line!, "bad");
          await wait(600);
          break;
        case "ott":
          sfx.siren();
          screenFx("siren", 1300);
          if (a) scene.burstAtPawn(a, "smoke");
          say(line!, "bad");
          await banner("bad", "KENA OTT!", `${mine ? "Kamu" : nm(a)} ketahuan nyogok: denda ${dr(p.denda)} dan ditahan`, 2000);
          break;
        case "pinjol":
          sfx.coin();
          bills(bankPos(), chipPos(a), Number(p.jumlah));
          say(line!);
          await wait(550);
          break;
        case "cicilan":
        case "bayar_utang":
          say(line!, Number(p.sisa) === 0 ? "good" : "");
          await wait(400);
          break;
        case "teror_dc":
          sfx.bad();
          say(line!, "bad");
          if (mine) await banner("bad", "DITEROR DEBT COLLECTOR", `Utangmu ${dr(p.utang)}. Giliran berikutnya dilewati.`, 1900);
          else await wait(500);
          break;
        case "bantu":
          sfx.good();
          bills(chipPos(a), chipPos(String(p.target)), Number(p.jumlah));
          say(line!, "good");
          if (String(p.target) === me) await banner("gold", "DIBANTU WARGA", `${nm(a)} mengirim ${dr(p.jumlah)}${Number(p.lunas) > 0 ? " buat utangmu" : ""}`, 1700);
          else await wait(650);
          break;
        case "ronde_baru":
          say(line!);
          await banner(Number(p.sisa) <= 3 ? "bad" : "info", `RONDE ${p.ronde}`, Number(p.sisa) <= 5 ? `Pemilu tinggal ${p.sisa} ronde lagi!` : `Pemilu ${p.sisa} ronde lagi`, 950);
          break;
        case "giliran":
          if (a) {
            scene.setActive(a);
            scene.focusPawn(a);
          }
          break;
        case "game_selesai":
          break;
        default:
          if (line) {
            say(line);
            await wait(450);
          }
      }
    }
  }

  function enqueue(row: GameRow): void {
    if (disposed || row.version <= version || queue.some((q) => q.version === row.version)) return;
    queue.push(row);
    queue.sort((x, y) => x.version - y.version);
    if (!playing) void drain();
  }

  async function drain(): Promise<void> {
    playing = true;
    renderBottom();
    while (queue.length > 0 && !disposed) {
      const row = queue.shift()!;
      if (row.version <= version) continue;
      const prev = state;
      const berurutan = row.version === version + 1;
      version = row.version;
      if (berurutan) await play(row.state.lastEvents ?? [], row.state);
      tempo = 1;
      scene.speed = speed;
      if (disposed) return;
      state = row.state;
      scene.sync(state);
      shownK = state.kekuasaan;
      shownS = state.semangat;
      // selisih uang tampil di kartu pemain
      for (const p of playersInOrder(state)) {
        const d = p.cuan - (prev.players[p.id]?.cuan ?? p.cuan);
        const at = chipPos(p.id);
        if (d !== 0) floatAt({ x: at.x, y: at.y + 30 }, `${d > 0 ? "+" : "−"}${drPendek(Math.abs(d))}`, d > 0 ? "plus" : "minus");
      }
      updateTop();
    }
    playing = false;
    renderBottom();
    afterIdle();
  }

  // ------------------------------------------------------------------ giliran bot & akhir game

  let botTimer: ReturnType<typeof setTimeout> | undefined;
  function afterIdle(): void {
    if (disposed) return;
    if (state.phase === "game_over") return void showGameOver();
    const cur = state.players[state.order[state.turn]];
    if (!cur?.bot || !state.players[me]) return;
    // Online: kalau ada beberapa manusia, yang kursinya paling depan jadi penggerak utama.
    const humans = playersInOrder(state).filter((p) => !p.bot && !p.bankrupt);
    const rank = driver.local ? 0 : Math.max(0, humans.findIndex((p) => p.id === me));
    const at = version;
    clearTimeout(botTimer);
    botTimer = setTimeout(async () => {
      if (disposed || version !== at || playing) return;
      try {
        await driver.botStep();
      } catch {
        botTimer = setTimeout(afterIdle, 2500);
      }
    }, (driver.local ? 160 : 600) / speed + rank * 3000);
  }

  let overShown = false;
  async function showGameOver(): Promise<void> {
    if (overShown) return;
    overShown = true;
    driver.forget();
    const res = resultTitle(state, me);
    const meP = state.players[me];
    const urut = [...playersInOrder(state)].sort((x, y) => (coop ? y.jasa - x.jasa : netWorth(state, y) - netWorth(state, x)));
    const mvp = coop && !!meP && urut[0].id === me && meP.jasa > 0;
    const { stats, hadiah } = recordGame({
      win: res.win,
      round: state.round,
      maxRounds: state.maxRounds,
      level: state.level,
      mvp,
      jasa: meP?.jasa ?? 0,
      solo: driver.local,
      maxBabak: MAX_BABAK,
    });
    if (state.result?.kind === "rakyat_menang") {
      sfx.fanfare();
      await scene.collapseIstana();
      confetti();
    } else res.win ? sfx.fanfare() : sfx.lose();
    const pk = pangkat(stats.xp);
    const lanjut = hadiah.babakBaru ?? state.level;
    modal(
      h(
        "div",
        { class: `sheet col over ${res.win ? "win" : "lose"}` },
        h("div", { class: "over-icon" }, res.win ? "🎉" : "😭"),
        h("div", { class: "over-title" }, res.title),
        res.win
          ? h("div", { class: "stars" }, ...[1, 2, 3].map((i) => h("span", { class: i <= hadiah.bintang ? "on" : "", style: `animation-delay:${i * 0.28}s` }, "★")))
          : null,
        h("div", { class: "over-sub" }, res.sub),
        coop ? h("div", { class: `tag ${mvp ? "mvp-tag" : "mvp-lain"}` }, mvp ? "👑 Kamu MVP!" : `👑 MVP: ${urut[0].name}`) : null,
        h(
          "div",
          { class: "rank" },
          ...urut.map((p, i) =>
            h(
              "div",
              { class: `rank-row${p.id === me ? " me" : ""}` },
              h("span", {}, `${i + 1}. ${p.bankrupt ? "💀" : (PROFESSION_EMOJI[p.profession] ?? "")} ${p.id === me ? "Kamu" : p.name}`),
              h("b", {}, coop ? `${p.jasa} jasa` : dr(netWorth(state, p))),
            ),
          ),
        ),
        h("div", { class: "reward" }, h("b", {}, `+${hadiah.xp} XP`), hadiah.emas > 0 ? h("b", {}, `+${hadiah.emas} 🪙 Emas Antum`) : null),
        h("div", { class: "xpbar" }, h("i", { style: `width:${Math.round(pk.maju * 100)}%` }), h("b", {}, pk.berikut ? `🎖️ ${pk.nama} → ${pk.berikut}` : `🎖️ ${pk.nama}`)),
        hadiah.babakBaru ? h("div", { class: "unlock" }, `🔓 Babak ${hadiah.babakBaru} terbuka: ${BABAK[hadiah.babakBaru - 1].nama}`) : null,
        coop
          ? h(
              "div",
              { class: "muted small" },
              state.rahasia.buzzer
                ? `🕵️ Buzzernya ternyata ${state.players[state.rahasia.buzzer].name}${state.players[state.rahasia.buzzer].buzzer ? " (sudah terbongkar)" : " (lolos sampai akhir!)"}.`
                : "🕵️ Tidak ada buzzer di permainan ini. Curiganya saja yang capek.",
            )
          : null,
        res.win && hadiah.bintang < 3
          ? h("div", { class: "muted small" }, "★★ menang dengan sisa 3 ronde atau lebih  ·  ★★★ sekaligus jadi MVP")
          : null,
        opts.onReplay
          ? h(
              "button",
              { class: "btn big", onclick: () => opts.onReplay!(lanjut) },
              res.win ? (hadiah.babakBaru ? `Lanjut Babak ${hadiah.babakBaru} ▶` : "Main Lagi 🎲") : "Balas Dendam 🔥",
            )
          : null,
        h("button", { class: "btn grey", onclick: () => opts.onExit() }, "Beranda"),
      ),
      undefined,
      false,
    );
  }

  function confetti(): void {
    const colors = ["#ff4d5e", "#ffd84d", "#22c06b", "#2f8bff", "#a35cf0", "#ffffff"];
    for (let i = 0; i < 70; i++) {
      const el = h("i", { class: "confetti", style: `left:${Math.random() * 100}%;background:${colors[i % colors.length]};animation-delay:${Math.random() * 0.8}s;animation-duration:${2 + Math.random() * 1.6}s` });
      fx.append(el);
      setTimeout(() => el.remove(), 4500);
    }
  }

  // ------------------------------------------------------------------ aksi pemain

  async function send(action: Action): Promise<void> {
    if (sending || playing || disposed) return;
    sending = true;
    sfx.click();
    renderBottom();
    try {
      await driver.send(action);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Koneksi bermasalah, coba lagi.");
    } finally {
      sending = false;
      renderBottom();
    }
  }

  // --- meteran tenaga dadu (tahan tombol, lepas di zona yang diincar)
  let gaugeRaf = 0;
  function tutupMeteran(): void {
    cancelAnimationFrame(gaugeRaf);
    scene.highlight();
  }

  /** Enak tidaknya mendarat di sebuah petak buatku: 1 bagus, -1 bahaya, 0 biasa. */
  function mutuPetak(i: number): number {
    const def = TILES[i];
    const t = state.tiles[i];
    const meP = state.players[me];
    if (def.type === "property") {
      if (t.owner === null) return meP.cuan >= hargaBeli(state, i) ? 1 : 0;
      if (t.owner === me) return 1;
      return t.owner === GOV ? -1 : 0;
    }
    if (def.type === "tax" || def.type === "gov_seat" || def.type === "go_to_jail") return -1;
    return def.type === "demo" || def.type === "lumbung" || def.type === "start" ? 1 : 0;
  }

  /** Pasang meteran pada tombol dadu. Mengembalikan panel meteran untuk ditaruh di atas tombol. */
  function pasangMeteran(btn: HTMLButtonElement): HTMLElement {
    let aktif = false;
    let modeTap = false;
    let zona = -1;
    let turun = 0;
    const pos = state.players[me].position;
    const petak = GAYA.map((g) => {
      const idx: number[] = [];
      for (let k = g.kisaran[0]; k <= g.kisaran[1]; k++) idx.push((pos + k) % TILES.length);
      return idx;
    });
    const zones = GAYA.map((g, z) => {
      const bagus = petak[z].filter((i) => mutuPetak(i) > 0).length;
      const bahaya = petak[z].filter((i) => mutuPetak(i) < 0).length;
      return h(
        "div",
        { class: "g-zone on", style: `background:${g.warna}` },
        h("b", {}, g.label),
        h("small", {}, `${g.kisaran[0]}–${g.kisaran[1]} langkah`),
        h("span", { class: "g-mutu" }, `${bagus ? `👍${bagus}` : ""}${bagus && bahaya ? "  " : ""}${bahaya ? `⚠️${bahaya}` : ""}` || "biasa"),
      );
    });
    const marker = h("i", { class: "g-marker", style: "display:none" });
    const info = h("div", { class: "g-title" }, "Tahan dadu, lepas di tenaga yang kamu mau. 👍 petak bagus, ⚠️ pungutan.");
    const panel = h("div", { class: "gauge float", style: "display:none" }, h("div", { class: "g-bar" }, ...zones, marker), info);
    // Sebelum ditahan: semua kemungkinan menyala di papan, sesuai warna tenaganya.
    scene.overview();
    scene.highlight(petak.map((tiles, z) => ({ tiles, color: GAYA[z].warna })));

    const mulai = () => {
      aktif = true;
      zona = -1;
      marker.style.display = "";
      panel.style.display = "";
      const t0 = performance.now();
      const tick = () => {
        const t = ((performance.now() - t0) / 820) % 2; // penanda bolak-balik
        const x = t < 1 ? t : 2 - t;
        marker.style.left = `${x * 100}%`;
        const z = Math.min(2, Math.floor(x * 3));
        if (z !== zona) {
          zona = z;
          zones.forEach((el, i) => el.classList.toggle("on", i === z));
          scene.highlight([{ tiles: petak[z], color: GAYA[z].warna }]);
          info.textContent = petak[z].map((i) => `${mutuPetak(i) > 0 ? "👍 " : mutuPetak(i) < 0 ? "⚠️ " : ""}${TILES[i].name}`).join(" · ");
          sfx.step();
        }
        gaugeRaf = requestAnimationFrame(tick);
      };
      tick();
    };
    const lempar = () => {
      if (!aktif) return;
      aktif = false;
      const gaya = GAYA[Math.max(0, zona)].id;
      tutupMeteran();
      void send({ type: "roll", gaya });
    };
    btn.addEventListener("contextmenu", (e) => e.preventDefault());
    btn.addEventListener("pointerdown", (e) => {
      if (btn.disabled || sending || playing) return;
      e.preventDefault();
      if (aktif && modeTap) return lempar(); // ketukan kedua mengunci tenaga
      btn.setPointerCapture?.(e.pointerId);
      turun = performance.now();
      modeTap = false;
      mulai();
    });
    btn.addEventListener("pointerup", () => {
      if (!aktif || modeTap) return;
      // Ketukan singkat: meteran tetap jalan, ketuk sekali lagi untuk melempar.
      if (performance.now() - turun < 230) {
        modeTap = true;
        btn.lastElementChild!.textContent = "KETUK";
        return;
      }
      lempar();
    });
    btn.addEventListener("pointercancel", () => {
      aktif = false;
      cancelAnimationFrame(gaugeRaf);
      panel.style.display = "none";
      marker.style.display = "none";
      zones.forEach((el) => el.classList.add("on"));
    });
    return panel;
  }

  // --- giliran selesai otomatis supaya permainan mengalir
  let autoTimer: ReturnType<typeof setTimeout> | undefined;
  let autoVer = -1;
  let autoOff = -1;
  let autoUntil = 0;
  function stopAuto(): void {
    autoOff = version;
    clearTimeout(autoTimer);
    bottom.querySelector(".autobar")?.remove();
  }

  /** Apa saja yang bisa kulakukan sekarang (dipakai tombol Aksi dan selesai-otomatis). */
  function peluang() {
    const meP = state.players[me];
    const rolling = state.phase === "awaiting_roll";
    const jurusSiap = meP.jurus >= JURUS_PENUH;
    return {
      rolling,
      jurusSiap,
      jurusBisa: jurusSiap && (meP.profession !== "ojol" || !rolling),
      punyaUsaha: state.tiles.some((t) => t.owner === me),
      bisaUpgrade: state.tiles.some((t, i) => t.owner === me && t.level < MAX_LEVEL && meP.cuan >= biayaUpgrade(i, "pelicin")),
      bisaPetisi: coop && !state.aksiDipakai && meP.cuan >= PETISI_BIAYA,
      bisaLiputan: coop && !state.aksiDipakai && state.lumbung >= LIPUTAN_BIAYA_LUMBUNG,
    };
  }

  function renderBottom(): void {
    if (disposed) return;
    clearTimeout(autoTimer);
    tutupMeteran();
    const locked = sending || playing;
    const meP = state.players[me];
    const cur = state.players[state.order[state.turn]];
    const giliranku = myTurn() && !!meP && !meP.bankrupt;
    let pill = "";
    let utama: HTMLElement | null = null;
    let tawaran: HTMLElement | null = null;
    let meteran: HTMLElement | null = null;

    if (state.phase === "game_over") pill = "Permainan selesai";
    else if (!meP) pill = `👀 Giliran ${cur.name}`;
    else if (meP.bankrupt) pill = "💀 Kamu bangkrut";
    else if (!myTurn()) pill = cur.bot ? `🤖 ${cur.name}…` : `⏳ ${cur.name}…`;
    else if (state.phase === "awaiting_buy" && state.pendingTile !== null) {
      const i = state.pendingTile;
      const rebut = state.tiles[i].owner === GOV;
      const resmi = hargaBeli(state, i);
      const pelicin = hargaBeli(state, i, "pelicin");
      const omzet = omzetUsaha({ ...state, tiles: state.tiles.map((t, k) => (k === i ? { owner: me, level: 0 } : t)) }, i);
      const jalur = (label: string, sub: string, harga: number, cls: string, fn: () => void) =>
        h(
          "button",
          {
            class: `jalur ${cls}${meP.cuan >= harga ? "" : " off"}`,
            disabled: locked,
            onclick: () => (meP.cuan >= harga ? fn() : toast("Uangmu kurang. Bisa pinjam lewat ⚡ Aksi → Pinjol.")),
          },
          h("b", {}, label),
          h("span", {}, drPendek(harga)),
          h("small", {}, sub),
        );
      tawaran = h(
        "div",
        { class: "offer" },
        h("div", { class: "offer-title" }, rebut ? `🚩 Rebut ${TILES[i].name}?` : `🏪 Buka usaha di ${TILES[i].name}?`),
        h("div", { class: "offer-sub" }, rebut ? `Kekuasaan −${REBUT_DAMAGE}, bangunannya jadi milikmu` : `Omzet +${drPendek(omzet)} tiap gajian`),
        h(
          "div",
          { class: "offer-btns" },
          jalur(rebut ? "Rebut" : "🧾 Resmi", rebut ? "ambil alih" : "aman, plus izin", resmi, "resmi", () => void send({ type: "buy" })),
          rebut ? null : jalur("🤝 Pelicin", "murah, OTT 1 dari 4", pelicin, "pelicin", () => void send({ type: "buy", jalur: "pelicin" })),
          h("button", { class: "jalur lewat", disabled: locked, onclick: () => void send({ type: "skip_buy" }) }, h("b", {}, "Lewati")),
        ),
      );
    } else if (state.phase === "awaiting_roll") {
      const bebas = !meP.skipNext && meP.jailTurns === 0;
      pill = meP.skipNext ? "Giliranmu dilewati" : meP.jailTurns > 0 ? "Ditilang: dadu kembar atau bayar ⚡" : "Tahan dadu, lepas saat pas";
      const btn = h(
        "button",
        { class: "dicebtn", disabled: locked },
        h("span", { class: "d-icon" }, meP.skipNext ? "😵" : "🎲"),
        h("span", {}, meP.skipNext ? "LEWATI" : bebas ? "TAHAN" : "LEMPAR"),
      );
      if (bebas && !locked) meteran = pasangMeteran(btn);
      else btn.onclick = () => void send({ type: "roll" });
      utama = btn;
    } else {
      const o = peluang();
      const adaAksi = o.jurusBisa || o.bisaUpgrade || o.bisaPetisi || o.bisaLiputan;
      pill = o.jurusBisa ? `⚡ Jurus ${JURUS[meP.profession].nama} siap!` : adaAksi ? "Masih bisa beraksi lewat ⚡" : "";
      const auto = autoOff !== version && !locked;
      let sisa = 0;
      if (auto) {
        if (autoVer !== version) {
          autoVer = version;
          autoUntil = performance.now() + (adaAksi ? 6500 : 1000 / speed);
        }
        sisa = Math.max(60, autoUntil - performance.now());
        const at = version;
        autoTimer = setTimeout(() => {
          if (!disposed && version === at && autoOff !== at && myTurn() && state.phase === "awaiting_end") void send({ type: "end_turn" });
        }, sisa);
      }
      utama = h(
        "button",
        { class: "dicebtn selesai", disabled: locked, onclick: () => void send({ type: "end_turn" }) },
        h("span", { class: "d-icon" }, "✅"),
        h("span", {}, "SELESAI"),
        auto ? h("i", { class: "autobar", style: `animation-duration:${Math.round(sisa)}ms` }) : null,
      );
    }

    // Tombol Aksi hanya muncul di giliranku; titik merah kalau ada yang siap dipakai.
    const tampilAksi = giliranku && state.phase !== "game_over";
    aksiBtn.style.visibility = tampilAksi ? "visible" : "hidden";
    aksiBtn.disabled = locked;
    if (tampilAksi) {
      const o = peluang();
      aksiBtn.classList.toggle("dot", state.phase !== "awaiting_buy" && (o.jurusBisa || (!o.rolling && o.bisaUpgrade)));
    }
    bottom.replaceChildren(
      ...[
        meteran,
        tawaran,
        h(
          "div",
          { class: "dock" },
          aksiBtn,
          h("div", { class: "dock-mid" }, pill ? h("div", { class: `turnpill${giliranku ? " mine" : ""}` }, pill) : null, utama),
          wallet,
        ),
      ].filter((x): x is HTMLElement => !!x),
    );
    bottomInset = tawaran ? 196 : utama ? 124 : 66;
    fit();
  }

  // ------------------------------------------------------------------ lembar info

  function sheet(...children: (Node | string | null)[]): () => void {
    stopAuto();
    const close = modal(
      h("div", { class: "sheet col" }, ...children.filter((c): c is Node | string => !!c), h("button", { class: "btn grey", onclick: () => close() }, "Tutup")),
    );
    return close;
  }

  const row = (label: string, value: string) => h("div", { class: "kv" }, h("span", {}, label), h("b", {}, value));

  function showTile(i: number): void {
    const def = TILES[i];
    const t = state.tiles[i];
    const rows: (Node | null)[] = [];
    let info = "";
    switch (def.type) {
      case "start":
        info = "Tiap lewat sini kamu gajian: gaji + omzet semua usahamu. 20% gaji otomatis masuk Lumbung Bersama.";
        break;
      case "jail":
        info = "Kalau cuma mendarat, aman. Yang kena tilang ditahan di sini sampai dapat dadu kembar, bayar denda, atau 2 giliran lewat.";
        break;
      case "go_to_jail":
        info = "Mendarat di sini langsung kena tilang.";
        break;
      case "card_wa":
      case "card_nasib":
        info = "Ambil satu kartu. Bisa rezeki, bisa apes.";
        break;
      case "tax":
      case "gov_seat":
        info = `Bayar ${dr((def.amount ?? 0) * (shownK <= batasPanik(state) && coop ? 1.5 : 1))} ke Rezim. Sisi baiknya: warga makin marah, Semangat Demo naik.`;
        break;
      case "demo":
        info = `Orasi di sini: Semangat Demo langsung +${SEMANGAT_TITIK_DEMO}.`;
        break;
      case "lumbung":
        info = "Posko warga: Lumbung Bersama dapat tambahan dana.";
        break;
      case "property": {
        const owner = t.owner;
        const g = def.group ?? "";
        const kawan = groupTiles(g).map((k) => TILES[k].name).join(", ");
        rows.push(
          h("div", { class: "tag", style: `background:${GROUP_COLOR[g]}` }, `Warna ${GROUP_LABEL[g]}`),
          row("Pemilik", owner === null ? "Kosong" : owner === GOV ? "🏴 Rezim" : nm(owner)),
          owner !== null ? row("Tingkat", LEVEL_LABEL[t.level]) : row("Harga beli", dr(def.price ?? 0)),
        );
        if (owner === GOV) {
          rows.push(row("Pungli kalau mendarat", dr(pungliAset(state, i))), row("Harga rebut", dr(hargaBeli(state, i))));
          info = "Aset Rezim. Mendarat di sini kena pungli, tapi kamu bisa merebutnya.";
        } else if (owner !== null) {
          rows.push(
            row("Omzet tiap gajian", dr(omzetUsaha(state, i))),
            row("Kalau pejabat mampir", `Kekuasaan −${REZIM_KENA[t.level]}`),
            t.level < MAX_LEVEL ? row("Biaya upgrade", dr(biayaUpgrade(i))) : null,
          );
          info = kampungMandiri(state, g)
            ? "Kampung Mandiri: semua petak warna ini milik rakyat, omzet & sewa 2x."
            : `Kuasai semua warna ${GROUP_LABEL[g]} bareng warga lain (${kawan}) buat jadi Kampung Mandiri: omzet 2x dan Kekuasaan −${KAMPUNG_DAMAGE}.`;
        } else {
          info = `Mendarat di sini buat membelinya. Petak warna ${GROUP_LABEL[g]}: ${kawan}.`;
        }
        break;
      }
    }
    sheet(h("div", { class: "sheet-title" }, `${TILE_ICON[def.type] ?? ""} ${def.name}`), ...rows, h("div", { class: "muted" }, info));
  }

  /** Satu baris di lembar Aksi. */
  function arow(icon: string, judul: string, isi: string, label: string, ok: boolean, why: string, fn: () => void): HTMLElement {
    return h(
      "button",
      { class: `arow${ok ? "" : " off"}`, onclick: () => (ok ? fn() : toast(why)) },
      h("span", { class: "a-icon" }, icon),
      h("span", { class: "a-main" }, h("b", {}, judul), h("small", {}, isi)),
      h("span", { class: "a-label" }, label),
    );
  }

  function showAksi(): void {
    const meP = state.players[me];
    if (!meP || !myTurn() || playing) return;
    const o = peluang();
    const beli = state.phase === "awaiting_buy";
    const jr = JURUS[meP.profession];
    const lakukan = (a: Action) => () => (close(), void send(a));
    const rows: (HTMLElement | null)[] = beli
      ? []
      : [
          arow(jr.emoji, `Jurus ${jr.nama}`, jr.efek, o.jurusSiap ? "SIAP" : `${meP.jurus}/${JURUS_PENUH}`, o.jurusBisa,
            o.jurusSiap ? "Jalan Tikus dipakai setelah kamu melempar dadu." : "Jurus terisi satu tiap giliranmu.", lakukan({ type: "jurus" })),
          arow("🏗️", "Upgrade usaha", "Omzet naik, pejabat yang mampir makin rugi", o.punyaUsaha ? "pilih" : "—", o.punyaUsaha,
            "Kamu belum punya usaha.", () => (close(), showUpgrade())),
          coop ? arow("✍️", "Petisi online", "Semangat Demo naik", drPendek(PETISI_BIAYA), o.bisaPetisi,
            state.aksiDipakai ? "Satu aksi perlawanan per giliran." : "Uangmu nggak cukup.", lakukan({ type: "petisi" })) : null,
          coop ? arow("📰", "Liputan Media", `Kekuasaan −${LIPUTAN_DAMAGE}, dibayar Lumbung`, `🌾 ${drPendek(LIPUTAN_BIAYA_LUMBUNG)}`, o.bisaLiputan,
            state.aksiDipakai ? "Satu aksi perlawanan per giliran." : `Lumbung baru ${dr(state.lumbung)}.`, lakukan({ type: "liputan_media" })) : null,
          meP.jailTurns > 0 && o.rolling
            ? arow("🧾", "Bayar denda tilang", "Langsung bebas", drPendek(DENDA_TILANG), meP.cuan >= DENDA_TILANG, "Uangmu nggak cukup.", lakukan({ type: "bayar_denda" }))
            : null,
          meP.jailTurns > 0 && o.rolling
            ? arow("🤝", "Damai di tempat", "Separuh harga, tapi 1 dari 4 kena OTT", drPendek(DENDA_TILANG / 2), meP.cuan >= DENDA_TILANG / 2, "Uangmu nggak cukup.", lakukan({ type: "bayar_denda", jalur: "pelicin" }))
            : null,
          arow("🤝", "Bantu warga", "Lunasi utang teman atau kirim uang", "pilih", meP.cuan >= 500_000, "Uangmu sendiri lagi tipis.", () => (close(), showBantu())),
          coop ? arow("🌾", "Sumbang Lumbung", "Dana talangan bersama", "pilih", meP.cuan >= 500_000, "Uangmu sendiri lagi tipis.", () => (close(), showLumbung())) : null,
        ];
    rows.push(arow("💸", "Pinjol", meP.utang > 0 ? `Utangmu ${dr(meP.utang)}, bunga 10% tiap ronde` : "Cair seketika, bunganya mencekik", "buka", true, "", () => (close(), showPinjol())));
    const close = sheet(h("div", { class: "sheet-title" }, "⚡ Aksi"), ...rows);
  }

  function showPinjol(): void {
    const meP = state.players[me];
    const bisa = myTurn() && !playing;
    const pinjam = (n: number) =>
      h("button", { class: "btn small", disabled: !bisa || meP.utang + n * 1.2 > 8_000_000, onclick: () => (close(), void send({ type: "pinjol", amount: n })) }, `Pinjam ${drPendek(n)}`);
    const close = sheet(
      h("div", { class: "sheet-title" }, "💸 Pinjol \"CairKilat\""),
      row("Utangmu sekarang", dr(meP.utang)),
      h("div", { class: "muted" }, "Uang cair seketika, tapi utang langsung ditambah bunga 20%, lalu berbunga 10% tiap ronde. Tiap gajian dipotong otomatis DR 1 jt. Utang DR 6 jt ke atas: debt collector meneror dan giliranmu dilewati."),
      h("div", { class: "row" }, pinjam(1_000_000), pinjam(2_000_000), pinjam(4_000_000)),
      meP.utang > 0 && state.phase !== "awaiting_buy"
        ? h(
            "div",
            { class: "row" },
            h("button", { class: "btn small green", disabled: !bisa || meP.cuan < 500_000, onclick: () => (close(), void send({ type: "bayar_utang", amount: 1_000_000 })) }, "Cicil 1 jt"),
            h("button", { class: "btn small green", disabled: !bisa || meP.cuan < meP.utang, onclick: () => (close(), void send({ type: "bayar_utang", amount: meP.utang })) }, `Lunasi ${drPendek(meP.utang)}`),
          )
        : null,
      h("div", { class: "muted small" }, "Warga lain bisa membantu melunasi utangmu lewat ⚡ Aksi → Bantu warga."),
    );
  }

  function showBantu(): void {
    const meP = state.players[me];
    const lain = playersInOrder(state).filter((p) => p.id !== me && !p.bankrupt);
    const close = sheet(
      h("div", { class: "sheet-title" }, "🤝 Bantu Warga"),
      h("div", { class: "muted" }, "Uangmu melunasi utang pinjolnya dulu, sisanya jadi pegangan dia. Kamu dapat poin jasa, dan Semangat Demo naik sekali per giliran."),
      ...lain.map((p) =>
        h(
          "div",
          { class: "up-row" },
          h("div", { class: "ava", style: `background:${colorForSeat(p.seat)}` }, PROFESSION_EMOJI[p.profession] ?? ""),
          h("div", { style: "flex:1" }, h("b", {}, p.name), h("div", { class: "muted" }, `${dr(p.cuan)}${p.utang > 0 ? ` · utang ${drPendek(p.utang)}` : ""}`)),
          ...[500_000, 1_000_000].map((n) =>
            h("button", { class: "btn small green", disabled: meP.cuan < n, onclick: () => (close(), void send({ type: "bantu", target: p.id, amount: n })) }, drPendek(n)),
          ),
        ),
      ),
    );
  }

  function showUpgrade(): void {
    const meP = state.players[me];
    const mine = state.tiles.map((t, i) => ({ t, i })).filter((x) => x.t.owner === me);
    const close = sheet(
      h("div", { class: "sheet-title" }, "🏗️ Upgrade Usaha"),
      h("div", { class: "muted" }, "🧾 Resmi: aman tapi mahal. 🤝 Pelicin: lebih murah, tapi 1 dari 4 kena OTT (denda DR 1,5 jt + ditahan) dan tiap suap bikin Rezim pulih 2 Kekuasaan."),
      ...mine.map(({ t, i }) => {
        const maks = t.level >= MAX_LEVEL;
        const tombol = (jalur: "resmi" | "pelicin") => {
          const biaya = biayaUpgrade(i, jalur);
          return h(
            "button",
            {
              class: `btn small ${meP.cuan >= biaya ? (jalur === "resmi" ? "green" : "") : "grey"}`,
              onclick: () => {
                if (meP.cuan < biaya) return toast("Uangmu nggak cukup.");
                close();
                void send({ type: "upgrade", tile: i, jalur });
              },
            },
            `${jalur === "resmi" ? "🧾" : "🤝"} ${drPendek(biaya)}`,
          );
        };
        return h(
          "div",
          { class: "up-row" },
          h("div", { style: `width:8px;align-self:stretch;border-radius:4px;background:${GROUP_COLOR[TILES[i].group ?? ""]}` }),
          h(
            "div",
            { style: "flex:1" },
            h("b", {}, TILES[i].name),
            h("div", { class: "muted" }, maks ? "Brand Lokal (maksimal)" : `${LEVEL_LABEL[t.level]} → ${LEVEL_LABEL[t.level + 1]} · omzet ${drPendek(omzetUsaha(state, i, t.level + 1))}`),
          ),
          ...(maks ? [h("span", {}, "⭐")] : [tombol("resmi"), tombol("pelicin")]),
        );
      }),
    );
  }

  function showLumbung(): void {
    const meP = state.players[me];
    const bisa = myTurn() && !playing && (state.phase === "awaiting_roll" || state.phase === "awaiting_end");
    const close = sheet(
      h("div", { class: "sheet-title" }, "🌾 Lumbung Bersama"),
      row("Isi sekarang", dr(state.lumbung)),
      h("div", { class: "muted" }, `Dana darurat semua warga. Otomatis menalangi siapa pun yang nggak sanggup bayar, jadi nggak langsung bangkrut. Kalau isinya ${dr(LIPUTAN_BIAYA_LUMBUNG)}, bisa dipakai mendanai Liputan Media (Kekuasaan −${LIPUTAN_DAMAGE}).`),
      h("div", { class: "muted" }, "Terisi dari 20% gaji tiap gajian, Posko Gotong Royong, kartu, dan sumbangan."),
      bisa && meP && meP.cuan >= 500_000
        ? h(
            "div",
            { class: "row" },
            ...[500_000, 1_000_000, 2_000_000]
              .filter((n) => meP.cuan >= n)
              .map((n) =>
                h("button", { class: "btn small green", onclick: () => {
                  close();
                  void send({ type: "donasi_lumbung", amount: n });
                } }, `Sumbang ${drPendek(n)}`),
              ),
          )
        : null,
    );
  }

  function showPlayer(id: string): void {
    const p = state.players[id];
    const usaha = state.tiles.map((t, i) => ({ t, i })).filter((x) => x.t.owner === id);
    sheet(
      h("div", { class: "sheet-title" }, `${PROFESSION_EMOJI[p.profession]} ${id === me ? "Kamu" : p.name}`),
      row("Profesi", PROFESSION_LABEL[p.profession]),
      h("div", { class: "muted" }, `Keahlian: ${PROFESSION_SKILL[p.profession]}`),
      h("div", { class: "muted" }, `⚡ Jurus ${JURUS[p.profession].nama} (${p.jurus}/${JURUS_PENUH}): ${JURUS[p.profession].efek}.`),
      coop ? row("Jasa melawan Rezim", `${p.jasa} poin`) : null,
      coop && id !== me
        ? h(
            "div",
            { class: "tag", style: `background:${p.buzzer ? "var(--red)" : state.bersih.includes(id) ? "var(--green)" : "#8a97ad"}` },
            p.buzzer
              ? "🕵️ Buzzer (terbongkar)"
              : state.bersih.includes(id)
                ? "✅ Bukan buzzer (pernah salah dituduh)"
                : `🔎 Jejak mengarah ke dia: ${state.jejak[id] ?? 0} kali`,
          )
        : null,
      coop && id !== me && !p.buzzer && !p.bankrupt && !state.bersih.includes(id) && state.players[me] && !state.players[me].sudahTuduh
        ? myTurn() && !playing && state.phase !== "awaiting_buy"
          ? h("button", { class: "btn small red", onclick: () => tuduh(id) }, "🕵️ Tuduh sebagai buzzer")
          : h("div", { class: "muted small" }, "Menuduh hanya bisa di giliranmu.")
        : null,
      row("Uang", dr(p.cuan)),
      p.utang > 0 ? row("Utang pinjol", dr(p.utang)) : null,
      row("Total harta", dr(netWorth(state, p))),
      id === me && driver.role() === "buzzer" ? h("div", { class: "tag", style: "background:#3a3f4b" }, "🤫 Kamu Buzzer") : null,
      usaha.length > 0
        ? h("div", { class: "muted" }, `Usaha: ${usaha.map((x) => `${TILES[x.i].name} (${LEVEL_LABEL[x.t.level]})`).join(", ")}`)
        : h("div", { class: "muted" }, "Belum punya usaha."),
      h("button", { class: "btn small grey", onclick: () => showLog() }, "📜 Lihat riwayat"),
    );
  }

  function showMenu(): void {
    const kecepatan = h("button", { class: "btn grey block" }, speed >= 2 ? "⏩ Kecepatan: ngebut 2x" : "▶️ Kecepatan: normal");
    kecepatan.onclick = () => {
      toggleSpeed();
      kecepatan.textContent = speed >= 2 ? "⏩ Kecepatan: ngebut 2x" : "▶️ Kecepatan: normal";
    };
    const suara = h("button", { class: "btn grey block" }, isMuted() ? "🔇 Suara mati" : "🔊 Suara nyala");
    suara.onclick = () => (suara.textContent = toggleMute() ? "🔇 Suara mati" : "🔊 Suara nyala");
    const close = sheet(
      h("div", { class: "sheet-title" }, "Menu"),
      h("button", { class: "btn grey block", onclick: () => (close(), showHelp()) }, "❓ Cara main"),
      suara,
      kecepatan,
      h("button", { class: "btn grey block", onclick: () => (close(), showLog()) }, "📜 Riwayat"),
      h("button", { class: "btn red block", onclick: () => (close(), confirmExit()) }, "🚪 Keluar"),
    );
  }

  function showBoss(): void {
    sheet(
      h("div", { class: "sheet-title" }, driver.local ? `${BABAK[state.level - 1].emoji} ${BABAK[state.level - 1].nama}` : "🏛️ Rezim"),
      row("❤️ Kekuasaan", `${state.kekuasaan} / ${state.kekuasaanMaks}`),
      h("div", { class: "muted" }, "Habiskan sebelum Pemilu. Turun lewat Demo Akbar, Liputan Media, jurus, Kampung Mandiri, dan tiap mobil pejabat mampir ke usaha rakyat."),
      row("✊ Semangat Demo", `${state.semangat}%`),
      h("div", { class: "muted" }, "Naik saat warga beli atau upgrade usaha, bikin petisi, dan kena pungli. Penuh = Demo Akbar."),
      state.kekuasaan <= batasPanik(state)
        ? h("div", { class: "tag", style: "background:var(--red)" }, "Rezim panik: semua pungutan 1,5x")
        : h("div", { class: "muted" }, "Kalau Kekuasaan tinggal separuh, Rezim panik dan semua pungutan jadi 1,5x."),
      h("div", { class: "muted" }, "🕵️ Rezim bisa menyuap warga yang kepepet kapan saja. Buzzer menyabotase tiap ronde tanpa nama. Jejak digital (🔎) sering mengarah ke dia, tapi kadang dipalsukan buat memfitnah. Ketuk warga yang kamu curigai untuk menuduh."),
    );
  }

  function tuduh(id: string): void {
    const p = state.players[id];
    const close = modal(
      h(
        "div",
        { class: "sheet col" },
        h("div", { class: "sheet-title" }, `🕵️ Tuduh ${p.name} buzzer?`),
        h("div", { class: "muted" }, `Jejak yang mengarah ke dia: ${state.jejak[id] ?? 0} kali. Ingat, jejak bisa dipalsukan, dan bisa saja belum ada buzzer sama sekali.`),
        h("div", { class: "muted" }, "Benar: buzzer terbongkar, Kekuasaan −12 dan Semangat +20. Salah: kamu didenda DR 1,5 jt dan Semangat −12. Kamu cuma punya satu kesempatan per permainan."),
        h(
          "div",
          { class: "row" },
          h("button", { class: "btn grey", style: "flex:1", onclick: () => close() }, "Batal"),
          h("button", { class: "btn red", style: "flex:1", onclick: () => (close(), void send({ type: "tuduh", target: id })) }, "Tuduh!"),
        ),
      ),
    );
  }

  function showLog(): void {
    sheet(h("div", { class: "sheet-title" }, "📜 Riwayat"), h("div", { class: "log" }, ...[...log].reverse().map((l) => h("div", {}, l))));
  }

  function confirmExit(): void {
    const close = modal(
      h(
        "div",
        { class: "sheet col" },
        h("div", { class: "sheet-title" }, "Keluar dari permainan?"),
        h("div", { class: "muted" }, driver.local ? "Permainan solo tersimpan otomatis. Kamu bisa lanjut lagi dari beranda." : "Permainan tetap jalan. Kamu bisa masuk lagi dari beranda."),
        h(
          "div",
          { class: "row" },
          h("button", { class: "btn grey", onclick: () => close() }, "Batal"),
          h("button", { class: "btn red", onclick: () => {
            close();
            opts.onExit();
          } }, "Keluar"),
        ),
      ),
    );
  }

  // ------------------------------------------------------------------ mulai

  // Kait pengujian: buka dengan ?debug untuk memicu efek dari konsol.
  if (new URLSearchParams(location.search).has("debug")) {
    (window as unknown as Record<string, unknown>).__wkwk = {
      scene,
      fx: (id: string) => kebijakanFx(id, state),
      play: (events: GameEvent[]) => play(events, state),
    };
  }

  let bottomInset = 62;
  function fit(): void {
    root.style.setProperty("--feed-top", `${top.offsetHeight + 4}px`);
    // Layar lebar (tablet/desktop): HUD menepi ke kiri, papan memakai seluruh tinggi layar.
    const lebar = innerWidth > innerHeight * 1.2;
    scene.setInsets(lebar ? 0 : top.offsetHeight + 4, lebar ? 40 : bottomInset);
  }

  updateTop();
  renderBottom();
  requestAnimationFrame(fit);
  window.addEventListener("resize", fit);
  const unsub = driver.subscribe(enqueue);
  scene.focusPawn(state.order[state.turn]);
  if (coop && version === 1) {
    setTimeout(() => !disposed && void banner("info", "🕵️ AWAS BUZZER", "Rezim bisa menyuap warga yang kepepet kapan saja", 2600), 900);
  }
  if (state.phase === "game_over") void showGameOver();
  else if (!localStorage.getItem(HELP_SEEN)) showHelp(() => afterIdle());
  else afterIdle();

  return () => {
    disposed = true;
    clearTimeout(botTimer);
    unsub();
    window.removeEventListener("resize", fit);
    scene.dispose();
    sceneEl.style.display = "none";
    document.querySelectorAll(".overlay").forEach((o) => o.remove());
  };
}
