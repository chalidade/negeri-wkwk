// Tipe bersama untuk semua jenis permainan (solo, tuan rumah, server). Tidak memuat supabase-js.
import type { GameState } from "./shared.ts";

export class ApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

export interface GameRow {
  version: number;
  state: GameState;
}
