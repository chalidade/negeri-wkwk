# Checklist rilis ke Google Play dan App Store

Urutan yang disarankan: Android dulu (lebih murah, nggak butuh Mac), iOS menyusul.

## 0. Sekali saja: bungkus klien web jadi aplikasi (Capacitor)

Klien game ada di `web3d/` (Three.js + Vite). Untuk masuk toko aplikasi, hasil build web dibungkus Capacitor.
**Langkah ini belum dikerjakan di repo**; folder `android/` dan `ios/` belum ada.

```bash
cd web3d
npm i @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npx cap init "Negeri Wkwk" com.negeriwkwk.app --web-dir dist
npm run build
npx cap add android
npx cap add ios        # hanya bisa di Mac
npx cap sync
```

Commit folder `android/` dan `ios/` yang dihasilkan. Setiap habis mengubah kode web: `npm run build && npx cap sync`.

ID aplikasi `com.negeriwkwk.app` tidak bisa diganti setelah rilis, jadi tentukan sekarang.
Ikon dan splash: pakai `@capacitor/assets` dengan gambar 1024x1024 tanpa transparansi.

## 1. Supabase versi produksi

- [ ] Jalankan `supabase db push` dan deploy semua function (lihat README).
- [ ] Authentication > Sign In / Providers: aktifkan **Allow anonymous sign-ins**.
- [ ] Aktifkan CAPTCHA (hCaptcha/Turnstile) untuk login anonim supaya nggak dibanjiri akun bot.
- [ ] Upgrade dari free tier sebelum rilis publik: project gratis di-pause kalau 7 hari tidak aktif.

## 2. Dokumen wajib

- [ ] **Kebijakan Privasi** (URL publik). Isi minimal: data yang dikumpulkan (ID akun, nama tampilan, data permainan), untuk apa, berapa lama disimpan, dan cara hapus akun.
- [ ] **Halaman hapus akun** (URL publik). Google Play mewajibkan link web untuk minta hapus akun, selain tombol "Hapus akun" di aplikasi (sudah ada di menu beranda).
- [ ] Disclaimer satire: "Game fiksi, tidak mewakili lembaga, partai, atau tokoh nyata" (sudah ada di layar login; ulangi di deskripsi store).
- [ ] Cek status kewajiban rating **IGRS** di Komdigi sebelum rilis.

## 3. Google Play

1. Daftar Play Console (US$25 sekali bayar).
2. Buat upload key:
   ```bash
   keytool -genkey -v -keystore ~/negeri-wkwk-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
   ```
   Simpan file `.jks` dan passwordnya baik-baik, jangan di-commit.
3. Build: jalankan `npx cap open android`, lalu di Android Studio pilih Build > Generate Signed App Bundle dan pakai upload key tadi. Hasilnya file `.aab`.
4. Di Play Console isi: listing (deskripsi, screenshot, ikon 512x512, feature graphic 1024x500), kuesioner rating konten, target audiens (13+ ke atas), formulir **Data safety**, dan link kebijakan privasi + hapus akun.
5. **Akun pribadi baru wajib closed testing:** minimal 12 tester ikut selama 14 hari berturut-turut sebelum boleh rilis produksi. Ajak teman dan komunitas devlog.
6. Setelah lolos, ajukan akses produksi dan rilis.

## 4. App Store (butuh Mac + Xcode)

1. Daftar Apple Developer Program (US$99 per tahun).
2. Jalankan `npx cap open ios`, pilih Team di Signing & Capabilities, pastikan Bundle Identifier `com.negeriwkwk.app`.
3. Di Xcode: Product > Archive, lalu Distribute App ke App Store Connect.
4. Di App Store Connect: isi App Privacy, age rating, deskripsi, screenshot (iPhone 6,7" dan 6,5"), link kebijakan privasi.
5. Uji lewat TestFlight, lalu kirim review.

Catatan review Apple:
- Login tamu saja tidak butuh Sign in with Apple. Kalau nanti menambah login Google, **wajib** sediakan juga Sign in with Apple atau opsi login lain yang setara.
- Tombol hapus akun di dalam aplikasi sudah ada (wajib sejak 2022).
- Satire politik umumnya diizinkan selama tidak menyerang orang nyata secara personal. Pertahankan aturan tanpa nama, wajah, partai, atau lambang negara asli.

## 5. Nanti, saat jualan Emas Antum

- Wajib pakai Google Play Billing dan Apple In-App Purchase untuk barang digital.
- Validasi struk pembelian di server (Edge Function) sebelum menambah saldo `profiles.emas_antum`.
- Jangan pernah izinkan Emas Antum dicairkan atau ditransfer antar pemain.
