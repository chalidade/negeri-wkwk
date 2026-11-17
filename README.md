# Negeri Wkwk

Monopoli satire online: rakyat satu tim menumbangkan Rezim. Game fiksi, tidak mewakili lembaga, partai, atau tokoh nyata.

Main di browser: https://negeri-wkwk.vercel.app

## Cara main singkat

- **Tujuan:** habiskan ❤️ Kekuasaan Rezim sebelum Pemilu (ronde 14). Kalah kalau Pemilu tiba, atau 2 warga bangkrut.
- **Cari duit:** lempar dadu, beli usaha. Tiap lewat Gajian dapat gaji + omzet usaha. Uangnya DR (Duit Rakyat), skala rupiah.
- **Semangat Demo:** terisi saat warga beli/upgrade usaha, bikin petisi, atau kena pungli. Massa berkumpul di depan Istana, makin ramai seiring Semangat. Penuh = Demo Akbar, Kekuasaan Rezim rontok.
- **Rezim:** tiap akhir ronde keluar satu Kebijakan (atau bencana), lalu mobil pejabat jalan. Petak kosong dicaplok; kalau mampir ke usaha rakyat, dia yang bayar dan Kekuasaannya turun.
- **🌾 Lumbung Bersama:** dana talangan. Otomatis menalangi warga yang tidak sanggup bayar, dan bisa mendanai Liputan Media.
- **Kampung Mandiri:** satu warna dikuasai rakyat (boleh beda orang) = omzet dan sewa 2x, Kekuasaan turun.
- **Profesi:** Buruh, Pedagang, Ojol, Kreator, Jurnalis, Mahasiswa. Masing-masing punya satu keahlian dan satu jurus pamungkas yang terisi tiap beberapa giliran.
- **Dadu kendali:** tahan tombol dadu, lepas di tenaga Pelan (2–5), Sedang (6–8), atau Kencang (9–12). Jitu 75%.
- **Babak:** di mode solo, tiap menang Rezim berikutnya terbuka (10 babak, makin tebal dan makin rakus). Tiap game memberi bintang, XP pangkat, dan Emas Antum.
- **MVP:** jasa tiap warga melawan Rezim dihitung; yang terbanyak dapat mahkota.
- **Dadu Nasib:** sebagian kartu dan bencana ditentukan lemparan dadu. 2–5 mujur, 6–8 lumayan, 9–12 apes.
- **Buzzer:** di mode solo, Rezim bisa menyuap seorang warga bot di tengah permainan (yang paling kepepet paling mungkin). Buzzer menyabotase tiap ronde tanpa nama. Jejak digital sering mengarah ke dia tapi bisa dipalsukan untuk memfitnah warga lain. Buzzer bermain seperti warga biasa: ikut beli usaha, pakai jurus, bahkan bantu warga lain.
- **Jadi buzzer:** di solo, Rezim bisa menyodorkan amplop DR 4 jt ke pemain. Menerima berarti tujuan berbalik: menang kalau Rezim bertahan sampai Pemilu tanpa diusir Sidang. Buzzer memilih satu sabotase per ronde (tagar tandingan, tilep Lumbung, laporkan warga, poles citra, atau pura-pura ikut ditangkap sebagai alibi) dan dibayar DR 500 rb tiap sabotase.
- **Sulit ditebak:** tanpa buzzer aktif, pasukan siber Rezim sendiri kadang beraksi dan tampil persis seperti sabotase buzzer, lengkap dengan jejak ke warga acak. Warga yang main pelicin juga bisa kena jejak. Buzzer yang terbongkar bisa diganti (peluang 65%), jadi tidak ada yang tahu apakah masih ada buzzer.
- **Sidang Warga:** tiap pemain boleh memanggil sidang satu kali. Semua warga memilih siapa yang diusir (atau abstain), dan suara terbanyak keluar dari permainan. Kalau yang diusir memang buzzer, hartanya dibagi ke warga dan Rezim kena pukul. Kalau salah orang, hartanya disita Rezim dan semangat warga turun.
- **Resmi atau pelicin:** buka dan upgrade usaha lewat jalur resmi (harga + izin 15%) atau uang pelicin (lebih murah 15%, tapi 25% kena OTT: denda DR 1,5 jt dan ditahan; tiap suap yang lolos memulihkan 2 Kekuasaan Rezim).
- **Pinjol:** uang cair seketika; utang langsung +20%, berbunga 10% tiap ronde, dicicil DR 1 jt tiap gajian. Utang DR 6 jt ke atas membuat giliran dilewati.
- **Aparat di Demo Akbar:** dua dadu menentukan hasilnya. 2 sampai 5 barikade jebol (pukulan 1,3x, Semangat tersisa 20), 6 sampai 8 massa ditahan (pukulan biasa), 9 sampai 12 dibubarkan gas air mata (pukulan 0,6x, satu warga diamankan).
- **Kas Rezim:** semua pungutan dari warga terkumpul, lalu dihamburkan tiap kali penuh: studi banding, renovasi rumah dinas, baliho pencitraan (Kekuasaan naik), atau bayar buzzer (Semangat turun).
- **Pengalihan Isu:** kalau Semangat 70 ke atas di akhir ronde, Rezim bisa melemparnya sebagai ganti Kebijakan. Dadu Nasib menentukan seberapa warga terkecoh.
- **Diambil Alih Negara:** kartu Kebijakan yang mengincar usaha rakyat paling mahal. Dadu Nasib menentukan: batal karena ditolak warga, diambil dengan ganti rugi separuh nilai, atau diambil tanpa ganti rugi. Bangunannya utuh jadi aset Rezim.
- **Pajak Orang Kaya:** warga diurutkan dari total harta (uang + nilai usaha). Yang terkaya bayar 15% uangnya, berikutnya 10%, lalu 6%, sisanya 3% (minimal DR 200 rb).
- **Tingkat kesulitan:** nyawa Rezim diambil dari tabel per jumlah warga dan babak (`KEKUASAAN_BABAK` di `rules.ts`), disetel lewat simulasi bot. Makin ramai room-nya makin berat, dan tiap babak lebih berat dari sebelumnya.
- **Buzzer memoles citra:** salah satu sabotase buzzer menaikkan kepercayaan publik (Kekuasaan Rezim).
- **Mekanik bertahap:** babak 1 hanya dasar; pelicin dan aparat mulai babak 2, pinjol dan buzzer babak 3, anggaran dan pengalihan isu babak 4. Room online langsung memakai semua mekanik.
- **Upgrade usaha:** mendarat di usaha sendiri langsung ditawari upgrade; bisa juga ketuk panah kuning di atas usaha, atau lewat tombol Aksi.
- **Bantu warga:** kirim uang ke warga lain; utang pinjolnya dilunasi dulu. Memberi poin jasa dan Semangat.

