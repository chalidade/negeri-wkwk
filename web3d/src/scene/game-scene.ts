import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GOV, TILES, colorForSeat, type GameState } from "../shared.ts";
import { BOARD_SIZE, BOARD_TOP, CELL, TILE_H, TILE_TOP, tileXZ } from "./layout.ts";
import { makeBajaj, makeHouse, makeMonument, makePalm, pawnGeometry, shadowed } from "./models.ts";
import { centerTexture, dieFaceTexture, labelTexture, tileTexture } from "./textures.ts";

const TILES_PER_SECOND = 5;
const DIE = 0.9;

interface PawnView {
  group: THREE.Group;
  label: THREE.Sprite;
  shown: number; // posisi tampilan (boleh pecahan)
  target: number;
  seat: number;
}

interface TileView {
  top: THREE.Mesh;
  rim: THREE.Mesh;
  rimMat: THREE.MeshStandardMaterial;
  houses: THREE.Group;
  level: number;
  water: THREE.Mesh;
}

interface DieAnim {
  mesh: THREE.Mesh;
  from: THREE.Quaternion;
  to: THREE.Quaternion;
  axis: THREE.Vector3;
  rest: THREE.Vector3;
  start: number;
}

/** Scene 3D papan Negeri Wkwk. UI (HTML) memanggil update() setiap state berubah. */
export class GameScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, 1, 0.1, 300);
  private controls: OrbitControls;
  private tiles: TileView[] = [];
  private pawns = new Map<string, PawnView>();
  private dice: THREE.Mesh[] = [];
  private diceAnims: DieAnim[] = [];
  private activeRing: THREE.Mesh;
  private raf = 0;
  private last = performance.now();
  private state: GameState | null = null;
  private lastVersion = -1;
  private raycaster = new THREE.Raycaster();
  private downAt: { x: number; y: number } | null = null;
  private resizeObserver: ResizeObserver;

  constructor(
    private container: HTMLElement,
    private onTileClick: (index: number) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minPolarAngle = 0.25;
    this.controls.maxPolarAngle = 1.15;
    this.controls.target.set(0, 0, 1);

    this.buildWorld();
    this.activeRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.07, 12, 40),
      new THREE.MeshStandardMaterial({ color: "#ffc94d", emissive: "#ffb000", emissiveIntensity: 1.2 }),
    );
    this.activeRing.rotation.x = Math.PI / 2;
    this.activeRing.visible = false;
    this.scene.add(this.activeRing);

    this.resizeObserver = new ResizeObserver(() => this.resize(true));
    this.resizeObserver.observe(container);
    this.resize(true);

    const el = this.renderer.domElement;
    el.addEventListener("pointerdown", this.onDown);
    el.addEventListener("pointerup", this.onUp);
    this.loop();
  }

  // ------------------------------------------------------------------ dunia

  private buildWorld(): void {
    const s = this.scene;
    s.add(new THREE.HemisphereLight("#fff3d6", "#2a1840", 1.1));
    const sun = new THREE.DirectionalLight("#ffe2b0", 2.4);
    sun.position.set(-12, 26, 14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -18;
    sc.right = 18;
    sc.top = 18;
    sc.bottom = -18;
    sun.shadow.bias = -0.0005;
    s.add(sun);
    const rim = new THREE.DirectionalLight("#9b5de5", 0.6);
    rim.position.set(14, 8, -16);
    s.add(rim);

    // meja
    const table = new THREE.Mesh(
      new THREE.CircleGeometry(48, 64),
      new THREE.MeshStandardMaterial({ color: "#2a1a44", roughness: 1 }),
    );
    table.rotation.x = -Math.PI / 2;
    table.receiveShadow = true;
    s.add(table);

    // papan kayu tebal
    const wood = new THREE.MeshStandardMaterial({ color: "#9c6b3c", roughness: 0.55 });
    const woodDark = new THREE.MeshStandardMaterial({ color: "#5c3a1a", roughness: 0.6 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(BOARD_SIZE + 1.4, 0.32, BOARD_SIZE + 1.4), woodDark);
    base.position.y = 0.16;
    const top = new THREE.Mesh(new THREE.BoxGeometry(BOARD_SIZE + 0.9, 0.2, BOARD_SIZE + 0.9), wood);
    top.position.y = BOARD_TOP - 0.1;
    s.add(shadowed(base), shadowed(top));

    // tengah papan
    const center = new THREE.Mesh(
      new THREE.PlaneGeometry(CELL * 9 - 0.2, CELL * 9 - 0.2),
      new THREE.MeshStandardMaterial({ map: centerTexture(), roughness: 0.8 }),
    );
    center.rotation.x = -Math.PI / 2;
    center.position.y = BOARD_TOP + 0.005;
    center.receiveShadow = true;
    s.add(center);

    // petak
    const side = new THREE.MeshStandardMaterial({ color: "#e9d6b0", roughness: 0.7 });
    const geo = new THREE.BoxGeometry(CELL - 0.12, TILE_H, CELL - 0.12);
    const rimGeo = new THREE.BoxGeometry(CELL - 0.02, TILE_H * 0.7, CELL - 0.02);
    const waterGeo = new THREE.BoxGeometry(CELL - 0.2, 0.08, CELL - 0.2);
    const waterMat = new THREE.MeshStandardMaterial({ color: "#3a86ff", transparent: true, opacity: 0.55 });
    for (const t of TILES) {
      const { x, z } = tileXZ(t.index);
      const topMat = new THREE.MeshStandardMaterial({ map: tileTexture(t), roughness: 0.75 });
      const mesh = new THREE.Mesh(geo, [side, side, topMat, side, side, side]);
      mesh.position.set(x, BOARD_TOP + TILE_H / 2, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.index = t.index;
      const rimMat = new THREE.MeshStandardMaterial({ color: "#000", roughness: 0.4 });
      const rimMesh = new THREE.Mesh(rimGeo, rimMat);
      rimMesh.position.set(x, BOARD_TOP + TILE_H * 0.35, z);
      rimMesh.visible = false;
      const houses = new THREE.Group();
      houses.position.set(x, TILE_TOP, z);
      const water = new THREE.Mesh(waterGeo, waterMat);
      water.position.set(x, TILE_TOP + 0.04, z);
      water.visible = false;
      s.add(mesh, rimMesh, houses, water);
      this.tiles.push({ top: mesh, rim: rimMesh, rimMat, houses, level: 0, water });
    }

    // dekorasi tengah
    const monument = makeMonument();
    monument.position.set(0, BOARD_TOP, -4.6);
    monument.scale.setScalar(0.8);
    s.add(monument);
    for (const [x, z] of [[-6.6, -6.6], [6.6, -6.6], [-6.8, 6.4], [6.8, 6.4], [-3.2, -6.4], [3.2, -6.4]] as const) {
      const palm = makePalm();
      palm.position.set(x, BOARD_TOP, z);
      palm.scale.setScalar(1.1);
      s.add(palm);
    }
    const bajaj = makeBajaj();
    bajaj.position.set(-5.2, BOARD_TOP, 5.6);
    bajaj.rotation.y = 0.5;
    bajaj.scale.setScalar(1.3);
    s.add(bajaj);

    // dadu
    const faces = [3, 4, 1, 6, 2, 5].map(
      (v) => new THREE.MeshStandardMaterial({ map: dieFaceTexture(v), roughness: 0.35 }),
    );
    for (const x of [-0.75, 0.75]) {
      const die = new THREE.Mesh(new THREE.BoxGeometry(DIE, DIE, DIE), faces);
      die.position.set(x, BOARD_TOP + DIE / 2, 5.2);
      die.castShadow = true;
      this.dice.push(die);
      s.add(die);
    }
  }

  // ------------------------------------------------------------------ update dari state

  update(state: GameState, version: number): void {
    this.state = state;
    const current = state.phase === "game_over" ? null : state.players[state.order[state.turn]];

    state.tiles.forEach((ts, i) => {
      const view = this.tiles[i];
      const owner = ts.owner;
      const isCurrent = current !== null && current.position === i;
      if (isCurrent) {
        view.rim.visible = true;
        view.rimMat.color.set("#ffc94d");
        view.rimMat.emissive.set("#ffb000");
        view.rimMat.emissiveIntensity = 0.8;
      } else if (owner) {
        view.rim.visible = true;
        const color = owner === GOV ? "#111" : colorForSeat(state.players[owner]?.seat ?? 0);
        view.rimMat.color.set(color);
        view.rimMat.emissive.set(color);
        view.rimMat.emissiveIntensity = 0.25;
      } else {
        view.rim.visible = false;
      }
      view.water.visible = ts.disabledUntilRound >= state.round;
      if (view.level !== ts.level) {
        view.houses.clear();
        for (let k = 0; k < ts.level; k++) {
          const h = makeHouse(ts.level);
          h.position.set((k - (ts.level - 1) / 2) * 0.5, 0, -0.55);
          view.houses.add(h);
        }
        view.level = ts.level;
      }
    });

    for (const id of state.order) {
      const p = state.players[id];
      let view = this.pawns.get(id);
      if (!view) {
        view = this.makePawn(p.name, p.seat, p.position);
        this.pawns.set(id, view);
      }
      view.target = p.position;
      view.group.visible = !p.bankrupt;
      view.label.visible = !p.bankrupt;
    }

    // Saat pertama dibuka, tampilkan dadu terakhir tanpa animasi.
    // Animasi lempar dipicu UI lewat rollDice() ketika event "dadu" baru masuk.
    if (this.lastVersion < 0 && state.lastDice) this.setDice(state.lastDice);
    this.lastVersion = version;
  }

  /** Paksa animasi dadu (dipanggil UI saat ada event "dadu"). */
  rollDice(values: number[]): void {
    const now = performance.now();
    this.diceAnims = this.dice.map((mesh, i) => {
      const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * 0.8);
      return {
        mesh,
        from: new THREE.Quaternion().setFromEuler(
          new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        ),
        to: yaw.multiply(topQuaternion(values[i])),
        axis: new THREE.Vector3(Math.random() - 0.5, 0.3, Math.random() - 0.5).normalize(),
        rest: new THREE.Vector3(i === 0 ? -0.75 : 0.75, BOARD_TOP + DIE / 2, 5.2),
        start: now + i * 80,
      };
    });
  }

  private setDice(values: number[]): void {
    this.dice.forEach((d, i) => d.quaternion.copy(topQuaternion(values[i])));
  }

  private makePawn(name: string, seat: number, position: number): PawnView {
    const color = colorForSeat(seat);
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      pawnGeometry(),
      new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0.15 }),
    );
    body.castShadow = true;
    group.add(body);
    const label = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: labelTexture(name, color), depthTest: false, transparent: true }),
    );
    label.scale.set(1.9, 0.48, 1);
    label.renderOrder = 10;
    this.scene.add(group, label);
    return { group, label, shown: position, target: position, seat };
  }

  // ------------------------------------------------------------------ loop & animasi

  private loop = (): void => {
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.animatePawns(dt, now);
    this.animateDice(now);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  private animatePawns(dt: number, now: number): void {
    const state = this.state;
    const activeId = state && state.phase !== "game_over" ? state.order[state.turn] : null;
    // hitung jumlah pion per petak untuk menyebar posisi
    for (const [id, v] of this.pawns) {
      let remaining = (((v.target - v.shown) % 40) + 40) % 40;
      if (remaining > 12.5) {
        v.shown = v.target; // teleport (mis. diciduk)
        remaining = 0;
      } else if (remaining > 0.001) {
        v.shown = (v.shown + Math.min(remaining, dt * TILES_PER_SECOND)) % 40;
      }
      const base = Math.floor(v.shown) % 40;
      const frac = v.shown - Math.floor(v.shown);
      const a = tileXZ(base);
      const b = tileXZ((base + 1) % 40);
      const spreadX = ((v.seat % 3) - 1) * 0.5;
      const spreadZ = (Math.floor(v.seat / 3) - 0.5) * 0.5;
      const x = a.x + (b.x - a.x) * frac + spreadX;
      const z = a.z + (b.z - a.z) * frac + spreadZ;
      const hop = Math.sin(frac * Math.PI) * 1.1;
      const bob = id === activeId ? Math.sin(now / 250) * 0.06 + 0.06 : 0;
      v.group.position.set(x, TILE_TOP + hop + bob, z);
      v.group.scale.setScalar(id === activeId ? 1.12 : 1);
      v.label.position.set(x, TILE_TOP + hop + 1.85, z);
      if (id === activeId) {
        this.activeRing.visible = true;
        this.activeRing.position.set(x, TILE_TOP + 0.03, z);
        this.activeRing.scale.setScalar(1 + Math.sin(now / 200) * 0.08);
      }
    }
    if (!activeId) this.activeRing.visible = false;
  }

  private animateDice(now: number): void {
    if (this.diceAnims.length === 0) return;
    const DUR = 1100;
    let done = true;
    for (const a of this.diceAnims) {
      const t = Math.max(0, Math.min(1, (now - a.start) / DUR));
      if (t < 1) done = false;
      const e = 1 - Math.pow(1 - t, 3);
      const q = a.from.clone().slerp(a.to, e);
      const spin = new THREE.Quaternion().setFromAxisAngle(a.axis, (1 - e) * (1 - e) * Math.PI * 6);
      a.mesh.quaternion.copy(spin.multiply(q));
      const fall = (1 - t) * (1 - t) * 5;
      const bounce = Math.abs(Math.sin(t * Math.PI * 3)) * (1 - t) * 1.2;
      a.mesh.position.set(a.rest.x + (1 - e) * (a.rest.x > 0 ? 1.5 : -1.5), a.rest.y + fall + bounce, a.rest.z - (1 - e) * 2);
    }
    if (done) {
      for (const a of this.diceAnims) {
        a.mesh.quaternion.copy(a.to);
        a.mesh.position.copy(a.rest);
      }
      this.diceAnims = [];
    }
  }

  // ------------------------------------------------------------------ input & ukuran

  private onDown = (e: PointerEvent): void => {
    this.downAt = { x: e.clientX, y: e.clientY };
  };

  private onUp = (e: PointerEvent): void => {
    if (!this.downAt) return;
    const moved = Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y);
    this.downAt = null;
    if (moved > 8) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.tiles.map((t) => t.top), false);
    if (hits.length > 0) this.onTileClick(hits[0].object.userData.index as number);
  };

  private resize(refit: boolean): void {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (refit) {
      // Jarak kamera supaya papan (lebar ~25 unit) muat di layar, termasuk HP potret.
      const halfFov = THREE.MathUtils.degToRad(this.camera.fov / 2);
      const aspect = Math.min(this.camera.aspect, 1.3);
      const dist = THREE.MathUtils.clamp(13.2 / (Math.tan(halfFov) * aspect), 24, 75);
      const dir = new THREE.Vector3(0, 1.25, 1).normalize();
      this.camera.position.copy(this.controls.target).addScaledVector(dir, dist);
      this.controls.minDistance = dist * 0.45;
      this.controls.maxDistance = dist * 1.4;
      this.controls.update();
    }
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener("pointerdown", this.onDown);
    el.removeEventListener("pointerup", this.onUp);
    this.controls.dispose();
    this.renderer.dispose();
    el.remove();
  }
}

/** Orientasi dadu supaya angka v menghadap ke atas (+y). Urutan muka: +x=3 -x=4 +y=1 -y=6 +z=2 -z=5. */
function topQuaternion(v: number): THREE.Quaternion {
  const q = new THREE.Quaternion();
  switch (v) {
    case 6:
      return q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
    case 2:
      return q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    case 5:
      return q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    case 3:
      return q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
    case 4:
      return q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2);
    default:
      return q;
  }
}
