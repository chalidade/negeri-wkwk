// Ukuran dan posisi di dunia 3D. Papan 9x9 petak, 32 petak di tepinya.
export const N = 9;
export const CELL = 2.2;
export const BOARD = N * CELL;
/** tinggi permukaan atas petak */
export const TOP = 0.5;

/** Petak 0 di pojok kanan bawah (dekat kamera), lalu ke kiri, naik, ke kanan, turun. */
export function tileCell(index: number): { row: number; col: number } {
  if (index <= 8) return { row: 8, col: 8 - index };
  if (index <= 16) return { row: 16 - index, col: 0 };
  if (index <= 24) return { row: 0, col: index - 16 };
  return { row: index - 24, col: 8 };
}

export function tileXZ(index: number): { x: number; z: number } {
  const c = tileCell(index);
  return { x: (c.col - 4) * CELL, z: (c.row - 4) * CELL };
}
