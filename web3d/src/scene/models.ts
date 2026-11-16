// Model 3D dari bentuk dasar: bangunan usaha, pion warga, mobil pejabat, Istana Rezim.
import * as THREE from "three";

const mat = (color: THREE.ColorRepresentation, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra });

function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cyl(rt: number, rb: number, h: number, m: THREE.Material, x = 0, y = 0, z = 0, seg = 16): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  return mesh;
}

/** Atap pelana (prisma segitiga) dengan lebar w, tinggi h, panjang d. */
function gable(w: number, h: number, d: number, m: THREE.Material, y: number): THREE.Mesh {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(0, h);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
  geo.translate(0, 0, -d / 2);
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.y = y;
  mesh.castShadow = true;
  return mesh;
}

const WALL = mat("#fff6e0");
const WINDOW = mat("#5cc8ff", { emissive: "#1d6fa3", emissiveIntensity: 0.35, roughness: 0.2 });
const WOOD = mat("#a8723f");
const GOLD = mat("#ffd24a", { metalness: 0.6, roughness: 0.3, emissive: "#a36b00", emissiveIntensity: 0.35 });
const CONCRETE = mat("#6b7280");
const DARK = mat("#2b2f3a");
const REZIM_RED = mat("#c1121f");

/**
 * Bangunan usaha. Level 0 Lapak, 1 Toko, 2 Cabang, 3 Brand Lokal.
 * Warna atap/tenda mengikuti pemilik. Aset Rezim berupa gedung beton kelabu.
 */
export function makeBuilding(level: number, color: string, rezim: boolean): THREE.Group {
  const g = new THREE.Group();
  const accent = mat(color, { roughness: 0.5 });

  if (rezim) {
    const h = 0.7 + level * 0.45;
    g.add(box(1.25, h, 0.95, CONCRETE));
    g.add(box(1.4, 0.14, 1.1, DARK, 0, h));
    for (let i = 0; i < 3; i++) g.add(box(0.2, h * 0.55, 0.04, DARK, -0.4 + i * 0.4, h * 0.2, 0.49));
    g.add(cyl(0.03, 0.03, 0.8, DARK, 0.45, h + 0.14, 0.3, 6));
    const flag = box(0.42, 0.26, 0.03, REZIM_RED, 0.68, h + 0.62, 0.3);
    flag.castShadow = false;
    g.add(flag);
    return g;
  }

  if (level === 0) {
    // Lapak: meja kayu + tenda bergaris.
    g.add(box(1.0, 0.36, 0.5, WOOD, 0, 0, 0.1));
    for (const x of [-0.5, 0.5]) for (const z of [-0.2, 0.4]) g.add(cyl(0.035, 0.035, 0.95, WALL, x, 0, z, 6));
    const tent = box(1.25, 0.1, 0.9, accent, 0, 0.92, 0.1);
    tent.rotation.x = 0.16;
    g.add(tent);
    for (let i = 0; i < 3; i++) {
      const s = box(0.2, 0.11, 0.91, WALL, -0.42 + i * 0.42, 0.92, 0.1);
      s.rotation.x = 0.16;
      s.castShadow = false;
      g.add(s);
    }
    return g;
  }

  if (level === 1) {
    // Toko: rumah kecil beratap pelana + kanopi.
    g.add(box(1.25, 0.8, 0.95, WALL));
    g.add(gable(1.45, 0.55, 1.1, accent, 0.8));
    g.add(box(0.3, 0.5, 0.04, WOOD, -0.3, 0, 0.48));
    g.add(box(0.42, 0.3, 0.04, WINDOW, 0.28, 0.3, 0.48));
    const canopy = box(1.25, 0.06, 0.3, accent, 0, 0.62, 0.6);
    canopy.rotation.x = 0.3;
    g.add(canopy);
    return g;
  }

  if (level === 2) {
    // Cabang: gedung dua lantai dengan papan nama.
    g.add(box(1.35, 1.5, 1.0, WALL));
    g.add(box(1.5, 0.14, 1.15, accent, 0, 1.5));
    g.add(box(1.1, 0.3, 0.06, accent, 0, 0.72, 0.52));
    for (const y of [0.25, 1.05]) for (const x of [-0.38, 0.38]) g.add(box(0.36, 0.3, 0.04, WINDOW, x, y, 0.5));
    return g;
  }

  // Brand Lokal: menara bertingkat dengan mahkota emas.
  g.add(box(1.4, 1.1, 1.05, WALL));
  g.add(box(1.5, 0.12, 1.15, accent, 0, 1.1));
  g.add(box(1.05, 0.9, 0.8, WALL, 0, 1.22));
  g.add(box(1.15, 0.12, 0.9, accent, 0, 2.12));
  g.add(box(0.7, 0.6, 0.55, WALL, 0, 2.24));
  g.add(gable(0.9, 0.4, 0.7, accent, 2.84));
  for (const y of [0.35, 1.5]) for (const x of [-0.36, 0, 0.36]) g.add(box(0.22, 0.34, 0.04, WINDOW, x * (y > 1 ? 0.75 : 1), y, y > 1 ? 0.41 : 0.53));
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), GOLD);
  star.position.y = 3.5;
  star.userData.spin = true;
  g.add(star);
  return g;
}

