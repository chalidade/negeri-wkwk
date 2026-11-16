// Ukuran dan posisi di dunia 3D. Satu petak = CELL unit.
export const CELL = 2;
export const BOARD_SIZE = CELL * 11;
export const BOARD_TOP = 0.5; // permukaan kayu papan
export const TILE_H = 0.24;
export const TILE_TOP = BOARD_TOP + TILE_H;

/** Petak 0 di pojok kanan bawah (dekat kamera), berjalan searah jarum jam. */
export function tileCell(index: number): { row: number; col: number } {
  if (index <= 10) return { row: 10, col: 10 - index };
  if (index <= 20) return { row: 20 - index, col: 0 };
  if (index <= 30) return { row: 0, col: index - 20 };
  return { row: index - 30, col: 10 };
}

export function tileXZ(index: number): { x: number; z: number } {
  const c = tileCell(index);
  return { x: (c.col - 5) * CELL, z: (c.row - 5) * CELL };
}
