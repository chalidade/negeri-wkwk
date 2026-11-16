import * as THREE from "three";

/** Pion klasik hasil "bubut" (lathe). Tinggi ~1.3 unit. */
export function pawnGeometry(): THREE.LatheGeometry {
  const pts = [
    [0, 0],
    [0.46, 0],
    [0.46, 0.09],
    [0.36, 0.16],
    [0.22, 0.42],
    [0.16, 0.68],
    [0.28, 0.76],
    [0.28, 0.81],
    [0.13, 0.86],
    [0.25, 1.0],
    [0.24, 1.14],
    [0.14, 1.25],
    [0, 1.29],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(pts, 32);
  g.computeVertexNormals();
  return g;
}

function mat(color: string | number, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra });
}

function shadowed<T extends THREE.Object3D>(o: T): T {
  o.traverse((c) => {
    if (c instanceof THREE.Mesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });
  return o;
}

/** Rumah kecil (usaha yang di-upgrade). */
export function makeHouse(level: number): THREE.Group {
  const g = new THREE.Group();
  const wall = ["#fff4dc", "#ffe3a3", "#ffd166", "#ffc94d"][level] ?? "#fff4dc";
  const roof = ["#c0392b", "#e63946", "#3a86ff", "#9b5de5"][level] ?? "#c0392b";
  const h = 0.32 + level * 0.12;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, h, 0.42), mat(wall));
  body.position.y = h / 2;
  const top = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.26, 4), mat(roof));
  top.position.y = h + 0.13;
  top.rotation.y = Math.PI / 4;
  g.add(body, top);
  return shadowed(g);
}

/** Monumen low-poly di tengah papan (tugu bermahkota api emas). */
export function makeMonument(): THREE.Group {
  const g = new THREE.Group();
  const white = mat("#f4efe6", { roughness: 0.5 });
  const gold = mat("#ffc94d", { metalness: 0.8, roughness: 0.25, emissive: "#a8701a", emissiveIntensity: 0.35 });
  const step1 = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.3, 3.2), white);
  step1.position.y = 0.15;
  const step2 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 2.2), white);
  step2.position.y = 0.55;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.5, 4.6, 4), white);
  shaft.position.y = 3.1;
  shaft.rotation.y = Math.PI / 4;
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.3, 0.35, 8), white);
  cup.position.y = 5.55;
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.1, 8), gold);
  flame.position.y = 6.25;
  g.add(step1, step2, shaft, cup, flame);
  return shadowed(g);
}

/** Pohon kelapa sederhana untuk dekorasi. */
export function makePalm(): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 1.6, 6), mat("#8b5a2b"));
  trunk.position.y = 0.8;
  trunk.rotation.z = 0.12;
  g.add(trunk);
  const leaf = mat("#2dbe6c", { side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) {
    const l = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.1, 4), leaf);
    l.position.set(0.1, 1.6, 0);
    l.rotation.z = Math.PI / 2.4;
    const holder = new THREE.Group();
    holder.rotation.y = (i / 6) * Math.PI * 2;
    l.position.x = 0.45;
    holder.add(l);
    holder.position.y = 0;
    g.add(holder);
  }
  return shadowed(g);
}

/** Bajaj mini (oranye) untuk dekorasi. */
export function makeBajaj(): THREE.Group {
  const g = new THREE.Group();
  const orange = mat("#ff7a1a", { roughness: 0.45 });
  const dark = mat("#222");
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.55), orange);
  body.position.y = 0.45;
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.45), orange);
  nose.position.set(0.55, 0.38, 0);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.06, 0.6), dark);
  roof.position.y = 0.78;
  g.add(body, nose, roof);
  for (const [x, z] of [[-0.3, 0.3], [-0.3, -0.3], [0.62, 0]] as const) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 12), dark);
    w.rotation.x = Math.PI / 2;
    w.position.set(x, 0.14, z);
    g.add(w);
  }
  return shadowed(g);
}

export { shadowed };
