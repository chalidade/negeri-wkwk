# Negeri Wkwk

Monopoli satire online: rakyat satu tim menumbangkan Rezim. Game fiksi, tidak mewakili lembaga, partai, atau tokoh nyata.

Main di browser: https://negeri-wkwk.vercel.app

## Cara main singkat

- **Tujuan:** habiskan ❤️ Kekuasaan Rezim sebelum Pemilu (ronde 20). Kalah kalau Pemilu tiba, atau 2 warga bangkrut.
- **Cari duit:** lempar dadu, beli usaha. Tiap lewat Gajian dapat gaji + omzet usaha. Uangnya DR (Duit Rakyat), skala rupiah.
- **✊ Semangat Demo:** terisi saat warga beli/upgrade usaha, bikin petisi, atau kena pungli. Penuh = Demo Akbar, Kekuasaan Rezim rontok.
- **Rezim:** tiap akhir ronde keluar satu Kebijakan (atau bencana), lalu mobil pejabat jalan. Petak kosong dicaplok; kalau mampir ke usaha rakyat, dia yang bayar dan Kekuasaannya turun.
- **🌾 Lumbung Bersama:** dana talangan. Otomatis menalangi warga yang tidak sanggup bayar, dan bisa mendanai Liputan Media.
- **Kampung Mandiri:** satu warna dikuasai rakyat (boleh beda orang) = omzet dan sewa 2x, Kekuasaan turun.
- **Profesi:** Buruh, Pedagang, Ojol, Kreator, Jurnalis, Mahasiswa. Masing-masing punya satu keahlian dan satu jurus pamungkas yang terisi tiap beberapa giliran.
- **Dadu kendali:** tahan tombol dadu, lepas di tenaga Pelan (2–5), Sedang (6–8), atau Kencang (9–12). Jitu 75%.
- **Babak:** di mode solo, tiap menang Rezim berikutnya terbuka (10 babak, makin tebal dan makin rakus). Tiap game memberi bintang, XP pangkat, dan Emas Antum.
- **MVP:** jasa tiap warga melawan Rezim dihitung; yang terbanyak dapat mahkota.

Mode kedua, **Juragan**, bersaing jadi yang paling tajir; Rezim tetap mengganggu.

## Isi repo

| Folder | Isi |
| --- | --- |
| `supabase/functions/_shared/engine/` | Aturan permainan (TypeScript murni). Satu sumber untuk server dan klien. |
| `supabase/functions/_shared/board.json` | Papan 32 petak. |
| `supabase/functions/*/` | Edge Functions: `create-room`, `join-room`, `add-bot`, `remove-bot`, `start-game`, `game-action`, `bot-step`, `delete-account`. |
| `supabase/migrations/` | Skema Postgres + RLS. Klien hanya membaca; semua penulisan lewat Edge Functions. |
| `supabase/tests/` | Tes engine (termasuk simulasi ratusan game) dan tes RLS. |
| `web3d/` | Klien 3D (Three.js + Vite). Solo jalan di perangkat tanpa server; main bareng teman lewat Supabase. |

Angka keseimbangan ada di `engine/rules.ts`, isi kartu di `engine/cards.ts`.

## Menjalankan

```bash
npm test                      # tes engine
cd web3d && npm ci && npm run dev   # klien di http://localhost:5173
```

Tes database butuh PostgreSQL 15+ atau Docker: `npm run test:db`.

## Deploy

- Push ke `main`: GitHub Actions menjalankan tes, lalu membangun `web3d` ke branch `web-preview` yang di-deploy Vercel.
- Integrasi GitHub Supabase men-deploy migration dan Edge Functions yang terdaftar di `supabase/config.toml`.
- Rilis ke Play Store dan App Store: lihat `RELEASE.md`.