Mode kedua, **Juragan**, bersaing jadi yang paling tajir; Rezim tetap mengganggu.

## Isi repo

| Folder | Isi |
| --- | --- |
| `supabase/functions/_shared/engine/` | Aturan permainan (TypeScript murni). Satu sumber untuk server dan klien. |
| `supabase/functions/_shared/board.json` | Papan 32 petak. |
| `supabase/functions/*/` | Edge Functions: `create-room`, `join-room`, `add-bot`, `remove-bot`, `start-game`, `game-action`, `bot-step`, `delete-account`. |
| `supabase/migrations/` | Skema Postgres + RLS. Klien hanya membaca; semua penulisan lewat Edge Functions. |
| `supabase/tests/` | Tes engine (termasuk simulasi ratusan game) dan tes RLS. |
| `web3d/` | Klien 3D (Three.js + Vite). Solo dan main bareng teman jalan tanpa server milik kita (lihat di bawah). |

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

## Emas Antum, misi, musik

- **Toko** (`web3d/src/toko.ts`): Emas Antum dibelanjakan untuk hiasan saja: warna kartu warga, warna mata dadu, bingkai avatar. Tidak memengaruhi peluang menang.
- **Misi harian:** tiga misi berganti tiap hari, hadiahnya Emas Antum.
- **Bansos harian:** hadiah masuk tiap hari dalam putaran 7 hari (5, 5, 8, 8, 10, 12, 25 emas; hari ke-7 ditambah satu amplop stiker). Bolong sehari, hitungan balik ke hari 1. Ditawarkan sekali tiap aplikasi dibuka setelah pemain pernah main.
- **Album stiker:** 18 stiker di 3 halaman (Warga, Rezim, Perlawanan) dengan tiga kelangkaan. Tiap habis main dapat amplop: kalah 1, menang 2, bintang tiga 3. Stiker dobel ditukar emas, satu halaman lengkap +30 emas, album tamat +100 emas. Amplop juga bisa dibeli 20 emas.
- **Menang beruntun:** tiap kemenangan beruntun menambah bonus 2 emas (paling banyak +10). Kalah, hitungannya putus.
- **Musik latar:** gamelan kecil hasil sintesis di `web3d/src/sfx.ts`, tanpa berkas audio. Bisa dimatikan dari menu.

