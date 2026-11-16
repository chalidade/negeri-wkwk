#!/usr/bin/env bash
# Salin data papan dari server ke aset aplikasi. Jalankan tiap board.json diubah.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cp "$root/supabase/functions/_shared/board.json" "$root/app/assets/board.json"
echo "board.json disinkronkan ke app/assets/"
