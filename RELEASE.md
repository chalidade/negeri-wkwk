# Checklist rilis ke Google Play dan App Store

Urutan yang disarankan: Android dulu (lebih murah, nggak butuh Mac), iOS menyusul.

## 0. Sekali saja: siapkan project Flutter

Folder `android/` dan `ios/` belum ada di repo. Buat dengan:

```bash
cd app
flutter create . --org com.negeriwkwk --project-name negeri_wkwk --platforms=android,ios
flutter pub get
```

Perintah ini hanya menambah file yang belum ada; `lib/` tidak ditimpa. Commit hasilnya.

Lalu samakan identitas aplikasi:

| Yang diatur | Android | iOS |
| --- | --- | --- |
| ID aplikasi | `applicationId "com.negeriwkwk.app"` di `android/app/build.gradle(.kts)` | Bundle Identifier `com.negeriwkwk.app` di Xcode (Runner > Signing & Capabilities) |
| Nama di layar HP | `android:label="Negeri Wkwk"` di `android/app/src/main/AndroidManifest.xml` | `CFBundleDisplayName` = `Negeri Wkwk` di `ios/Runner/Info.plist` |
| Izin internet | `<uses-permission android:name="android.permission.INTERNET"/>` di AndroidManifest utama | sudah otomatis |

ID aplikasi tidak bisa diganti setelah rilis, jadi tentukan sekarang.

Ikon aplikasi: pakai package `flutter_launcher_icons` dengan gambar 1024x1024 tanpa transparansi.

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
   Simpan file `.jks` dan passwordnya baik-baik, jangan di-commit. Ikuti panduan resmi Flutter "Build and release an Android app" untuk `key.properties` dan `signingConfigs`.
3. Build:
   ```bash
   cd app
   flutter build appbundle --release --dart-define-from-file=env.json
   ```
   Hasil: `build/app/outputs/bundle/release/app-release.aab`.
4. Di Play Console isi: listing (deskripsi, screenshot, ikon 512x512, feature graphic 1024x500), kuesioner rating konten, target audiens (13+ ke atas), formulir **Data safety**, dan link kebijakan privasi + hapus akun.
5. **Akun pribadi baru wajib closed testing:** minimal 12 tester ikut selama 14 hari berturut-turut sebelum boleh rilis produksi. Ajak teman dan komunitas devlog.
6. Setelah lolos, ajukan akses produksi dan rilis.

## 4. App Store (butuh Mac + Xcode)

1. Daftar Apple Developer Program (US$99 per tahun).
2. Buka `app/ios/Runner.xcworkspace` di Xcode, pilih Team di Signing & Capabilities, set Bundle Identifier.
3. Build dan upload:
   ```bash
   cd app
   flutter build ipa --release --dart-define-from-file=env.json
   ```
   Upload `build/ios/ipa/*.ipa` lewat aplikasi Transporter atau Xcode Organizer.
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