const SKIN = mat("#f2c19a", { roughness: 0.6 });
const EYE = mat("#22252b", { roughness: 0.3 });

/** Pion warga: badan warna kursi, kepala, mata, dan topi sesuai profesi. */
export function makePawn(color: string, profession: string): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.34, 6, 14), mat(color, { roughness: 0.35 }));
  body.position.y = 0.47;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 18, 14), SKIN);
  head.position.y = 1.08;
  head.castShadow = true;
  g.add(body, head);
  for (const x of [-0.1, 0.1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), EYE);
    eye.position.set(x, 1.11, 0.24);
    g.add(eye);
  }
  g.add(cyl(0.36, 0.4, 0.07, mat("#ffffff", { roughness: 0.4 }), 0, 0, 0, 20));

  const hat = new THREE.Group();
  hat.position.y = 1.2;
  const dome = (c: string, r = 0.29) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(c, { roughness: 0.4 }));
    m.castShadow = true;
    return m;
  };
  switch (profession) {
    case "buruh": // helm proyek kuning
      hat.add(dome("#ffcc29"), cyl(0.33, 0.33, 0.04, mat("#ffcc29"), 0, -0.02, 0.04, 16));
      break;
    case "pedagang": // caping
      hat.add(cyl(0.02, 0.46, 0.26, mat("#d9a441"), 0, -0.02, 0, 18));
      break;
    case "ojol": // helm hijau + kaca
      hat.add(dome("#17b26a", 0.31), box(0.36, 0.1, 0.04, WINDOW, 0, -0.1, 0.27));
      break;
    case "kreator": // topi terbalik + headphone
      hat.add(dome("#ff4d8d"), box(0.3, 0.04, 0.22, mat("#ff4d8d"), 0, 0, -0.3));
      break;
    case "jurnalis": // fedora
      hat.add(cyl(0.2, 0.24, 0.2, mat("#7a5230"), 0, 0.02, 0, 16), cyl(0.38, 0.38, 0.03, mat("#7a5230"), 0, 0.02, 0, 18));
      break;
    default: // mahasiswa: toga
      hat.add(cyl(0.2, 0.22, 0.12, mat("#273469"), 0, 0.02, 0, 14), box(0.62, 0.03, 0.62, mat("#273469"), 0, 0.14, 0));
      hat.children[1].rotation.y = Math.PI / 4;
  }
  g.add(hat);
  return g;
}

