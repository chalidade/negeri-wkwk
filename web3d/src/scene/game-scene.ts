// Dunia 3D: pulau papan, petak, bangunan, pion, mobil pejabat, dan Istana Rezim.
// HUD (DOM) yang mengatur urutan cerita; kelas ini hanya menggambar dan menganimasikan.
import * as THREE from "three";
import { GOV, TILES, colorForSeat, type GameState, type TileState } from "../shared.ts";
import { BOARD, CELL, TOP, tileCell, tileXZ } from "./layout.ts";
import { makeBuilding, makeCar, makeCloud, makeIstana, makePawn, makeTree, type Istana } from "./models.ts";
import { labelTexture, lawnTexture, skyTexture, tileTexture } from "./textures.ts";

interface PawnView {
  group: THREE.Group;
  label: THREE.Sprite;
  tile: number;
  dead: boolean;
  /** label dinaikkan kalau beberapa pion berdiri di petak yang sama */
  lift: number;
}

interface Tween {
  start: number;
  dur: number;
  step: (k: number) => void;
  resolve: () => void;
}

interface Particle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; max: number;
  sx: number; sy: number;
  grav: number;
}

export type BurstKind = "spark" | "dust" | "smoke" | "coins" | "confetti" | "debris";
const BURST: Record<BurstKind, { n: number; colors: string[]; speed: number; up: number; size: number; life: number; grav: number }> = {
  spark: { n: 26, colors: ["#ffe14d", "#fff7c2", "#ffb300"], speed: 2.6, up: 5.5, size: 0.16, life: 0.9, grav: 9 },
  dust: { n: 20, colors: ["#e8dcc0", "#cbbd9c", "#f6ecd2"], speed: 2.2, up: 1.8, size: 0.26, life: 0.9, grav: 1.5 },
  smoke: { n: 22, colors: ["#3a3f4b", "#5a6170", "#22252b"], speed: 1.4, up: 3.2, size: 0.32, life: 1.3, grav: -1 },
  coins: { n: 22, colors: ["#ffd24a", "#ffb300", "#fff2a8"], speed: 1.8, up: 7, size: 0.18, life: 1.1, grav: 12 },
  confetti: { n: 46, colors: ["#ff4d5e", "#ffd84d", "#22c06b", "#2f8bff", "#a35cf0", "#ffffff"], speed: 4.2, up: 7.5, size: 0.17, life: 1.6, grav: 7 },
  debris: { n: 30, colors: ["#fbfbf6", "#d9d2c0", "#b3261e", "#8d8676"], speed: 4.5, up: 6, size: 0.22, life: 1.2, grav: 11 },
};
const MAX_PARTICLES = 420;

const PITCH = (52 * Math.PI) / 180;
const CAM_DIR = new THREE.Vector3(0, Math.sin(PITCH), Math.cos(PITCH));
const FOV = 46;
const easeOutBack = (k: number) => 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2);
const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

/** Arah keluar papan untuk sebuah petak (pojok = diagonal). */
function outward(index: number): { x: number; z: number } {
  const c = tileCell(index);
  return { x: c.col === 0 ? -1 : c.col === 8 ? 1 : 0, z: c.row === 0 ? -1 : c.row === 8 ? 1 : 0 };
}