## Gaya visual

Arah desain "stopmap & stempel": warna datar, garis tinta, bayangan keras, tanpa gradasi. Beranda berupa kartu warga (nama, pekerjaan, pangkat sebagai stempel). Huruf: Bagel Fat One untuk judul dan Plus Jakarta Sans untuk teks. Ikon dan avatar digambar sendiri di `web3d/src/icons.ts` (topi avatar sama dengan topi pion 3D), jadi antarmuka tidak bergantung pada emoji bawaan HP.

## Main bareng tanpa server

Bawaannya (`BACKEND = "p2p"` di `web3d/src/config.ts`) game tidak memakai Supabase sama sekali:

- **Tuan rumah** (`web3d/src/p2p.ts`): HP yang bikin room menjalankan engine dan menyimpan permainan di localStorage-nya. Tamu mengirim aksi, tuan rumah membalas state. Rahasia (siapa buzzer, tawaran amplop) disaring per tamu. Tamu yang terputus lebih dari 25 detik saat gilirannya dimainkan AI sampai dia kembali.
- **Lewat internet** (`web3d/src/net.ts`): WebRTC langsung antar-HP. HP saling menemukan lewat relay publik Nostr (pustaka trystero) memakai kode room 6 huruf atau link `?gabung=KODE`. Room publik mengumumkan diri di ruang `lobi-publik` sehingga muncul di daftar "Room terbuka".
- **Tanpa internet**: semua HP di Wi-Fi atau hotspot yang sama. Tuan rumah menampilkan QR undangan, tamu memindainya dan menampilkan QR jawaban, tuan rumah memindai balik. Service worker (`web3d/public/sw.js`) menyimpan aset supaya game tetap bisa dibuka tanpa internet.
- **Bluetooth dan Wi-Fi Direct** tidak bisa dari peramban; butuh aplikasi Android (Capacitor + Nearby Connections). Belum dikerjakan.
- **Jalur Supabase** tetap ada: build dengan `VITE_BACKEND=supabase` untuk mengaktifkannya. Kodenya ada di `web3d/src/online-supabase.ts` dan baru dimuat kalau diaktifkan. Migration dan Edge Functions di `supabase/` tidak diubah.
- Pengujian di satu peramban: tambahkan `?uji` di URL supaya beberapa tab saling tersambung lewat BroadcastChannel tanpa relay.

## Aplikasi Android

`web3d/android/` adalah proyek Capacitor yang membungkus build web yang sama (`com.chalidade.negeriwkwk`).
Workflow `.github/workflows/android.yml` membangunnya tiap ada perubahan di `web3d/` dan melampirkan hasilnya ke GitHub Release `android-terbaru`:

- `negeri-wkwk-coba.apk`: build debug, langsung bisa dipasang untuk mencoba.
- `negeri-wkwk-1.0.N.aab` dan `.apk`: build rilis bertanda tangan kunci unggah. Hanya dibuat kalau secret `WKWK_STORE_PASSWORD` sudah diisi di Settings > Secrets and variables > Actions. File `.aab` yang diunggah ke Play Console.

Kunci unggah ada di `web3d/android/kunci-unggah.p12` (PKCS12, alias `upload`), dilindungi password acak yang hanya ada di secret tadi dan di catatan pemilik repo. Ikon dan splash dibuat dari `web3d/assets/` dengan `npx @capacitor/assets generate --android`.