/** Mobil dinas hitam dengan strobo. userData.strobe berisi dua lampu yang dikedipkan. */
export function makeCar(): THREE.Group {
  const g = new THREE.Group();
  const black = mat("#17181c", { roughness: 0.25, metalness: 0.5 });
  g.add(box(0.8, 0.34, 1.6, black, 0, 0.16));
  g.add(box(0.72, 0.3, 0.9, black, 0, 0.5, -0.05));
  g.add(box(0.66, 0.2, 0.04, WINDOW, 0, 0.56, 0.41));
  g.add(box(0.66, 0.2, 0.04, WINDOW, 0, 0.56, -0.51));
  for (const x of [-0.4, 0.4]) {
    for (const z of [-0.5, 0.5]) {
      const w = cyl(0.17, 0.17, 0.12, mat("#0c0c0e"), 0, 0, 0, 12);
      w.rotation.z = Math.PI / 2;
      w.position.set(x, 0.17, z);
      g.add(w);
    }
  }
  const red = new THREE.MeshStandardMaterial({ color: "#ff2d2d", emissive: "#ff0000", emissiveIntensity: 2 });
  const blue = new THREE.MeshStandardMaterial({ color: "#2d6bff", emissive: "#0040ff", emissiveIntensity: 0.2 });
  g.add(box(0.2, 0.09, 0.14, red, -0.14, 0.8, -0.05), box(0.2, 0.09, 0.14, blue, 0.14, 0.8, -0.05));
  g.add(box(0.5, 0.08, 0.03, mat("#f4f4f4"), 0, 0.2, 0.81));
  g.userData.strobe = [red, blue];
  return g;
}

export interface Istana {
  group: THREE.Group;
  /** bagian yang ikut miring/goyang saat diserang */
  body: THREE.Group;
  walls: THREE.MeshStandardMaterial;
  siren: THREE.MeshStandardMaterial;
  flag: THREE.Mesh;
}

/** Istana Rezim di tengah papan: sasaran yang harus ditumbangkan. */
export function makeIstana(): Istana {
  const group = new THREE.Group();
  const body = new THREE.Group();
  const walls = mat("#fbfbf6", { roughness: 0.6 });
  const roof = mat("#b3261e", { roughness: 0.5 });
  const stone = mat("#d9d2c0");

  group.add(box(6.6, 0.25, 4.8, stone));
  group.add(box(5.8, 0.25, 4.0, stone, 0, 0.25));
  body.position.y = 0.5;
  body.add(box(4.8, 1.9, 2.6, walls, 0, 0, -0.3));
  body.add(box(5.2, 0.22, 3.0, stone, 0, 1.9, -0.3));
  // serambi bertiang
  for (let i = 0; i < 6; i++) body.add(cyl(0.14, 0.16, 1.9, walls, -2.0 + i * 0.8, 0, 1.25, 12));
  body.add(box(4.8, 0.2, 0.9, stone, 0, 1.9, 1.05));
  const ped = gable(4.9, 0.9, 0.9, walls, 2.1);
  ped.position.z = 1.05;
  body.add(ped);
  // kubah + menara bendera
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.05, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), roof);
  dome.position.set(0, 2.12, -0.3);
  dome.scale.y = 0.72;
  dome.castShadow = true;
  body.add(dome);
  body.add(cyl(0.05, 0.05, 1.5, DARK, 0, 3.1, -0.3, 8));
  const flag = box(0.9, 0.55, 0.04, REZIM_RED, 0.47, 4.0, -0.3);
  body.add(flag);
  const siren = new THREE.MeshStandardMaterial({ color: "#ff3b3b", emissive: "#ff0000", emissiveIntensity: 0 });
  body.add(cyl(0.16, 0.16, 0.2, siren, 0, 3.12, -0.3, 12));
  // pintu & jendela
  body.add(box(0.7, 1.2, 0.05, WOOD, 0, 0, 1.01));
  for (const x of [-1.7, -0.95, 0.95, 1.7]) body.add(box(0.4, 0.7, 0.05, WINDOW, x, 0.7, 1.01));
  group.add(body);
  return { group, body, walls, siren, flag };
}

export function makeTree(): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.09, 0.12, 0.6, WOOD, 0, 0, 0, 8));
  const leaf = mat("#3aa655", { roughness: 0.9 });
  for (const [r, y] of [[0.55, 0.5], [0.42, 0.95], [0.26, 1.35]] as const) {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leaf);
    s.position.y = y + 0.25;
    s.castShadow = true;
    g.add(s);
  }
  return g;
}

export function makeCloud(): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.92 });
  for (const [x, y, r] of [[0, 0, 1.6], [1.5, -0.2, 1.2], [-1.5, -0.25, 1.1], [0.6, 0.6, 1.1], [-0.7, 0.45, 0.9]] as const) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), m);
    s.position.set(x, y, 0);
    s.scale.y = 0.62;
    g.add(s);
  }
  return g;
}