export class GameScene {
  /** pengali kecepatan animasi (1 = normal, 2 = ngebut) */
  speed = 1;
  onStep: (() => void) | null = null;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 400);
  private raf = 0;
  private last = performance.now();
  private tweens: Tween[] = [];
  private disposed = false;

  private tiles: THREE.Mesh[] = [];
  private sideMats: THREE.MeshStandardMaterial[] = [];
  private topMats: THREE.MeshStandardMaterial[] = [];
  private lit: number[] = [];
  private buildings: (THREE.Group | null)[] = [];
  private tileKeys: string[] = [];
  private spinners: THREE.Object3D[] = [];

  private pawns = new Map<string, PawnView>();
  private ring: THREE.Mesh;
  private activeId: string | null = null;
  private car = makeCar();
  private carTile = 16;
  private istana: Istana = makeIstana();
  private tilt = 0;
  private panik = false;
  private crowd: THREE.InstancedMesh;
  private crowdSeeds: { x: number; z: number; p: number }[] = [];
  private clouds: THREE.Group[] = [];
  private trees: THREE.Group[] = [];
  private signs!: THREE.InstancedMesh;
  private fxMesh!: THREE.InstancedMesh;
  private particles: Particle[] = [];
  private shakeUntil = 0;
  private shakeAmp = 0;
  private quakeUntil = 0;
  private rainUntil = 0;
  private water!: THREE.Mesh;
  private wave!: THREE.Mesh;

  private camTarget = new THREE.Vector3(0, TOP, 0.8);
  private camDist = 60;
  private goalTarget = new THREE.Vector3(0, TOP, 0.8);
  private goalDist = 60;
  private follow: THREE.Object3D | null = null;
  private insets = { top: 0, bottom: 0 };
  private overviewDist = 60;
  private focusDist = 30;

  constructor(private host: HTMLElement, private onTileClick: (index: number) => void) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.append(this.renderer.domElement);

    this.scene.background = skyTexture();
    this.scene.add(new THREE.HemisphereLight("#ffffff", "#b9e6a0", 1.55));
    const sun = new THREE.DirectionalLight("#fff6e0", 1.9);
    sun.position.set(-14, 26, 16);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -17;
    sc.right = sc.top = 17;
    sc.near = 1;
    sc.far = 80;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun);

    this.buildIsland();
    this.buildTiles();

    this.istana.group.position.set(0, TOP - 0.1, -0.6);
    this.scene.add(this.istana.group);

    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.52, 0.07, 8, 28),
      new THREE.MeshBasicMaterial({ color: "#ffe14d" }),
    );
    this.ring.rotation.x = Math.PI / 2;
    this.ring.visible = false;
    this.scene.add(this.ring);

    this.scene.add(this.car);
    this.placeCar(this.carTile);

    // massa demo: muncul hanya saat Demo Akbar
    const N = 150;
    this.crowd = new THREE.InstancedMesh(
      new THREE.CapsuleGeometry(0.22, 0.34, 4, 8),
      new THREE.MeshStandardMaterial({ roughness: 0.6 }),
      N,
    );
    const palette = ["#ff4d5e", "#2f8bff", "#22c06b", "#ffa51f", "#a35cf0", "#ffffff", "#ffe14d"];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const r = 3.9 + (i % 4) * 0.62 + Math.random() * 0.3;
      this.crowdSeeds.push({ x: Math.cos(a) * r * 1.12, z: -0.6 + Math.sin(a) * r * 0.86, p: Math.random() * 6 });
      this.crowd.setColorAt(i, new THREE.Color(palette[i % palette.length]));
    }
    this.crowd.castShadow = true;
    this.crowd.visible = false;
    this.crowd.frustumCulled = false;
    this.scene.add(this.crowd);
    // poster demo yang diacung-acungkan
    this.signs = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.62, 0.4, 0.05),
      new THREE.MeshStandardMaterial({ roughness: 0.7 }),
      Math.ceil(N / 5),
    );
    for (let i = 0; i < this.signs.count; i++) this.signs.setColorAt(i, new THREE.Color(i % 2 ? "#ffffff" : "#ffe14d"));
    this.signs.visible = false;
    this.signs.frustumCulled = false;
    this.scene.add(this.signs);

    // kolam partikel untuk semua efek (debu, percikan, koin, konfeti, hujan)
    this.fxMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial(),
      MAX_PARTICLES,
    );
    this.fxMesh.frustumCulled = false;
    this.fxMesh.count = 0;
    for (let i = 0; i < MAX_PARTICLES; i++) this.fxMesh.setColorAt(i, new THREE.Color("#fff"));
    this.scene.add(this.fxMesh);

    // air banjir: naik saat bencana
    this.water = new THREE.Mesh(
      new THREE.BoxGeometry(BOARD + 3.2, 0.4, BOARD + 3.2),
      new THREE.MeshStandardMaterial({ color: "#2f9bff", transparent: true, opacity: 0.62, roughness: 0.15, metalness: 0.2 }),
    );
    this.water.position.y = -1.2;
    this.water.visible = false;
    this.scene.add(this.water);

    // gelombang kejut dari Istana saat kebijakan menghantam semua warga
    this.wave = new THREE.Mesh(
      new THREE.RingGeometry(0.82, 1, 48),
      new THREE.MeshBasicMaterial({ color: "#ff3b4e", transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.wave.rotation.x = -Math.PI / 2;
    this.wave.position.set(0, TOP + 0.12, -0.6);
    this.wave.visible = false;
    this.scene.add(this.wave);

    const el = this.renderer.domElement;
    let down: { x: number; y: number } | null = null;
    el.addEventListener("pointerdown", (e) => (down = { x: e.clientX, y: e.clientY }));
    el.addEventListener("pointerup", (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) return;
      const r = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, this.camera);
      const hit = ray.intersectObjects(this.tiles, false)[0];
      if (hit) this.onTileClick(this.tiles.indexOf(hit.object as THREE.Mesh));
    });
    window.addEventListener("resize", this.resize);
    this.resize();
    this.camTarget.copy(this.goalTarget);
    this.camDist = this.goalDist = this.overviewDist;
    this.loop();
  }

  // ------------------------------------------------------------------ bangun dunia

  private buildIsland(): void {
    const full = BOARD + 3.4;
    const dirt = new THREE.Mesh(
      new THREE.CylinderGeometry(full / Math.SQRT2, (full * 0.66) / Math.SQRT2, 3.2, 4, 1),
      new THREE.MeshStandardMaterial({ color: "#b47b45", roughness: 1, flatShading: true }),
    );
    dirt.rotation.y = Math.PI / 4;
    dirt.position.y = -1.9;
    this.scene.add(dirt);
    const grass = new THREE.Mesh(
      new THREE.BoxGeometry(full, 0.5, full),
      new THREE.MeshStandardMaterial({ color: "#7cc65a", roughness: 1 }),
    );
    grass.position.y = -0.25;
    grass.receiveShadow = true;
    this.scene.add(grass);

    // jalan aspal keliling papan, jalur patroli mobil pejabat
    const road = new THREE.MeshStandardMaterial({ color: "#5a6170", roughness: 0.95 });
    const w = BOARD + 3.0;
    for (const [sx, sz, px, pz] of [
      [w, 1.5, 0, BOARD / 2 + 0.75],
      [w, 1.5, 0, -BOARD / 2 - 0.75],
      [1.5, w, BOARD / 2 + 0.75, 0],
      [1.5, w, -BOARD / 2 - 0.75, 0],
    ] as const) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.06, sz), road);
      m.position.set(px, 0.03, pz);
      m.receiveShadow = true;
      this.scene.add(m);
    }

    const inner = BOARD - 2 * CELL;
    const lawn = new THREE.Mesh(
      new THREE.BoxGeometry(inner, TOP - 0.1, inner),
      [0, 1, 2, 3, 4, 5].map((i) =>
        i === 2
          ? new THREE.MeshStandardMaterial({ map: lawnTexture(), roughness: 1 })
          : new THREE.MeshStandardMaterial({ color: "#7cc65a" }),
      ),
    );
    lawn.position.y = (TOP - 0.1) / 2;
    lawn.receiveShadow = true;
    this.scene.add(lawn);

    for (const [x, z] of [[-6, -6], [6, -6], [-6, 6], [6, 6], [-6.3, 0.4], [6.3, 0.4], [-3.4, 6.3], [3.4, 6.3], [-2.6, -6.4], [2.6, -6.4]]) {
      const t = makeTree();
      t.position.set(x, TOP - 0.1, z);
      t.scale.setScalar(0.9 + Math.random() * 0.5);
      this.trees.push(t);
      this.scene.add(t);
    }
    for (let i = 0; i < 9; i++) {
      const c = makeCloud();
      const a = (i / 9) * Math.PI * 2;
      c.position.set(Math.cos(a) * (26 + (i % 3) * 8), -11 + (i % 4) * 1.6, -Math.abs(Math.sin(a)) * 26 - 2 + (i % 2) * 6);
      c.scale.setScalar(1.3 + (i % 3) * 0.7);
      this.clouds.push(c);
      this.scene.add(c);
    }
  }

  private buildTiles(): void {
    const geo = new THREE.BoxGeometry(CELL - 0.1, TOP, CELL - 0.1);
    for (const t of TILES) {
      const side = new THREE.MeshStandardMaterial({ color: "#f6ecd2", roughness: 0.8 });
      const top = new THREE.MeshStandardMaterial({ map: tileTexture(t), roughness: 0.85 });
      const mesh = new THREE.Mesh(geo, [side, side, top, side, side, side]);
      const p = tileXZ(t.index);
      mesh.position.set(p.x, TOP / 2, p.z);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.tiles.push(mesh);
      this.sideMats.push(side);
      this.topMats.push(top);
      this.buildings.push(null);
      this.tileKeys.push("");
    }
  }

  // ------------------------------------------------------------------ sinkron dengan state

  /** Samakan seluruh dunia dengan state, tanpa animasi. */
  sync(state: GameState): void {
    for (const id of state.order) {
      const p = state.players[id];
      let v = this.pawns.get(id);
      if (!v) {
        const color = colorForSeat(p.seat);
        const group = makePawn(color, p.profession);
        const label = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: labelTexture(p.name, color), depthTest: false, transparent: true }),
        );
        label.scale.set(1.9, 0.475, 1);
        label.renderOrder = 10;
        this.scene.add(group, label);
        v = { group, label, tile: p.position, dead: false, lift: 0 };
        this.pawns.set(id, v);
      }
      v.tile = p.position;
      v.dead = p.bankrupt;
      v.group.visible = v.label.visible = !p.bankrupt;
    }
    for (let i = 0; i < TILES.length; i++) this.arrange(i, false);
    state.tiles.forEach((t, i) => this.syncTile(i, t, state, false));
    this.carTile = state.rezimPos;
    this.placeCar(this.carTile);
    this.setRezim(state.kekuasaan / state.kekuasaanMaks, state.mode === "rakyat_bersatu" && state.kekuasaan <= state.kekuasaanMaks / 2);
    this.istana.group.visible = state.mode === "rakyat_bersatu";
    this.setActive(state.phase === "game_over" ? null : state.order[state.turn]);
  }

  /** Perbarui pemilik/bangunan satu petak. `pop` = bangunan muncul dengan animasi. */
  syncTile(i: number, tile: TileState, state: GameState, pop = true): void {
    const key = `${tile.owner}|${tile.level}`;
    if (this.tileKeys[i] === key) return;
    this.tileKeys[i] = key;
    const owner = tile.owner;
    const color = owner === null ? "#f6ecd2" : owner === GOV ? "#3a3f4b" : colorForSeat(state.players[owner]?.seat ?? 0);
    this.sideMats[i].color.set(color);

    const old = this.buildings[i];
    if (old) {
      this.scene.remove(old);
      this.spinners = this.spinners.filter((s) => s.parent !== old);
    }
    this.buildings[i] = null;
    if (owner === null || TILES[i].type !== "property") return;
    const b = makeBuilding(tile.level, color, owner === GOV);
    const p = tileXZ(i);
    b.position.set(p.x, TOP, p.z - 0.36);
    b.traverse((o) => o.userData.spin && this.spinners.push(o));
    this.scene.add(b);
    this.buildings[i] = b;
    if (pop) {
      b.scale.setScalar(0.01);
      void this.tween(480, (k) => b.scale.setScalar(Math.max(0.01, easeOutBack(k))));
    }
  }

  setActive(id: string | null): void {
    this.activeId = id;
  }

  /** Kondisi Istana: makin sedikit Kekuasaan, makin miring dan kusam. */
  setRezim(frac: number, panik: boolean): void {
    const f = Math.max(0, Math.min(1, frac));
    this.tilt = (1 - f) * 0.16;
    this.panik = panik && f > 0;
    this.istana.walls.color.set("#fbfbf6").lerp(new THREE.Color("#8d8676"), (1 - f) * 0.9);
    if (f <= 0) {
      this.istana.body.rotation.z = 0.42;
      this.istana.body.scale.y = 0.35;
      this.istana.flag.visible = false;
    }
  }

  // ------------------------------------------------------------------ animasi (mengembalikan Promise)

  private tween(durMs: number, step: (k: number) => void): Promise<void> {
    return new Promise((resolve) => {
      if (this.disposed) return resolve();
      this.tweens.push({ start: performance.now(), dur: Math.max(1, durMs / this.speed), step, resolve });
    });
  }

  private slot(tile: number, k: number, n: number): THREE.Vector3 {
    const p = tileXZ(tile);
    return new THREE.Vector3(p.x + (k - (n - 1) / 2) * 0.62, TOP, p.z + 0.5 + (n > 3 ? (k % 2) * 0.3 : 0));
  }

  /** Susun pion-pion yang berdiri di satu petak supaya tidak bertumpuk. */
  private arrange(tile: number, animate = true): void {
    const here = [...this.pawns.values()].filter((v) => v.tile === tile && !v.dead);
    here.forEach((v, k) => {
      v.lift = (k % 3) * 0.5;
      const to = this.slot(tile, k, here.length);
      if (!animate) return void v.group.position.copy(to);
      const from = v.group.position.clone();
      if (from.distanceTo(to) < 0.01) return;
      void this.tween(180, (t) => v.group.position.lerpVectors(from, to, t));
    });
  }

  /** Pion melompat petak demi petak dari `from` ke `to`. */
  async movePawn(id: string, from: number, to: number): Promise<void> {
    const v = this.pawns.get(id);
    if (!v) return;
    const steps = (to - from + TILES.length) % TILES.length;
    this.follow = v.group;
    this.goalDist = this.focusDist;
    const path = [v.group.position.clone()];
    for (let i = 1; i <= steps; i++) path.push(this.slot((from + i) % TILES.length, 0, 1));
    let lastStep = 0;
    await this.tween(150 * steps, (k) => {
      const f = Math.min(steps - 1e-6, k * steps);
      const i = Math.floor(f);
      const t = f - i;
      const a = path[i];
      const b = path[i + 1];
      v.group.position.lerpVectors(a, b, t);
      v.group.position.y = TOP + Math.sin(t * Math.PI) * 0.85;
      v.group.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
      if (i !== lastStep) {
        lastStep = i;
        this.onStep?.();
      }
    });
    if (steps > 0) v.group.position.copy(path[steps]);
    this.onStep?.();
    v.group.rotation.y = 0;
    const old = v.tile;
    v.tile = to;
    this.arrange(old);
    this.arrange(to);
    void this.bounceTile(to);
  }

  /** Pindah seketika (misalnya diciduk) dengan efek jatuh dari atas. */
  async teleportPawn(id: string, to: number): Promise<void> {
    const v = this.pawns.get(id);
    if (!v) return;
    const old = v.tile;
    v.tile = to;
    this.arrange(old);
    const dest = this.slot(to, 0, 1);
    this.follow = v.group;
    await this.tween(420, (k) => {
      v.group.position.set(dest.x, TOP + (1 - easeInOut(k)) * 7, dest.z);
    });
    this.arrange(to);
    void this.bounceTile(to);
  }

  killPawn(id: string): void {
    const v = this.pawns.get(id);
    if (!v) return;
    v.dead = true;
    v.group.visible = v.label.visible = false;
    this.arrange(v.tile);
  }

  async bounceTile(i: number): Promise<void> {
    const m = this.tiles[i];
    await this.tween(260, (k) => (m.position.y = TOP / 2 - Math.sin(k * Math.PI) * 0.14));
    m.position.y = TOP / 2;
  }

  private carPos(tile: number): THREE.Vector3 {
    const p = tileXZ(tile);
    const o = outward(tile);
    return new THREE.Vector3(p.x + o.x * (CELL / 2 + 0.78), 0.06, p.z + o.z * (CELL / 2 + 0.78));
  }

  private placeCar(tile: number): void {
    this.car.position.copy(this.carPos(tile));
    const next = this.carPos((tile + 1) % TILES.length);
    this.car.rotation.y = Math.atan2(next.x - this.car.position.x, next.z - this.car.position.z);
  }

  /** Mobil pejabat melaju di jalan aspal dari `from` ke `to`. */
  async moveCar(from: number, to: number): Promise<void> {
    const steps = (to - from + TILES.length) % TILES.length;
    this.follow = this.car;
    this.goalDist = this.focusDist;
    const path = [this.car.position.clone()];
    for (let i = 1; i <= steps; i++) path.push(this.carPos((from + i) % TILES.length));
    await this.tween(110 * steps, (k) => {
      const f = Math.min(steps - 1e-6, k * steps);
      const i = Math.floor(f);
      const a = path[i];
      const b = path[i + 1];
      this.car.position.lerpVectors(a, b, f - i);
      this.car.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    });
    if (steps > 0) this.car.position.copy(path[steps]);
    this.carTile = to;
    void this.bounceTile(to);
  }

  /** Istana terguncang kena serangan. */
  async hitIstana(): Promise<void> {
    const w = this.istana.walls;
    this.burstAtIstana("debris");
    this.shake(350, 0.16);
    await this.tween(520, (k) => {
      this.istana.body.rotation.x = Math.sin(k * Math.PI * 6) * 0.07 * (1 - k);
      w.emissive.setRGB(1 - k, 0, 0);
      w.emissiveIntensity = (1 - k) * 0.9;
    });
    this.istana.body.rotation.x = 0;
    w.emissiveIntensity = 0;
  }

  /** Massa mengepung Istana selama `ms`. */
  async demo(ms: number): Promise<void> {
    this.follow = null;
    this.goalTarget.set(0, TOP, 1.2);
    this.goalDist = this.focusDist * 1.12;
    this.crowd.visible = this.signs.visible = true;
    this.shake(ms * 0.6, 0.18);
    await this.tween(ms, () => undefined);
    this.crowd.visible = this.signs.visible = false;
  }

  async collapseIstana(): Promise<void> {
    this.follow = null;
    this.goalTarget.set(0, TOP, 1.2);
    this.goalDist = this.focusDist * 1.12;
    const b = this.istana.body;
    const from = { r: b.rotation.z, s: b.scale.y };
    this.istana.flag.visible = false;
    this.shake(1300, 0.3);
    await this.tween(1300, (k) => {
      b.rotation.z = from.r + (0.42 - from.r) * easeInOut(k);
      b.scale.y = from.s + (0.35 - from.s) * easeInOut(k);
      b.rotation.x = Math.sin(k * 40) * 0.03 * (1 - k);
      if (Math.random() < 0.3) this.burstAtIstana(Math.random() < 0.5 ? "debris" : "smoke");
    });
    this.tilt = 0.42;
    this.fireworks(8);
  }

  // ------------------------------------------------------------------ efek peta

  /** Semburan partikel di sebuah titik dunia. */
  burst(kind: BurstKind, at: THREE.Vector3): void {
    const c = BURST[kind];
    const color = new THREE.Color();
    for (let i = 0; i < c.n && this.particles.length < MAX_PARTICLES; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = c.speed * (0.4 + Math.random() * 0.8);
      const size = c.size * (0.6 + Math.random() * 0.8);
      const idx = this.particles.length;
      this.particles.push({
        x: at.x, y: at.y, z: at.z,
        vx: Math.cos(a) * sp, vy: c.up * (0.5 + Math.random() * 0.7), vz: Math.sin(a) * sp,
        life: 0, max: c.life * (0.7 + Math.random() * 0.6), sx: size, sy: size, grav: c.grav,
      });
      this.fxMesh.setColorAt(idx, color.set(c.colors[i % c.colors.length]));
    }
    if (this.fxMesh.instanceColor) this.fxMesh.instanceColor.needsUpdate = true;
  }

  burstAtTile(i: number, kind: BurstKind): void {
    const p = tileXZ(i);
    this.burst(kind, new THREE.Vector3(p.x, TOP + 0.5, p.z - 0.3));
  }

  burstAtPawn(id: string, kind: BurstKind): void {
    const v = this.pawns.get(id);
    if (v && !v.dead) this.burst(kind, v.group.position.clone().setY(TOP + 1.2));
  }

  burstAtIstana(kind: BurstKind): void {
    this.burst(kind, new THREE.Vector3((Math.random() - 0.5) * 3, TOP + 2.4, 0.2));
  }

  /** Kamera berguncang selama `ms`. */
  shake(ms: number, amp = 0.25): void {
    this.shakeUntil = performance.now() + ms / this.speed;
    this.shakeAmp = amp;
  }

  /** Gelombang merah menyapu papan dari Istana: kebijakan menghantam semua warga. */
  async shockwave(color = "#ff3b4e"): Promise<void> {
    const m = this.wave.material as THREE.MeshBasicMaterial;
    m.color.set(color);
    this.wave.visible = true;
    await this.tween(900, (k) => {
      this.wave.scale.setScalar(1 + k * 15);
      m.opacity = 0.85 * (1 - k);
    });
    this.wave.visible = false;
  }

  /** Banjir: air naik menggenangi papan, hujan turun, lalu surut. */
  async flood(ms: number): Promise<void> {
    this.overview();
    this.water.visible = true;
    this.rainUntil = performance.now() + ms / this.speed;
    await this.tween(ms, (k) => {
      const level = Math.sin(Math.min(1, k * 1.05) * Math.PI);
      this.water.position.y = -1.2 + level * (TOP + 1.35);
    });
    this.water.visible = false;
  }

  /** Gempa: papan dan bangunan bergetar. */
  async quake(ms: number): Promise<void> {
    this.overview();
    this.quakeUntil = performance.now() + ms / this.speed;
    this.shake(ms, 0.5);
    await this.tween(ms, () => undefined);
    this.tiles.forEach((m) => (m.position.y = TOP / 2));
    this.buildings.forEach((b) => b && (b.position.y = TOP));
  }

  /** Kabut asap menyelimuti papan lalu menipis. */
  async haze(ms: number): Promise<void> {
    this.overview();
    const fog = new THREE.FogExp2("#a39b8a", 0);
    this.scene.fog = fog;
    await this.tween(ms, (k) => (fog.density = Math.sin(k * Math.PI) * 0.022));
    this.scene.fog = null;
  }

  /** Petak-petak memantul bergiliran (misalnya satu warna jadi Kampung Mandiri). */
  waveTiles(indices: number[]): void {
    indices.forEach((i, k) => {
      setTimeout(() => {
        if (this.disposed) return;
        void this.bounceTile(i);
        this.burstAtTile(i, "confetti");
      }, (k * 170) / this.speed);
    });
  }

  /** Kembang api di atas papan. */
  fireworks(times = 6): void {
    for (let i = 0; i < times; i++) {
      setTimeout(() => {
        if (this.disposed) return;
        this.burst("confetti", new THREE.Vector3((Math.random() - 0.5) * 12, TOP + 4 + Math.random() * 3, (Math.random() - 0.5) * 9));
      }, i * 420);
    }
  }

  private updateFx(dt: number, now: number): void {
    // hujan saat banjir: garis-garis biru jatuh di atas papan
    if (now < this.rainUntil) {
      const color = new THREE.Color("#bfe4ff");
      for (let i = 0; i < 6 && this.particles.length < MAX_PARTICLES; i++) {
        const idx = this.particles.length;
        this.particles.push({
          x: (Math.random() - 0.5) * (BOARD + 4), y: 13, z: (Math.random() - 0.5) * (BOARD + 4),
          vx: -1.5, vy: -26, vz: 0, life: 0, max: 0.5, sx: 0.05, sy: 0.9, grav: 0,
        });
        this.fxMesh.setColorAt(idx, color);
      }
      if (this.fxMesh.instanceColor) this.fxMesh.instanceColor.needsUpdate = true;
    }

    if (now < this.quakeUntil) {
      const t = now / 1000;
      this.tiles.forEach((m, i) => (m.position.y = TOP / 2 + Math.sin(t * 38 + i * 1.9) * 0.09));
      this.buildings.forEach((b, i) => b && (b.position.y = TOP + Math.sin(t * 38 + i * 1.9) * 0.09));
    }

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    let moved = false;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.max) {
        // tukar dengan partikel terakhir supaya kolam tetap rapat
        const lastIdx = this.particles.length - 1;
        if (i !== lastIdx) {
          this.particles[i] = this.particles[lastIdx];
          const c = new THREE.Color();
          this.fxMesh.getColorAt(lastIdx, c);
          this.fxMesh.setColorAt(i, c);
          moved = true;
        }
        this.particles.pop();
      }
    }
    this.particles.forEach((p, i) => {
      p.vy -= p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const fade = Math.min(1, (p.max - p.life) / (p.max * 0.35));
      m.compose(pos.set(p.x, p.y, p.z), q.setFromAxisAngle(CAM_DIR, p.sy > p.sx * 2 ? 0 : p.life * 6 + i), scl.set(p.sx * fade, p.sy * fade, p.sx * fade));
      this.fxMesh.setMatrixAt(i, m);
    });
    this.fxMesh.count = this.particles.length;
    this.fxMesh.instanceMatrix.needsUpdate = true;
    if (moved && this.fxMesh.instanceColor) this.fxMesh.instanceColor.needsUpdate = true;
  }

  // ------------------------------------------------------------------ kamera

  overview(): void {
    this.follow = null;
    this.goalTarget.set(0, TOP, 0.8);
    this.goalDist = this.overviewDist;
  }

  focusPawn(id: string): void {
    const v = this.pawns.get(id);
    if (!v || v.dead) return;
    this.follow = v.group;
    this.goalDist = this.focusDist;
  }

  focusTile(i: number): void {
    const p = tileXZ(i);
    this.follow = null;
    this.aim(p.x, p.z);
    this.goalDist = this.focusDist;
  }

  /** Arahkan kamera ke sebuah titik, digeser sedikit ke tengah papan supaya papan mengisi layar. */
  private aim(x: number, z: number): void {
    const d = Math.hypot(x, z) || 1;
    const shift = Math.min(2.2, d);
    this.goalTarget.set(x - (x / d) * shift, TOP, z - (z / d) * shift - 0.3);
  }

  focusCar(): void {
    this.follow = this.car;
    this.goalDist = this.focusDist;
  }

  /** Sorot petak-petak yang mungkin diinjak (meteran dadu). Panggil tanpa isi untuk mematikan. */
  highlight(groups: { tiles: number[]; color: string }[] = []): void {
    for (const i of this.lit) {
      this.topMats[i].emissive.set("#000000");
      this.tiles[i].position.y = TOP / 2;
    }
    this.lit = [];
    for (const g of groups) {
      for (const i of g.tiles) {
        this.topMats[i].emissive.set(g.color);
        this.topMats[i].emissiveIntensity = 0.55;
        this.tiles[i].position.y = TOP / 2 + 0.16;
        this.lit.push(i);
      }
    }
  }

  /** Mundur sedikit dari pion supaya 12 petak di depannya kelihatan saat memilih tenaga dadu. */
  planView(id: string): void {
    const v = this.pawns.get(id);
    if (!v) return;
    this.follow = v.group;
    this.goalDist = Math.min(this.overviewDist, this.focusDist * 1.5);
  }

  /** Tinggi HUD atas & bawah (px) supaya papan dipusatkan di area yang kosong. */
  setInsets(top: number, bottom: number): void {
    this.insets = { top, bottom };
    this.resize();
  }

  private resize = (): void => {
    const w = this.host.clientWidth || window.innerWidth;
    const h = this.host.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    const free = Math.max(160, h - this.insets.top - this.insets.bottom);
    this.camera.setViewOffset(w, h, 0, -(this.insets.top - this.insets.bottom) / 2, w, h);
    this.camera.updateProjectionMatrix();

    const tan = Math.tan((FOV * Math.PI) / 360);
    const byWidth = (BOARD / 2 + 2.4) / (tan * this.camera.aspect);
    const byHeight = ((BOARD / 2 + 2.2) * Math.sin(PITCH) + 2.2) / (tan * (free / h));
    const keep = this.goalDist === this.overviewDist;
    this.overviewDist = Math.max(byWidth, byHeight);
    this.focusDist = Math.min(this.overviewDist * 0.8, Math.max(17, 5.9 / (tan * this.camera.aspect)));
    this.goalDist = keep ? this.overviewDist : this.focusDist;
  };

  /** Posisi layar (px, relatif halaman) dari sebuah titik dunia. */
  private project(v: THREE.Vector3): { x: number; y: number } {
    const p = v.clone().project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
  }

  screenOfTile(i: number): { x: number; y: number } {
    const p = tileXZ(i);
    return this.project(new THREE.Vector3(p.x, TOP + 0.8, p.z));
  }

  screenOfPawn(id: string): { x: number; y: number } {
    const v = this.pawns.get(id);
    return this.project(v ? v.group.position.clone().setY(TOP + 1.5) : new THREE.Vector3(0, 2, 0));
  }

  screenOfIstana(): { x: number; y: number } {
    return this.project(new THREE.Vector3(0, TOP + 3, -0.6));
  }

  // ------------------------------------------------------------------ loop

  private loop = (): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const t = now / 1000;

    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      const k = Math.min(1, (now - tw.start) / tw.dur);
      tw.step(k);
      if (k >= 1) {
        this.tweens.splice(i, 1);
        tw.resolve();
      }
    }

    // label & cincin giliran mengikuti pion
    for (const [id, v] of this.pawns) {
      v.label.position.set(v.group.position.x, v.group.position.y + 1.95 + v.lift, v.group.position.z);
      if (id === this.activeId && !v.dead) {
        this.ring.visible = true;
        this.ring.position.set(v.group.position.x, TOP + 0.06, v.group.position.z);
        this.ring.scale.setScalar(1 + Math.sin(t * 6) * 0.08);
      }
    }
    if (!this.activeId) this.ring.visible = false;

    // strobo mobil pejabat & sirene Istana
    const strobe = this.car.userData.strobe as THREE.MeshStandardMaterial[];
    const on = Math.floor(t * 5) % 2 === 0;
    strobe[0].emissiveIntensity = on ? 2.4 : 0.15;
    strobe[1].emissiveIntensity = on ? 0.15 : 2.4;
    this.istana.siren.emissiveIntensity = this.panik ? (Math.floor(t * 4) % 2 === 0 ? 3 : 0.2) : 0;
    this.istana.body.rotation.z += (this.tilt - this.istana.body.rotation.z) * Math.min(1, dt * 3);
    this.istana.flag.rotation.y = Math.sin(t * 3) * 0.25;

    for (const s of this.spinners) s.rotation.y = t * 2;
    this.clouds.forEach((c, i) => {
      c.position.x += dt * (0.25 + (i % 3) * 0.12);
      if (c.position.x > 46) c.position.x = -46;
    });

    if (this.crowd.visible) {
      const m = new THREE.Matrix4();
      this.crowdSeeds.forEach((s, i) => {
        m.makeTranslation(s.x, TOP + 0.2 + Math.abs(Math.sin(t * 8 + s.p)) * 0.5, s.z);
        this.crowd.setMatrixAt(i, m);
      });
      this.crowd.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < this.signs.count; i++) {
        const s = this.crowdSeeds[i * 5];
        m.makeRotationZ(Math.sin(t * 6 + s.p) * 0.25);
        m.setPosition(s.x, TOP + 1.35 + Math.abs(Math.sin(t * 8 + s.p)) * 0.5, s.z);
        this.signs.setMatrixAt(i, m);
      }
      this.signs.instanceMatrix.needsUpdate = true;
    }

    this.updateFx(dt, now);

    // hidup kecil-kecilan: pion bernapas, pohon bergoyang
    let pi = 0;
    for (const v of this.pawns.values()) v.group.scale.y = 1 + Math.sin(t * 3.2 + pi++ * 1.7) * 0.035;
    this.trees.forEach((tr, i) => (tr.rotation.z = Math.sin(t * 1.3 + i) * 0.035));

    // kamera mengikuti sasaran dengan halus
    if (this.follow) this.aim(this.follow.position.x, this.follow.position.z);
    const a = 1 - Math.exp(-dt * 5);
    this.camTarget.lerp(this.goalTarget, a);
    this.camDist += (this.goalDist - this.camDist) * a;
    this.camera.position.copy(this.camTarget).addScaledVector(CAM_DIR, this.camDist);
    this.camera.lookAt(this.camTarget);
    if (now < this.shakeUntil) {
      const amp = this.shakeAmp * Math.min(1, (this.shakeUntil - now) / 250);
      this.camera.position.x += (Math.random() - 0.5) * amp * 2;
      this.camera.position.y += (Math.random() - 0.5) * amp * 2;
    }

    this.renderer.render(this.scene, this.camera);
  };

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    for (const tw of this.tweens) tw.resolve();
    this.tweens = [];
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
