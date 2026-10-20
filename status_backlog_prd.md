# Status Product Backlog PRD

**Acuan:** [prd.md](prd.md), bagian 10 (Product Backlog & Sprint Breakdown)
**Kode:** [backend/](backend/README.md) dan [frontend/](frontend/README.md)
**Tanggal cek:** 18 Oktober 2026 (diperbarui 19 Oktober 2026, malam)

> **Semua pekerjaan yang belum dilakukan ada di file ini.** Mulai dari [Daftar tindakan yang butuh tim](#daftar-tindakan-yang-butuh-tim-ringkasan). Detailnya: [Lampiran 1](#lampiran-1-sisa-pekerjaan-dari-rencana-desain-stitch) (sisa rencana desain Stitch: konflik, perubahan backend, integrasi, aset), [Lampiran 2](#lampiran-2-keputusan-dari-review-flowchart-booking) (keputusan dari review flowchart), [Lampiran 3](#lampiran-3-checklist-verifikasi-manual-portal-owner--admin) (checklist verifikasi manual).

---

## Ringkasan

| Status | Jumlah | PBI |
|---|---|---|
| ✅ Selesai & terverifikasi | 24 | Semua PBI selain yang di bawah |
| ⚠️ Selesai dengan catatan | 2 | **103**, **106** |
| ❌ Belum selesai | 1 | **407** |

Total ada **27 PBI** (Sprint 1: 8, Sprint 2: 6, Sprint 3: 6, Sprint 4: 7). PBI-306 (k6 stress test) sudah **dijalankan dan lolos** hari ini. Detailnya ada di bagian [Hasil PBI-306](#hasil-pbi-306-k6-stress-test).

---

## Daftar tindakan yang butuh tim (ringkasan)

Satu tempat untuk semua hal yang **tidak bisa diselesaikan tanpa tim**, dengan tautan ke detailnya. Diperbarui 20 Oktober 2026 (setelah Paket A & B backend).

| # | Perlu dari tim | Jenis | Detail |
|---|---|---|---|
| 1 | Google Cloud OAuth Client ID untuk login Google | Akun | [PBI-106](#pbi-106-google-oauth-20), [Pekerjaan siap dikerjakan A](#pekerjaan-siap-dikerjakan-butuh-tindakan-tim) |
| 2 | ~~Isi SMTP Gmail + App Password~~ ✅ selesai 20 Okt, email pengingat terkirim | Akun | [PBI-404](#pbi-404-cron-pengingat-email) |
| 3 | Deploy gratis: akun GitHub, Supabase, Render, Vercel, Google Cloud (Gmail API), cron-job.org. Kode & panduan ✅ siap 20 Okt: [docs/deploy-gratis.md](docs/deploy-gratis.md) | Akun & infrastruktur | [PBI-407 B](#b-deploy-frontend-ke-vercel) |
| 4 | Izin & lingkungan uji untuk pen-test OWASP ZAP | Izin | [Pekerjaan siap dikerjakan B](#pekerjaan-siap-dikerjakan-butuh-tindakan-tim) |
| 5 | Keputusan sistem pembayaran: bayar tunai, payment gateway, wajib bayar dulu (RRN/nama pengirim ✅ 20 Okt) | Keputusan + backend | [Catatan sistem pembayaran](#catatan-sistem-pembayaran-pbi-401--pbi-402) |
| 6 | Set `TRUST_PROXY` sesuai jumlah proxy di produksi (kodenya sudah ada) | Konfigurasi | [Temuan nomor 2](#temuan-selama-pengujian) |
| 7 | Sisa perubahan backend desain Stitch yang **butuh keputusan/konten**: BE-3 kategori layanan (daftar kategori), BE-5 tahan slot + bayar dulu (12.2), BE-6 pit (12.3), BE-7 lacak mekanik live, BE-10 add-on, BE-11 promo, BE-12 komisi (12.4), BE-17 dokumen mitra; sebagian BE-2 (fasilitas, sertifikasi, kota). ✅ Sudah 20 Okt: BE-1, BE-4, BE-8, BE-9 (kategori), BE-13, BE-14, BE-16, foto & jadwal dari BE-2, dan BE-lain (invoice/RRN, alasan batal, pilih mekanik, reschedule, statistik, riwayat status, kisaran/ubah harga SOS, notifikasi server, hapus layanan, balas ulasan) | Keputusan + backend | [Paket A](#paket-a-backend-20-oktober-2026-frontend-tidak-diubah), [Paket B](#paket-b-backend-20-oktober-2026-frontend-tidak-diubah), [bagian 13](#13-daftar-perubahan-backend-gabungan) |
| 8 | ~~Bug skema PATCH layanan/mekanik~~ ✅ diperbaiki di backend 20 Okt (Paket A) | Backend | [Paket A](#paket-a-backend-20-oktober-2026-frontend-tidak-diubah) |
| 9 | Integrasi pihak ketiga (VA, OCR, geocoding, ETA, wallet pass, OTP WA) | Integrasi | [Lampiran 1, bagian 14](#14-integrasi-pihak-ketiga-int) |
| 10 | Konten asli: logo, foto bengkel/mekanik, nomor hotline & WA CS, FAQ resmi, S&K, kebijakan privasi/pembatalan/garansi, daftar kota | Konten | [Lampiran 1, Lampiran A](#lampiran-a-aset-yang-harus-disiapkan-tim) |
| 11 | Keputusan desain/bisnis: warna primer & SOS di PRD 3.1, alur bayar (12.2), slot per jam (12.3), komisi 5% (12.4), klaim marketing (12.5) | Keputusan | [Lampiran 1, bagian 12](#12-konflik-yang-harus-diputuskan-tim); catatan di [prd.md](prd.md) 3.1 |
| 12 | Fitur sparepart masuk cakupan atau tidak | Keputusan + backend | [Lampiran 2](#lampiran-2-keputusan-dari-review-flowchart-booking) |
| 13 | Transaction manager: terima pendekatan helper atau minta middleware | Keputusan | [PBI-103](#pbi-103-transaction-manager-middlewares) |
| 14 | Aktifkan lagi bengkel uji "Bengkel Uji Desain Stitch" bila masih dipakai (sekarang dinonaktifkan admin) | Data uji | Portal admin → Persetujuan Mitra |
| 15 | ~~Dua temuan backend 19 Okt (penugasan mekanik vs SOS, refund pesanan lunas)~~ ✅ diperbaiki 20 Okt atas persetujuan tim | Backend | [Temuan nomor 4–5](#temuan-selama-pengujian) |
| 16 | Potong otomatis QRIS: boleh dipotong ke kode QR saja (nama merchant & NMID bisa ikut terpotong) atau tetap gambar utuh | Keputusan | [Unggah foto](#unggah-foto-kondisi--rencana-perbaikan) |

**Sudah dikerjakan tanpa tim (19 Okt 2026, frontend saja, backend tidak diubah):** ubah layanan lengkap (nama/deskripsi/harga/durasi), cek + kompres foto sebelum unggah, pesan error berbahasa Indonesia, alur login Google PKCE (tombol tersembunyi sampai Client ID diisi), tes lintas browser (WebKit/Safari desktop & iPhone), tes tata letak 375px untuk semua portal. Rinciannya di [Pekerjaan frontend 19 Oktober](#pekerjaan-frontend-19-oktober-2026-tanpa-mengubah-backend).

**Backend 20 Okt (Paket A & B, frontend tidak diubah):** lihat [Paket B](#paket-b-backend-20-oktober-2026-frontend-tidak-diubah) dan [Paket A](#paket-a-backend-20-oktober-2026-frontend-tidak-diubah). ERD: [docs/erd.md](docs/erd.md).

**Tahap 20 Okt 2026 (semua yang bisa dikerjakan tanpa tim):** ✅ selesai, lihat [Tahap 20 Oktober](#tahap-20-oktober-2026-frontend-paket-a--b-aksesibilitas-bundle-visual-regression-akses-admin-pengingat-h-2).

**Yang tersisa tanpa tim:** tidak ada lagi. Sisanya butuh akun, izin, keputusan, atau konten (tabel di atas).

**Tidak bisa diselesaikan di laptop ini:** tes Firefox (build Firefox Playwright gagal dijalankan, masalah runtime Windows).

---

## Status semua PBI

| PBI | Isi | Status |
|---|---|---|
| 101 | Template Express TS berlapis | ✅ |
| 102 | Docker Compose PostGIS, Redis, NGINX | ✅ |
| 103 | Migrasi, indeks, Transaction Manager | ⚠️ [lihat catatan](#pbi-103-transaction-manager-middlewares) |
| 104 | Rate limit Redis sliding window + Helmet | ✅ |
| 105 | JWT + refresh token rotation | ✅ |
| 106 | Google OAuth 2.0 | ⚠️ [lihat catatan](#pbi-106-google-oauth-20) |
| 107 | Guest session | ✅ |
| 108 | Setup React TS + token warna Traveloka | ✅ |
| 201 | Scan radius 5 km `ST_DWithin` | ✅ |
| 202 | Smart auto-routing (jarak + rating mekanik) | ✅ |
| 203 | Request emergency dalam transaksi | ✅ |
| 204 | Bengkel terima/tolak emergency | ✅ |
| 205 | Fallback re-routing 2 menit | ✅ |
| 206 | Test spatial & rollback | ✅ |
| 301 | Profil bengkel + map picker | ✅ |
| 302 | CRUD mekanik + tag keahlian | ✅ |
| 303 | Kuota per jam dengan `FOR UPDATE` | ✅ |
| 304 | Nomor antrean + `IN_QUEUE` | ✅ |
| 305 | Auto-assign mekanik | ✅ |
| 306 | k6 stress test booking | ✅ [hasil](#hasil-pbi-306-k6-stress-test) |
| 401 | QRIS statis + upload bukti bayar | ✅ |
| 402 | Verifikasi pembayaran | ✅ |
| 403 | Review + rating mekanik dinamis | ✅ |
| 404 | Cron pengingat email H-1 (+ H-2 jam) | ✅ email asli terkirim via Gmail 20 Okt [catatan](#pbi-404-cron-pengingat-email) |
| 405 | Approval bengkel oleh admin | ✅ |
| 406 | Laporan transaksi | ✅ |
| 407 | E2E Playwright/Cypress + deploy Vercel | ⚠️ E2E ✅, deploy belum [lihat catatan](#pbi-407-e2e-testing--deploy-vercel) |

---

## Catatan per PBI

### PBI-103: Transaction Manager Middlewares

**Yang sudah ada:** migrasi SQL, semua indeks dari PRD 6.3, dan transaction manager `withTransaction()` di [backend/src/common/db/transaction.ts](backend/src/common/db/transaction.ts). Semua operasi multi-tabel memakai helper ini, dan rollback-nya sudah dites.

**Catatannya:** PRD menyebut "Transaction Manager **Middlewares**". Yang dibuat adalah **helper yang dipanggil dari service**, bukan middleware Express. Alasannya:
- Middleware akan membuka transaksi untuk seluruh request (termasuk validasi dan upload file), sehingga koneksi database tertahan lebih lama dan lebih cepat habis saat traffic tinggi.
- Dengan helper, transaksi hanya membungkus bagian yang benar-benar menulis ke database. Lock `FOR UPDATE` juga dilepas secepat mungkin.

**Yang perlu diputuskan tim:**
- [ ] Terima pendekatan helper dan ubah kata "Middlewares" di PRD menjadi "Transaction Manager". **Disarankan**, karena tidak perlu ubah kode.
- [ ] Atau tetap minta versi middleware (kode perlu diubah, dan hasilnya kurang efisien).

---

### PBI-106: Google OAuth 2.0

**Yang sudah ada:**
- Backend `POST /auth/google` dengan Authorization Code + PKCE. Email yang belum terdaftar otomatis dibuat sebagai CUSTOMER, sedangkan email yang sudah ada di-link ke akun Google.
- Sudah dites otomatis dengan respons Google tiruan (mock).

**Yang belum:**
1. **Belum pernah dicoba dengan akun Google asli**, karena Google Client ID belum ada.
2. ~~Tombol "Masuk dengan Google" di frontend masih placeholder.~~ **✅ 19 Okt 2026:** alur PKCE frontend sudah dibuat (`frontend/src/services/auth/googleOAuth.ts` + halaman `/auth/google/callback`). Tombol hanya tampil kalau `VITE_GOOGLE_CLIENT_ID` diisi. Sudah dites dengan vektor uji RFC 7636 dan pengecekan `state` (anti-CSRF); belum dites dengan Google asli.

**Langkah menyelesaikan:**
1. Buat OAuth Client (tipe *Web application*) di [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
   - Authorized redirect URI: `http://localhost:5173/auth/google/callback`, ditambah URL Vercel saat deploy.
2. Isi `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, dan `GOOGLE_REDIRECT_URI` di `backend/.env`.
3. Di frontend, buat alur PKCE:
   - buat `code_verifier` dan hitung `code_challenge`;
   - redirect ke Google;
   - buat halaman `/auth/google/callback` yang mengirim `code` + `code_verifier` ke `POST /auth/google`.

   Fungsi `authApi.google()` sudah tersedia di `services/api/endpoints.ts`.
4. Uji tiga skenario: email baru (harus jadi CUSTOMER), email yang sudah terdaftar via form (harus ter-link), dan login kedua kali.

**Butuh dari tim:** akun Google Cloud untuk membuat Client ID.

---

### PBI-404: Cron pengingat email

**Yang sudah ada:**
- Cron pengingat H-1 untuk booking `CONFIRMED` **besok** (`reminder_sent`), dicek **tiap jam 08:00–20:00 WIB** sejak 20 Okt (`REMINDER_CRON=0 8-20 * * *`; sebelumnya hanya 08:00, sehingga booking yang dibuat setelah jam 08:00 untuk besok tidak pernah mendapat H-1), dan sejak 20 Okt juga pengingat **±2 jam sebelum jadwal** (cek tiap 5 menit, `reminder_2h_sent`). Keduanya aman untuk beberapa replica; kalau email gagal, booking dikembalikan ke antrean kirim.
- Keduanya juga membuat **notifikasi di aplikasi**, yang sudah berfungsi tanpa SMTP.
- Perintah kirim seketika (tanpa menunggu cron): `npm run reminders:run` (lokal) atau `docker compose exec api node dist/jobs/run-reminders.js` (Docker). Setiap booking hanya diingatkan sekali, jadi menjalankannya dua kali tidak mengirim ulang.

**✅ Selesai 20 Okt 2026:** SMTP Gmail + App Password diisi di `backend/.env`; email pengingat H-1 sungguhan terkirim dan masuk **kotak masuk** (bukan spam) dengan pengirim "BengkelGo" (uji lewat `run-reminders.js`).

**Template email profesional (20 Okt):** `backend/src/features/booking/booking.email.ts` membuat email HTML (tabel + gaya inline, tampil baik di Gmail/Outlook/HP) plus versi teks biasa untuk H-1 dan H-2: header BengkelGo, kotak tanggal ("Rabu, 21 Oktober 2026 · Pukul 08:00 WIB"), rincian bengkel/alamat/layanan/antrean/nomor pesanan/telepon, tombol **Lihat detail booking** (`APP_URL/orders/:id`), tautan **Petunjuk arah** (Google Maps), tips, dan footer. Subjek: "Pengingat: servis besok, Rabu, 21 Oktober 2026 pukul 08:00 WIB" / "Servis Anda hari ini pukul 13:45 WIB di …". **Saat deploy, isi `APP_URL`** di `backend/.env` dengan alamat web asli (default `http://localhost:5173`).

**Email booking otomatis (20 Okt), di luar pengingat:** dikirim langsung setelah transaksi database berhasil (tidak terkirim bila booking gagal/rollback, dan tidak memperlambat respons API; mekanisme `afterCommit` di `common/db/transaction.ts`):
- **Booking terkonfirmasi**: saat booking dibuat dan slot tersedia.
- **Masuk daftar tunggu** (dengan posisi): saat slot penuh.
- **Naik dari daftar tunggu**: saat ada pembatalan/kapasitas ditambah dan booking dipromosikan.
- **Jadwal diubah**: setelah reschedule (pengingat H-1/H-2 ikut di-reset ke jadwal baru).
- Kalau gagal kirim (mis. DNS/SMTP sesaat bermasalah), dicoba ulang otomatis setelah 15 detik, 1 menit, dan 5 menit. Batasan: percobaan ulang disimpan di memori, jadi hilang bila API restart di tengah jalan (antrean email di database = perbaikan berikutnya bila perlu).
- Belum ada email untuk pembatalan, pembayaran diverifikasi, atau order selesai (notifikasi di aplikasi sudah ada). Diuji di `tests/integration/booking-email.int.test.ts`.

**Tidak perlu `docker exec` untuk operasi normal:** selama container jalan (`ENABLE_CRON=true`), cron mengirim sendiri (H-1 dicek tiap jam 08:00–20:00 WIB, H-2 tiap 5 menit, email booking langsung saat kejadian). `run-reminders.js` hanya untuk uji seketika. Container `db`/`redis`/`api`/`nginx` memakai `restart: unless-stopped`, jadi otomatis hidup lagi saat Docker Desktop menyala; aktifkan "Start Docker Desktop when you sign in" agar jalan setelah laptop dinyalakan.

**Tes tidak mengirim email sungguhan:** `tests/setup-env.ts` mengosongkan `SMTP_*` (sebelumnya tes integrasi memakai SMTP dari `.env` dan mengirim ke alamat tes palsu, sehingga muncul email pantulan "Address not found" di Gmail pengirim pada 20 Okt; aman dihapus).

**Keputusan 20 Okt: pakai Gmail + App Password** (gratis, ±500 email/hari, cukup untuk tahap awal). Pindah ke Brevo + domain sendiri setelah punya domain (lihat catatan di bawah).

**Langkah (dikerjakan pemilik akun Gmail, ±5 menit):**
1. Login ke akun Google yang akan menjadi pengirim.
2. Aktifkan **Verifikasi 2 Langkah** (Akun Google → Keamanan). App Password hanya muncul kalau ini aktif.
3. Buka https://myaccount.google.com/apppasswords, buat App Password bernama "BengkelGo", salin 16 hurufnya.
4. Isi `backend/.env` (App Password **tanpa spasi**; alamat di `MAIL_FROM` **harus sama** dengan `SMTP_USER`, Gmail menolak alamat lain):
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=alamatanda@gmail.com
   SMTP_PASS=abcdefghijklmnop
   MAIL_FROM="BengkelGo <alamatanda@gmail.com>"
   ```
5. Terapkan: di folder `backend` jalankan `docker compose up -d` (**bukan** `restart`, agar `.env` dibaca ulang), atau hentikan dan jalankan lagi `npm run dev`.
6. Uji: buat booking **untuk besok** dengan akun pelanggan yang emailnya asli, lalu jalankan `docker compose exec api node dist/jobs/run-reminders.js`. Output harus `Day-before reminders: 1 sent, 0 failed` dan baris pertama menyebut `SMTP: smtp.gmail.com`. Cek kotak masuk **dan folder spam** (coba juga penerima Yahoo/Outlook); kalau masuk spam, tandai "Bukan spam".

**Keamanan:** `backend/.env` berisi App Password (setara kata sandi email): jangan dibagikan atau di-commit. Kalau bocor, hapus App Password itu di halaman yang sama dan buat baru.

**Catatan pengiriman (spam):** Gmail + App Password umumnya masuk kotak masuk karena dikirim server Google sendiri. **Jangan** memakai Brevo dengan alamat `@gmail.com` sebagai pengirim (sering masuk spam/ditolak karena DMARC Gmail). Untuk produksi: Brevo (gratis ±300 email/hari) dengan **autentikasi domain** (catatan DKIM/SPF/DMARC di DNS domain sendiri), pengirim mis. `no-reply@domainanda`. Kuota layanan bisa berubah; cek halaman harga masing-masing.

**Catatan desain:** akun **tamu (GUEST) tidak punya email**, jadi hanya menerima notifikasi di aplikasi. Kalau nanti dibutuhkan, pengingat bisa ditambahkan lewat WhatsApp.

**Butuh dari tim:** tidak ada lagi. Batas Gmail ±500 email/hari (gratis, tidak pernah ditagih; bila terlampaui, pengiriman ditolak sementara ±24 jam dan notifikasi di aplikasi tetap jalan). Pindah ke Brevo + domain sendiri setelah volume mendekati batas atau saat punya domain.

---

### PBI-407: E2E Testing & deploy Vercel

PBI ini terdiri dari dua bagian. Keduanya belum selesai.

#### A. Suite E2E otomatis (Playwright / Cypress)

**Yang sudah dilakukan:** seluruh alur sudah dijalankan **manual** di browser terhadap backend sungguhan:
1. Daftar bengkel, approval admin, lalu owner mengatur layanan, mekanik, dan QRIS.
2. Tamu menekan SOS, owner menerima, dan mekanik ditugaskan.
3. Pelanggan booking, upload bukti bayar, owner memverifikasi, order diselesaikan, lalu pelanggan memberi ulasan.

Pengujian ini menemukan 2 bug di frontend, dan keduanya sudah diperbaiki.

**Update 19 Okt 2026: ✅ selesai.** Suite Playwright di `frontend/e2e/` (`npm run test:e2e`) menjalankan kedua journey di bawah terhadap backend sungguhan dan lolos (beserta 14 pemeriksaan aksesibilitas axe dan 17 test komponen Vitest). Yang tersisa dari PBI-407 hanya bagian B (deploy).

~~**Yang belum:** test otomatis yang bisa diulang (Playwright), sesuai dua *user journey* di PRD 8.2:~~
1. Customer Guest Order Emergency → Payment Upload → Workshop Accept
2. Owner Workshop Register → Admin Approval → Quota Configuration

**Saran:** tulis test Playwright **setelah desain final masuk**. Test E2E bergantung pada tampilan (tombol, teks, susunan halaman), jadi kalau ditulis sekarang, harus ditulis ulang saat desain berganti. Gunakan atribut `data-testid` pada desain final supaya test tidak mudah rusak.

#### B. Deploy frontend ke Vercel

**Yang belum:** belum ada yang di-deploy. Hal yang perlu disiapkan:

1. **Backend harus online dulu, dengan HTTPS.** Frontend di Vercel tidak bisa memanggil `localhost`. Pilihannya:
   - database di **Supabase** (aktifkan extension `postgis`, isi `DATABASE_URL`, `DATABASE_SSL=true`);
   - API (Docker) di VPS / cloud, dengan TLS di NGINX atau Cloudflare. Konfigurasi NGINX sekarang baru port 80.
2. **Pengaturan backend untuk produksi:**
   - `CORS_ORIGINS` = URL Vercel;
   - `COOKIE_SECURE=true`;
   - `COOKIE_SAMESITE=none` kalau domain frontend dan API berbeda situs;
   - secret JWT yang baru (jangan pakai contoh di `.env.example`).
3. **Pengaturan frontend di Vercel:**
   - Environment variable `VITE_API_URL` = URL API publik (misalnya `https://api.bengkelapp.com/api/v1`).
   - ✅ **File `vercel.json` dengan aturan rewrite SPA** sudah dibuat (19 Okt 2026) di `frontend/vercel.json`: semua URL non-aset diarahkan ke `index.html`, aset `/assets/*` di-cache 1 tahun. Saat import proyek di Vercel, set *Root Directory* = `frontend`.

**✅ Disiapkan 20 Okt: jalur deploy gratis tanpa kartu kredit** (keputusan: tidak ada kartu untuk Oracle Cloud). Susunan: Vercel (frontend) → proxy `/api/*` → Render Free (API Docker, `render.yaml`) → Supabase (database + Storage) + Gmail API; cron-job.org mem-ping `/health` tiap 10 menit. Panduan lengkap langkah demi langkah: **[docs/deploy-gratis.md](docs/deploy-gratis.md)**. Perubahan kode (tanpa perubahan database):
- `STORAGE_DRIVER=supabase`: upload ke bucket private Supabase Storage (`common/utils/storage.ts`), file tetap disajikan lewat API dengan cek akses yang sama.
- Email lewat **Gmail API** (HTTPS) bila `GMAIL_REFRESH_TOKEN` diisi, karena Render Free memblokir port SMTP sejak Sept 2025 (`config/mailer.ts`). SMTP tetap dipakai di laptop.
- `frontend/vercel.json`: `/api/*` diteruskan ke `https://bengkelgo-api.onrender.com` agar cookie login satu situs (Safari tidak memblokir); ganti alamat ini bila nama layanan Render berbeda.
- Halaman admin **Kesehatan sistem** menampilkan "IP Anda menurut server" untuk memastikan `TRUST_PROXY` (default `2` di Render) benar.
- `.gitignore` di folder utama (proyek belum memakai Git; Render/Vercel butuh repo GitHub).
- Diuji: backend 99/99 (termasuk tes driver Gmail API & Supabase Storage dengan respons tiruan), Vitest 40/40, E2E journeys + fitur backlog + a11y login lolos. **Belum** diuji terhadap Supabase/Render/Google asli (butuh akun).
- Perbaikan a11y ikut ditemukan: baris pengguna nonaktif di `/admin/users` tidak lagi memakai `opacity-60` (kontras teks gagal WCAG).

**Catatan hosting API (20 Okt):** backend **tidak cocok di Vercel** (Vercel = serverless: cron `node-cron`, folder upload lokal, dan koneksi Redis/Postgres yang terus terbuka tidak berjalan di sana). Vercel hanya untuk frontend. API butuh server yang terus menyala (VPS, Railway, Render berbayar, Fly.io, dsb.) plus:
- **Redis** (rate limiter): container sendiri, atau Upstash (`REDIS_URL`).
- **Folder upload** (bukti bayar, QRIS, foto) harus di disk permanen (volume), atau dipindah ke Supabase Storage (butuh perubahan kode).
- **SMTP**: sebagian layanan (mis. paket gratis tertentu) memblokir port 587/465 keluar; cek dulu, atau pakai Brevo via API/port lain.
- Isi `APP_URL` = URL Vercel agar tombol di email mengarah ke web asli; tambahkan URL Vercel ke Google OAuth redirect URI.
- Supabase: aktifkan extension `postgis`, jalankan migrasi 001–005 (otomatis dengan `RUN_MIGRATIONS_ON_BOOT=true`).

**Butuh dari tim:** akun Vercel, akun Supabase, server untuk API, dan domain.

---

## Catatan sistem pembayaran (PBI-401 & PBI-402)

Dicatat 19 Oktober 2026. Alur ini sudah berjalan dan sudah diuji end-to-end (tes Playwright: tamu bayar → bengkel verifikasi → lunas).

**Alur saat ini:**
1. Harga harus ada dulu. Booking memakai harga layanan; SOS memakai harga yang diisi owner saat menerima panggilan atau saat menandai selesai. Sebelum ada harga, tombol "Bayar Sekarang" tidak muncul.
2. Pelanggan scan **QRIS milik bengkel**, lalu mengunggah screenshot bukti transfer. Status pembayaran menjadi **Menunggu verifikasi**.
3. Owner mendapat pemberitahuan (notifikasi "Bukti bayar masuk", badge menu Verifikasi Pembayaran, bunyi).
4. Owner **mengecek mutasi asli** di aplikasi merchant QRIS / rekening bengkel: ada uang masuk dengan nominal yang sama di sekitar jam unggah bukti.
5. Owner memilih **Verifikasi Lunas** (status Lunas, pelanggan dinotifikasi, e-receipt tertulis Lunas) atau **Minta Unggah Ulang** dengan alasan.

**Batasan yang perlu dipahami tim:**
- **Uang langsung masuk ke QRIS bengkel**, tidak lewat BengkelGo. Platform tidak memegang uang dan tidak memotong komisi.
- **Verifikasinya manual.** Sistem tidak bisa membaca mutasi bank otomatis; itu butuh payment gateway seperti Midtrans atau Xendit.
- **Screenshot bisa dipalsukan.** Karena itu owner wajib mencocokkan dengan mutasi asli, jangan hanya percaya gambar bukti.
- **Kalau dua pelanggan membayar nominal sama di waktu berdekatan**, owner harus mencocokkannya lewat jam dan nama. Pelanggan belum bisa mengisi nomor referensi (RRN) atau nama pengirim, karena kolomnya belum ada di backend (sudah tercatat sebagai item BE di [Lampiran 1, bagian 13 "BE-lain"](#13-daftar-perubahan-backend-gabungan)).
- **Bayar tunai di bengkel belum didukung.** Di aplikasi, pembayaran hanya bisa ditandai lunas lewat unggah bukti QRIS. Kalau pelanggan bayar tunai, status pembayarannya tetap "Belum bayar", walaupun owner tetap bisa menandai pesanan selesai.
- **Pembayaran booking tidak diwajibkan sebelum datang.** Pelanggan bisa bayar sebelum datang atau setelah servis. Alur "bayar dulu baru slot dikunci" seperti di desain Stitch butuh perubahan backend (catatan [12.2](#122-alur-bayar-sebelum-atau-sesudah-konfirmasi) di Lampiran 1).

**Keputusan yang dibutuhkan tim (semuanya mengubah backend):**
- [ ] Tambah kolom nomor referensi (RRN) dan nama pengirim di `transactions` agar pencocokan lebih mudah.
- [ ] Dukung metode bayar tunai (`transactions.method` = `QRIS`/`CASH`) yang bisa ditandai lunas oleh owner.
- [ ] Integrasi payment gateway (verifikasi otomatis, Virtual Account, komisi platform), atau tetap QRIS statis milik bengkel.
- [ ] Wajib bayar sebelum slot dikunci (alur Stitch) atau tetap seperti sekarang.

---

## Unggah foto: kondisi & rencana perbaikan

Berlaku untuk unggah **QRIS bengkel** (Pengaturan Bengkel) dan **bukti bayar** pelanggan. Dicatat 19 Oktober 2026.

**Kondisi sekarang:**
- **Larangan video sudah ada**, dua lapis:
  1. Pemilih file di frontend (`accept="image/jpeg,image/png,image/webp"`) hanya menampilkan gambar.
  2. Backend (`backend/src/common/middlewares/upload.ts`) memeriksa MIME, membaca isi file (*magic bytes*), dan membatasi ukuran 2 MB. Video, PDF, atau file yang diganti nama jadi `.jpg` pasti ditolak.
- **Kekurangannya:**
  - Di kotak bukti bayar, file bisa di-*drag & drop* sehingga melewati penyaring pemilih file. Video baru ditolak **setelah selesai terunggah** ke server.
  - Pesan error tampil **berbahasa Inggris** karena frontend menampilkan pesan backend apa adanya (*"Only JPEG, PNG or WEBP images are allowed"*, *"File exceeds 2MB limit"*, *"Too many requests, please try again later"*).
- **Belum ada konversi/olah foto:**
  - Foto kamera HP > 2 MB ditolak (foto HP modern sering 3–5 MB).
  - Foto HEIC dari iPhone ditolak.
  - Screenshot QRIS tersimpan utuh satu layar (tidak dipotong ke kode QR), sehingga di halaman bayar QR tampil kecil.

**Rencana perbaikan (frontend saja, tanpa mengubah backend):**
- [x] **Cek file di browser sebelum unggah** (19 Okt): video/PDF/non-gambar dan file yang diganti nama (dicek dari isi file) ditolak dengan pesan berbahasa Indonesia, termasuk lewat drag & drop. `frontend/src/utils/imageUpload.ts`.
- [x] **Kompres foto otomatis** (19 Okt): foto > 2 MB diperkecil (maks. 1600 px, QRIS 2000 px) dan disimpan sebagai JPG < 2 MB, dengan pratinjau. Foto kecil dikirim apa adanya agar kode QR tetap tajam. Diuji E2E: PNG ±3 MB diperkecil lalu diterima API.
- [x] **Terjemahkan kode error backend** (19 Okt): semua kode error backend + pesan validasi umum (WA, plat, password) di `frontend/src/services/api/errorMessages.ts`. Kode yang belum dikenal tetap memakai pesan backend.
- [ ] **Potong otomatis QRIS** (belum, menunggu keputusan tim): deteksi letak kode QR (library kecil seperti `jsQR`, ±45 KB, hanya dimuat di Pengaturan Bengkel), potong dengan margin, baca ulang untuk memastikan isinya QRIS valid (diawali `000201`), tampilkan pratinjau, dan sediakan opsi "Pakai gambar asli" / potong manual. **Perlu keputusan:** pemotongan bisa menghilangkan nama merchant & NMID yang tercetak di stiker QRIS; disarankan margin longgar.

**Batasan:** foto HEIC hanya bisa dikonversi di browser Safari (sudah ditangani: di Safari dikonversi ke JPG, di browser lain muncul pesan berbahasa Indonesia). Di Chrome/Android, pengguna iPhone tetap perlu mengatur kamera ke "Most Compatible" (JPG) atau mengunggah screenshot. Dukungan HEIC penuh butuh konversi di backend.

---

## Hasil PBI-306: k6 stress test

**Tujuan (PRD 8.1):** menembakkan 50–100 request booking bersamaan ke satu slot untuk membuktikan row locking (`FOR UPDATE`) mencegah overbooking.

**Cara uji:**
- Bengkel uji dengan kapasitas **3 booking per jam** dan 3 mekanik.
- 100 akun pelanggan berbeda, masing-masing mengirim 1 request di saat yang sama.
- Backend Docker berjalan dengan **2 replica API** di belakang NGINX.
- k6 v2.3.0 dijalankan lewat Docker.

| Run | Jalur | Request bersamaan | 201 sukses | CONFIRMED | IN_QUEUE | Error | p95 latensi |
|---|---|---|---|---|---|---|---|
| A | langsung ke 2 replica API | 100 | 100 | **3** | 97 | 0 | 1,56 dtk |
| B | lewat NGINX (load balancer) | 50 | 50 | **3** | 47 | 0 | 0,71 dtk |
| C | lewat NGINX | 100 | 62 | **3** | 59 | 38 × 503 dari NGINX* | 0,83 dtk |
| D | lewat NGINX, **setelah perbaikan temuan 2** | 100 | 61 | **3** | 58 | 39 × **429** dari NGINX* | – |

\*Semua request datang dari satu IP (mesin k6), jadi batas NGINX per IP ikut aktif. Lihat temuan nomor 2.

**Verifikasi langsung ke database** (`tests/load/booking-concurrency.setup.ts verify`):

```
slot 10:00: bookings=100 CONFIRMED=3 IN_QUEUE=97 quota=3/3 distinct_mechanics=3
slot 11:00: bookings=50  CONFIRMED=3 IN_QUEUE=47 quota=3/3 distinct_mechanics=3
slot 12:00: bookings=62  CONFIRMED=3 IN_QUEUE=59 quota=3/3 distinct_mechanics=3
slot 13:00: bookings=61  CONFIRMED=3 IN_QUEUE=58 quota=3/3 distinct_mechanics=3
queue numbers for the day: 273 issued, unique & gap-free=true
RESULT: PASS (zero overbooking)
```

**Kesimpulan:** ✅ **Tidak ada overbooking** di semua skenario. Request tersebar ke kedua replica (76 vs 74), jadi penguncian terbukti berlaku lintas server. Nomor antrean unik dan berurutan, dan tidak ada mekanik yang dobel di satu slot.

**Cara mengulang:**
```bash
cd backend
npx ts-node tests/load/booking-concurrency.setup.ts prepare 100
# jalankan k6 (lihat komentar di tests/load/booking-concurrency.k6.js), lalu:
npx ts-node tests/load/booking-concurrency.setup.ts verify 10:00
```

---

## Temuan selama pengujian

| # | Temuan | Status |
|---|---|---|
| 1 | Peringatan library `pg` soal zona waktu | ✅ Diperbaiki 18 Okt 2026 |
| 2 | NGINX membalas 503, bukan 429 | ✅ Diperbaiki 18 Okt 2026 (catatan IP bersama masih terbuka) |
| 3 | Latensi naik saat banyak orang memesan slot yang sama | ℹ️ Perilaku yang disengaja, bukan bug |
| 4 | Penugasan mekanik booking bisa memilih mekanik yang sedang menangani SOS (dan sebaliknya) | ✅ Diperbaiki 20 Okt 2026 |
| 5 | Pesanan lunas yang dibatalkan bengkel tidak punya status refund | ✅ Diperbaiki 20 Okt 2026 (status `REFUNDED`, migrasi 002) |

1. **Peringatan library `pg`** (✅ diperbaiki).
   Saat membuka koneksi baru, backend mengatur zona waktu sesi (`set_config('timezone', …)`) tanpa menunggu hasilnya. Library `pg` versi 8 masih mentoleransi ini (hanya memberi peringatan), tapi **versi 9 akan menolaknya**.
   **Perbaikan yang dilakukan:** pengaturan zona waktu per koneksi dihapus. Keempat query yang mengubah waktu menjadi tanggal (laporan admin, laporan harian, filter tanggal pesanan owner, dan pengingat booking "besok") sekarang menyebut zona waktu bisnis (WIB) secara eksplisit.
   - Cara ini juga tetap benar kalau nanti memakai connection pooler Supabase, yang tidak mempertahankan pengaturan per sesi.
   - Ada test baru yang membuktikan pesanan pukul 01.30 WIB masuk ke tanggal yang benar walaupun database berjalan dalam UTC.
   - Hasilnya: 64/64 test lolos, dan peringatan di log API hilang (0 kemunculan).

2. **Batas NGINX per IP membalas 503, bukan 429** (✅ diperbaiki).
   NGINX membatasi 30 request/detik per IP (burst 60). Ini wajar untuk menahan banjir request. Tapi:
   - Kode yang dikirim `503 Service Unavailable` terbaca sebagai "server rusak". Seharusnya `429 Too Many Requests`. **Perbaikan yang dilakukan:** `limit_req_status 429;` di `backend/nginx/nginx.conf`. Sudah dibuktikan dengan k6 Run D: 39 request yang dibatasi kini menerima 429.
   - **Masih terbuka (keputusan produksi):** banyak pengguna yang berbagi satu IP (jaringan kampus, kantor, atau operator seluler) bisa ikut terkena batas. Ini perlu dipertimbangkan saat produksi, misalnya dengan menaikkan burst atau menyerahkan pembatasan ke Cloudflare.
   - **Ditemukan 19 Okt 2026:** di Docker lokal, limiter aplikasi mencatat semua permintaan dengan IP gateway `172.18.0.1` (key Redis `rl:auth:172.18.0.1`), sehingga semua pengguna lokal berbagi satu kuota login 15×/15 menit dan uji E2E berulang bisa kena *"Too many requests"*.
     **Koreksi (dicek ulang di kode, 19 Okt):** `trust proxy` **sudah aktif** (`app.set('trust proxy', env.TRUST_PROXY)`, default 1) dan NGINX sudah mengirim `X-Forwarded-For`. Di lokal semua request memang datang dari host lewat gateway Docker, jadi IP-nya sama; ini bukan bug kode. Untuk produksi cukup **set `TRUST_PROXY` sesuai jumlah proxy** (mis. 2 kalau Cloudflare + NGINX). Reset manual di lokal: `docker compose exec redis redis-cli DEL rl:auth:172.18.0.1`.

4. **Penugasan mekanik vs tugas SOS** (ditemukan 19 Okt, ✅ diperbaiki 20 Okt).
   Dulu `pickMechanicForSlot()` hanya mengecek booking lain di slot yang sama, sehingga mekanik yang sedang menuju lokasi SOS bisa ikut ditugaskan ke booking. Kebalikannya juga terjadi: dispatch SOS tidak mengecek mekanik yang sedang mengerjakan booking (`IN_PROGRESS`).
   **Perbaikan:** booking **hari ini** tidak diberikan ke mekanik yang punya SOS `ACCEPTED`/`IN_PROGRESS` (booking hari lain tetap boleh, karena tugas SOS selesai dalam hitungan jam). Dispatch SOS dan hitungan "mekanik tersedia" di scan 5 km kini melewati mekanik yang sedang mengerjakan booking. Kalau semua mekanik sibuk, booking tetap `CONFIRMED` tanpa mekanik (perilaku lama). File: `booking.repository.ts`, `emergency.repository.ts`.

5. **Pembatalan pesanan yang sudah lunas** (ditemukan 19 Okt, ✅ diperbaiki 20 Okt).
   Dulu status pembayaran tetap `VERIFIED` setelah pesanan lunas dibatalkan, jadi laporan admin menghitung uang yang sudah dikembalikan sebagai pendapatan.
   **Perbaikan:**
   - Migrasi `002_payment_refund.sql`: nilai status baru `REFUNDED` di `payment_status` + kolom `transactions.refunded_at`, `refunded_by`, `refund_note` (tidak ada tabel baru, data lama tidak berubah).
   - Owner membatalkan pesanan `VERIFIED` → wajib `refund_confirmed: true` (bengkel sudah mengembalikan dana sendiri, karena uang masuk ke QRIS bengkel), opsional `refund_note`; tanpa itu **409** `REFUND_CONFIRMATION_REQUIRED`. Pembayaran menjadi `REFUNDED`.
   - Selama bukti bayar `PENDING_VERIFICATION`, owner maupun pelanggan tidak bisa membatalkan (**409** `PAYMENT_PENDING_VERIFICATION`), supaya tidak ada transfer yang terlewat.
   - Laporan admin: `refunded_amount`, `refunded_payments`; dana yang dikembalikan tidak lagi dihitung sebagai pendapatan.
   - Frontend: dialog "Batalkan pesanan yang sudah lunas?" dengan centang konfirmasi + catatan, label "Dana dikembalikan", info refund + notifikasi untuk pelanggan, KPI/CSV/PDF admin.
   - Tes: `backend/tests/integration/refund-assignment.int.test.ts` (terbukti gagal tanpa perbaikan) + E2E Playwright alur refund.

3. **Latensi booking naik kalau banyak orang memesan slot yang sama.**
   Request ke slot yang sama sengaja diproses **satu per satu** (itulah fungsi lock), sehingga dengan 100 orang bersamaan p95 menjadi 1,56 detik. Ini perilaku yang benar, bukan bug. Booking ke slot atau bengkel yang berbeda tidak saling menunggu.

---

## Di luar backlog: kebutuhan PRD lain yang belum

| Item PRD | Status | Catatan |
|---|---|---|
| Penetration test OWASP ZAP / Burp (PRD 8.1) | ❌ | Bisa dijalankan ke server lokal tanpa mengubah kode. Rencana di [Pekerjaan siap dikerjakan, butuh tindakan tim](#pekerjaan-siap-dikerjakan-butuh-tindakan-tim) poin B |
| Test frontend: component, E2E, visual, cross-browser, aksesibilitas (PRD 8.2) | ⚠️ sebagian | ✅ component (Vitest), E2E (Playwright, Chromium desktop + mobile), aksesibilitas (axe), tata letak 375px semua portal, cross-browser WebKit/Safari desktop + iPhone (`npm run test:e2e:cross`). ✅ visual regression (12 baseline, `npm run test:visual`), ❌ Firefox (gagal dijalankan di laptop ini) |
| HTTPS/TLS (PRD 6.1) | ❌ | Dikonfigurasi saat deploy (NGINX/Cloudflare) |
| Supabase (PRD 2) | ❌ belum dicoba | Kode sudah mendukung; selama ini memakai PostGIS di Docker |
| Fitur sparepart | ❓ | Tidak ada di PRD; menunggu keputusan tim ([Lampiran 2](#lampiran-2-keputusan-dari-review-flowchart-booking)) |

---

## Tahap 20 Oktober 2026: frontend Paket A & B, aksesibilitas, bundle, visual regression, akses admin, pengingat H-2

| Bagian | Isi | Bukti |
|---|---|---|
| Frontend Paket A | SOS mengirim `price_min/max` + kategori masalah + kendaraan tersimpan (pesanan lama tetap terbaca); owner memilih mekanik & mengubah estimasi biaya; alasan batal (pelanggan & owner) + tampil siapa yang membatalkan; RRN & nama pengirim saat unggah bukti, tampil di panel verifikasi; nomor invoice di e-receipt; hapus layanan; halaman **Ulasan** owner dengan balasan, balasan tampil publik; urutan & filter "jam tersedia" di Cari Bengkel dari API | E2E `backlog-features.spec.ts` |
| Frontend Paket B | Notifikasi kini dari server (riwayat lintas perangkat, nama pelanggan di judul); **Riwayat Status** di halaman pesanan; **Ganti jadwal**; **Kendaraan Saya**; tab **Jadwal & Libur** dan **Foto** di Pengaturan Bengkel; foto teknisi; galeri foto & "slot terdekat" di halaman bengkel; statistik hari ini (owner), angka nyata di beranda; admin: statistik langsung, kotak **Cari**, **Audit Log**, **Kesehatan Sistem**, **Pengguna** | E2E yang sama |
| BE-15 manajemen akses | `GET /admin/users`, `PATCH /admin/users/:id/active` (login & refresh langsung diblokir, sesi dicabut; tidak bisa menonaktifkan diri sendiri / admin terakhir), `POST /admin/users/admins`; semua tercatat di audit log | integration `access-reminders.int.test.ts` + E2E |
| Pengingat H-2 jam | Migrasi `005_reminder_2h.sql` (kolom `booking_details.reminder_2h_sent`); cron tiap 5 menit: notifikasi di aplikasi + email (email masih ke log sampai SMTP diisi). Pengingat H-1 kini juga membuat notifikasi di aplikasi. Ganti jadwal mengaktifkan ulang kedua pengingat | integration |
| Aksesibilitas | axe kini juga memeriksa 3 halaman pelanggan, 13 halaman owner, 8 halaman admin. Diperbaiki: bintang rating & beberapa label tanpa `role`, progress bar tanpa nama, **hijau sukses digelapkan ke `#077A3A`** (PRD `#00A651` hanya 3,2:1), badge angka putih-di-oranye diganti oranye tua | `a11y.spec.ts`, `a11y-auth.spec.ts` |
| Bundle awal | 662 KB → 535 KB (gzip ±212 → ±175 KB): framer-motion lewat `LazyMotion` (mesin animasi dimuat setelah tampil), library QR dimuat saat QR pertama ditampilkan | `vite build` |
| Visual regression | `e2e/visual.spec.ts`: 6 halaman × desktop & HP dibandingkan dengan baseline (`npm run test:visual`, perbarui dengan `test:visual:update`). Area dinamis disamarkan. Terbukti gagal saat warna primer diubah | 12/12 stabil 2× berturut-turut |
| Landing | Menu navigasi digeser ke kanan, dekat tombol akun (permintaan tim) | baseline visual |

**Hasil tes akhir 20 Okt:** backend unit 45/45, integration 46/46; frontend Vitest 40/40, typecheck & build lolos; Playwright desktop + HP 52/52 (journeys, fitur Paket A/B, aksesibilitas publik & setelah login, lintas browser, visual regression, tata letak 375px); WebKit + Safari iPhone 13/13; Postman/Newman 83/83. Firefox tetap tidak bisa dijalankan di laptop ini.

**Bug yang tertangkap tes di tahap ini (sudah diperbaiki):** tab Pengaturan Bengkel tidak berganti saat hanya hash URL berubah; query pengingat H-1/H-2 ditolak PostgreSQL (tipe parameter tidak konsisten), yang akan membuat pengingat H-1 gagal di produksi.

**Catatan menjalankan E2E lokal:** satu putaran penuh memakai >15 login/registrasi, padahal batas backend 15/15 menit per IP (di Docker lokal semua request satu IP). Jalankan per kelompok dan reset di antaranya: `docker compose exec redis redis-cli --scan --pattern 'rl:*' | xargs -r docker compose exec -T redis redis-cli DEL` (folder `backend`), atau tunggu 15 menit.

---

## Paket B backend 20 Oktober 2026 (frontend tidak diubah)

Sama seperti Paket A: hanya menambah, frontend lama tetap jalan. Migrasi `004_backlog_paket_b.sql`: **6 tabel baru** (`notifications`, `order_status_history`, `audit_logs`, `workshop_holidays`, `vehicles`, `workshop_photos`), kolom baru `workshops.closed_weekdays/break_start/break_end`, `mechanics.photo_path`, `orders.vehicle_id`, `emergency_details.problem_category`, plus trigger riwayat status dan trigger append-only audit. ERD lengkap: [docs/erd.md](docs/erd.md).

| # | Item | API |
|---|---|---|
| 10 | Notifikasi di server (dibuat dalam transaksi yang sama dengan aksinya) | `GET /notifications`, `PATCH /notifications/read` |
| 11 | Riwayat status pesanan & pembayaran + pelakunya (trigger database) | `GET /orders/:id/history` |
| 12 | Audit log append-only (approval, verifikasi/tolak/refund bayar, batal oleh bengkel, ubah harga SOS, ganti QRIS, hapus layanan) | `GET /admin/audit-logs` |
| 13 | Statistik nyata | `GET /stats/public`, `GET /workshops/me/stats`, `GET /admin/stats` |
| 14 | Pencarian admin (bengkel, pesanan, invoice/RRN, pengguna) | `GET /admin/search?q=` |
| 15 | Kesehatan sistem | `GET /admin/health` |
| 16 | Hari tutup mingguan, jam istirahat, hari libur | `PUT /workshops/profile` (+`closed_weekdays`, `break_start/end`), `GET/POST/DELETE /workshops/holidays`; availability + `unavailable_reason` |
| 17 | Cari bengkel yang masih punya slot + slot kosong terdekat | `GET /workshops?date=&time_slot=`, `GET /workshops/:id/next-slot` |
| 18 | Kendaraan tersimpan + kategori masalah SOS | `GET/POST/PATCH/DELETE /vehicles`; `vehicle_id` di booking & SOS; `problem_category` di SOS |
| 19 | Foto bengkel (maks 10, satu sampul) & foto mekanik | `GET/POST /workshops/photos`, `PATCH /photos/:id/cover`, `DELETE /photos/:id`, `PUT/DELETE /workshops/mechanics/:id/photo`, gambar publik `GET /workshops/:id/photos/:photoId` |
| 21 | Ganti jadwal booking (slot lama dilepas + antrean naik, urutan kunci anti-deadlock) | `PATCH /orders/:id/reschedule` |

Item 20 (konversi HEIC di server) sengaja belum dikerjakan: frontend sekarang menolak HEIC sebelum sampai server, jadi baru berguna setelah frontend diubah.

**Bug yang tertangkap tes saat pengerjaan:** pencarian slot jam 23:00 lolos karena `TIME + 1 jam` di PostgreSQL berputar ke 00:00; diperbaiki dengan perbandingan detik.

**Hasil tes 20 Okt:** backend unit 45/45, integration 42/42 (9 tes Paket B, termasuk tukar jadwal bersamaan tanpa deadlock), Postman/Newman 80/80 request lolos, frontend Playwright 31 lolos + **2 gagal** (lihat di bawah).

**Temuan frontend (belum diperbaiki, sesuai kesepakatan fase backend):** tes aksesibilitas beranda gagal karena bintang rating di `frontend/src/components/workshop/WorkshopComponents.tsx:302` memakai `aria-label` tanpa `role="img"` (axe: `aria-prohibited-attr`). Bug lama ini baru terlihat setelah ada ulasan berkomentar dari bengkel aktif (dibuat oleh run Postman), karena bagian "ulasan asli" di beranda baru tampil saat itu. Perbaikan: tambah `role="img"` (1 baris).

**Yang perlu dibuat di frontend nanti** (backend sudah siap):
- Ganti notifikasi berbasis polling/localStorage dengan `GET /notifications` (riwayat lintas perangkat).
- Timeline pesanan dari `GET /orders/:id/history`.
- Portal owner: pengaturan hari tutup/istirahat/libur, galeri foto + foto mekanik, statistik harian.
- Portal admin: dashboard dari `/admin/stats`, kotak cari, halaman audit log, halaman kesehatan sistem.
- Pelanggan: kendaraan tersimpan (pilih saat booking/SOS), kategori masalah SOS, tombol ganti jadwal, filter "slot tersedia" dan "slot terdekat" di pencarian.
- Beranda: angka dari `/stats/public`.

---

## Paket A backend 20 Oktober 2026 (frontend tidak diubah)

Disetujui tim 20 Okt: backend boleh diubah, frontend belum. Semua perubahan **hanya menambah** (field opsional, endpoint baru, default tetap), dan seluruh E2E frontend lama tetap lolos tanpa diubah. Migrasi: `003_backlog_paket_a.sql` (hanya kolom baru + sequence `invoice_number_seq`, tanpa tabel baru).

| # | Item | API | Bukti |
|---|---|---|---|
| 1 | Bug PATCH layanan/mekanik diperbaiki di akarnya | `PATCH /workshops/services/:id`, `/mechanics/:id` tidak lagi mereset `duration_minutes`/`specializations` | integration `paket-a.int.test.ts` |
| 2 | Kisaran biaya SOS | `POST /emergency/request` + `price_min`, `price_max` (opsional, min ≤ max); muncul di `emergency.price_min/max` detail order | idem |
| 3 | Ubah estimasi biaya SOS | `PATCH /emergency/:order_id/price` `{ estimated_price }`; terkunci setelah bukti bayar dikirim (`PRICE_LOCKED`) | idem |
| 4 | Hapus layanan (soft delete) | `DELETE /workshops/services/:id`; hilang dari daftar & tidak bisa dibooking, booking lama tetap | idem |
| 5 | Balasan owner untuk ulasan | `PUT`/`DELETE /workshops/reviews/:id/reply`, `GET /workshops/me/reviews`; `owner_reply`, `replied_at` di daftar ulasan publik | idem |
| 6 | Alasan & pihak pembatal | `PATCH /orders/:id/cancel` body opsional `{ reason }`; owner: `cancel_reason` di `PATCH /orders/:id/status`; detail order: `cancel_reason`, `cancelled_by` | idem |
| 7 | Owner memilih mekanik saat menerima SOS | `PATCH /emergency/:order_id/respond` + `mechanic_id` opsional (`MECHANIC_BUSY` bila sedang bertugas) | idem |
| 8 | Urutan daftar bengkel | `GET /workshops?sort=distance\|rating\|recommended` (recommended = 0,6 kedekatan + 0,4 rating); tanpa `sort` perilaku lama | idem |
| 9 | Nomor invoice, RRN, nama pengirim | upload bukti + `payer_reference`, `payer_name` (opsional); verifikasi lunas menerbitkan `invoice_number` `INV-YYYYMMDD-000001` | idem |

**Hasil tes 20 Okt:** backend unit 41/41, integration 33/33 (7 tes baru), Playwright frontend tanpa perubahan 33 lolos (3 dilewati sengaja), Postman/Newman 54/54 request lolos (52 dengan contoh respons asli).

**Yang perlu dibuat di frontend nanti** (backend sudah siap):
- SOS: kirim `price_min`/`price_max` sebagai field, bukan baris "Kisaran biaya:" di keluhan; baca `emergency.price_min/max` (tetap baca format lama untuk pesanan lama via `utils/priceRange.ts`).
- Owner: tombol "Ubah estimasi biaya" di pesanan SOS (`emergencyApi`), pilihan mekanik saat menerima SOS, tombol "Hapus layanan", kolom alasan saat membatalkan, halaman/daftar ulasan dengan balasan.
- Pelanggan: kolom alasan di dialog batal; tampilkan `cancel_reason`/`cancelled_by`; isian opsional RRN & nama pengirim di halaman bayar; nomor invoice di e-receipt; balasan owner di ulasan bengkel.
- Cari bengkel: pakai `sort` dari API (sekarang diurutkan di browser untuk "rating").
- Tambalan bug PATCH di `ownerApi.updateService/updateMechanic` boleh dihapus (tidak berbahaya bila dibiarkan).

---

## Pekerjaan frontend 19 Oktober 2026 (tanpa mengubah backend)

| Perubahan | File utama | Bukti |
|---|---|---|
| Tambalan bug PATCH dipusatkan di lapisan API (layanan selalu kirim `duration_minutes`, mekanik selalu kirim `specializations`) | `services/api/endpoints.ts` | E2E "owner settings keep untouched fields" + uji langsung ke API |
| Modal **Ubah layanan** (nama, deskripsi, harga, durasi + validasi 5–1440 menit) menggantikan `prompt()` harga | `pages/owner/OwnerPages.tsx` | E2E yang sama, cek manual di browser |
| Setelah login, owner/admin yang membuka tautan `/orders/:id` kembali ke pesanan itu (dulu dibuang ke dashboard); admin selalu mendarat di `/admin`; tujuan di luar situs ditolak | `services/auth/AuthProvider.tsx` (`canReturnTo`) | unit test `redirect.test.ts` + E2E |
| Cek & kompres foto sebelum unggah, pratinjau, pesan Indonesia | `utils/imageUpload.ts`, `hooks/usePreparedImage.ts` | unit test + E2E (video ditolak tanpa request ke server, PNG 3 MB diperkecil lalu diterima) + WebKit/Safari |
| Semua kode error backend tampil berbahasa Indonesia | `services/api/errorMessages.ts` | unit test |
| Login Google PKCE (tombol tersembunyi tanpa `VITE_GOOGLE_CLIENT_ID`) | `services/auth/googleOAuth.ts`, `/auth/google/callback` | unit test (vektor RFC 7636, state anti-CSRF) |
| **Bug tata letak:** top bar portal owner lebih lebar dari layar 375px (409px) karena ikon `expand_more` tetap tampil (`hidden` Tailwind kalah oleh CSS Material Symbols) dan logo terlalu lebar | `components/layout/AppLayout.tsx` | E2E `smoke-mobile.spec.ts` (gagal sebelum perbaikan, lolos sesudahnya) |
| Tes lintas browser & tata letak 375px untuk portal pelanggan/owner/admin | `e2e/cross-browser.spec.ts`, `e2e/smoke-mobile.spec.ts` | `npm run test:e2e:cross` |

**Hasil tes 20 Okt (setelah perbaikan backend temuan 4–5):** backend unit 41/41, integration 26/26, Vitest 40/40, Playwright `npm run test:e2e` 33 lolos (3 dilewati sengaja), build lolos.

**Hasil tes akhir 19 Okt:** backend unit 41/41, backend integration 23/23, frontend Vitest 40/40, Playwright `npm run test:e2e` 32 lolos (3 dilewati: tes khusus HP di project desktop), Playwright WebKit + Safari iPhone 13/13, typecheck & build produksi lolos.

**Firefox:** build Firefox Playwright gagal dijalankan di laptop ini (`spawn UNKNOWN`, Windows: *side-by-side configuration is incorrect*, biasanya runtime Visual C++ yang hilang). Ini masalah lingkungan, bukan aplikasi. Project `firefox` tetap ada di `playwright.config.ts`; jalankan di mesin lain atau setelah runtime diperbaiki.

---

## Pekerjaan siap dikerjakan, butuh tindakan tim

Dicatat 19 Oktober 2026. Kedua pekerjaan ini **tidak mengubah backend**, tapi tidak bisa diselesaikan tanpa tindakan dari tim.

### A. Login Google (PKCE) di frontend: PBI-106

> **✅ Bagian frontend sudah dibuat 19 Okt 2026** (lihat tabel di atas). Yang tersisa hanya checklist "Butuh dari tim" di bawah, ditambah `VITE_GOOGLE_CLIENT_ID` di `frontend/.env`.

**Yang bisa langsung dibuat (frontend):**
- Tombol "Masuk dengan Google" (sekarang masih `alert` placeholder di `frontend/src/pages/auth/AuthPages.tsx`) diganti alur PKCE:
  1. Buat `code_verifier` acak (43–128 karakter) dan `code_challenge` = BASE64URL(SHA-256(verifier)) dengan Web Crypto.
  2. Simpan `code_verifier` + `state` acak di `sessionStorage`, lalu redirect ke `https://accounts.google.com/o/oauth2/v2/auth` dengan `client_id`, `redirect_uri`, `response_type=code`, `scope=openid email profile`, `code_challenge`, `code_challenge_method=S256`, `state`.
  3. Halaman baru `/auth/google/callback`: cocokkan `state`, kirim `code` + `code_verifier` ke `POST /auth/google` lewat `authApi.google()` (sudah ada di `services/api/endpoints.ts`), lalu arahkan sesuai peran seperti login biasa.
- Env frontend baru: `VITE_GOOGLE_CLIENT_ID`. Kalau kosong, tombol Google disembunyikan atau dinonaktifkan dengan keterangan.
- Tes E2E untuk alur ini tidak bisa memakai Google sungguhan. Cukup tes bahwa redirect berisi parameter PKCE yang benar, dan tes halaman callback dengan respons API tiruan.

**Butuh dari tim (kode tidak bisa dites tanpa ini):**
- [ ] Buat OAuth Client tipe *Web application* di Google Cloud Console.
- [ ] Authorized redirect URI: `http://localhost:5173/auth/google/callback` (+ URL Vercel saat deploy). Catatan: dev server kadang berjalan di port lain (mis. 5174) bila 5173 terpakai; redirect URI harus sama persis.
- [ ] Isi `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` di `backend/.env` dan `VITE_GOOGLE_CLIENT_ID` di `frontend/.env`.
- [ ] Uji tiga skenario: email baru (jadi CUSTOMER), email yang sudah terdaftar lewat form (harus ter-link), login kedua kali.

### B. Penetration test OWASP ZAP ke API lokal: PRD 8.1

**Yang bisa dijalankan tanpa mengubah kode:**
- Pemindaian otomatis OWASP ZAP (Docker image resmi `zaproxy/zap-stable`, ukuran ±1,5 GB) ke stack lokal:
  - *Baseline scan* (pasif) ke frontend dan API.
  - *API scan* memakai daftar endpoint dari Postman collection (`backend/docs/postman/`), dengan token per peran (customer, owner, admin) supaya endpoint terproteksi ikut diuji, termasuk percobaan BOLA (akses pesanan milik orang lain).
- Fokus PRD 8.1: SQL injection, XSS, *rate limiting bypass*, dan BOLA. Header keamanan (Helmet/CSP/HSTS) juga ikut diperiksa.
- Hasil: laporan HTML/Markdown berisi temuan per tingkat risiko + rekomendasi.

**Butuh dari tim:**
- [ ] Izin mengunduh image ZAP (±1,5 GB) dan menjalankan scan aktif ke backend lokal. Scan aktif mengirim banyak request berbahaya (payload injeksi) dan akan mengisi database lokal dengan data sampah. Jalankan di database terpisah/uji, bukan data yang dipakai demo.
- [ ] Scan aktif akan cepat terkena rate limiter (lihat temuan nomor 2). Perlu diputuskan: jalankan dengan limiter apa adanya (sekaligus menguji limiter), atau naikkan batas sementara khusus sesi pen-test lewat env.
- [ ] Setiap temuan yang perlu perbaikan di backend tetap harus disetujui tim sebelum dikerjakan.
- [ ] Untuk produksi, pen-test sebaiknya diulang di lingkungan staging dengan HTTPS (PRD 6.1).

---

## Lampiran 1: Sisa pekerjaan dari rencana desain Stitch

Dipindah dari [rencana_100persen_desain_stitch.md](rencana_100persen_desain_stitch.md) (bagian 11–15 dan Lampiran A) pada 19 Oktober 2026. Bagian 1–10 (pembanding per layar Stitch) tetap di file aslinya.

### 11. Halaman yang belum ada desainnya di Stitch

Agar seluruh aplikasi konsisten 100%, desain halaman berikut perlu **dibuat dulu di Stitch** (pakai design system yang sama, lalu minta Stitch membuat layar baru):

| Halaman | Route | Catatan |
|---|---|---|
| Masuk | `/login` | Termasuk tombol Google (PBI-106). |
| Daftar pelanggan | `/register` | |
| Daftar bengkel (onboarding mitra) | `/register/workshop` | Jika BE-17 dikerjakan, form ini jadi multi-langkah dengan upload dokumen. |
| Form permintaan SOS (halaman penuh, desktop & mobile) | `/emergency` | Atau putuskan cukup memakai tab 2 di beranda. |
| Daftar pesanan saya | `/orders` | |
| Profil bengkel publik (ulasan, mekanik, galeri foto) | baru | Ulasan & mekanik tidak ada di layar booking Stitch. |
| Owner: Panggilan Darurat, Verifikasi Pembayaran, Kelola Mekanik, Pengaturan Bengkel (termasuk layanan & QRIS), Pesanan | `/owner/*` | Sesuai tab Stitch. |
| Admin: Persetujuan Mitra, Audit Transaksi, Monitoring PostGIS, Manajemen Akses, Pengaturan | `/admin/*` | Sesuai menu sidebar Stitch. |
| Halaman statis: Promo & Garansi, Skema Kemitraan, Syarat & Ketentuan, Kebijakan Privasi, Kebijakan Pembatalan, Standar Mutu | baru | KONTEN. |
| Halaman 404 / error / loading | – | |

---

### 12. Konflik yang harus diputuskan tim

#### 12.1 Warna primer
- **PRD 3.1** mewajibkan `#0194DA`. **HTML Stitch** memakai `#006191` untuk tombol, link, dan tab aktif, walaupun dokumen Stitch sendiri menyebut `#0194DA`.
- Teks putih di atas `#0194DA` kontrasnya **±3,4:1**, sehingga **gagal WCAG AA** untuk teks normal (PRD 8.2 mensyaratkan AA). `#006191` kontrasnya **±6,7:1** dan lolos.
- **Saran:** pakai `#006191` untuk tombol & teks link, `#0194DA` untuk aksen/ikon/ilustrasi, lalu perbarui PRD 3.1.

#### 12.2 Alur bayar sebelum atau sesudah konfirmasi
- **Stitch:** pilih slot → data kendaraan → **bayar QRIS (dengan timer)** → "Booking Berhasil Dikonfirmasi".
- **Backend sekarang:** `POST /booking` langsung menghasilkan `CONFIRMED`/`IN_QUEUE`; pembayaran bisa dilakukan kapan saja setelahnya, dan diverifikasi manual oleh bengkel.
- Mengikuti Stitch berarti: status baru `AWAITING_PAYMENT`, slot ditahan sementara (BE-5), pembatalan otomatis jika timer habis, dan konfirmasi setelah pembayaran diverifikasi. Ini **perubahan alur bisnis dan backend yang besar (L)**.
- Bagaimana dengan **pesanan daftar tunggu** (`IN_QUEUE`)? Apakah harus bayar dulu walau belum pasti dapat slot? Perlu diputuskan.

#### 12.3 Slot per jam vs slot berbasis durasi + pit
Stitch menampilkan slot sesuai durasi layanan (mis. 75 menit) dan per pit. Mesin kuota backend (PBI-303, sudah lolos uji k6) berbasis **per jam**. Mengubahnya berisiko dan berukuran besar.
**Saran:** tetap per jam; tampilkan durasi sebagai estimasi selesai.

#### 12.4 Komisi platform 5%
KPI admin dan tabel audit memakai "Platform fee 5%" dan "Net bengkel". Saat ini pembayaran masuk langsung ke QRIS **milik bengkel**, jadi platform tidak menerima uang dan tidak bisa memotong komisi. Butuh keputusan model bisnis (dan kemungkinan payment gateway dengan *split settlement*).

#### 12.5 Klaim marketing & kebijakan
"#1 di Indonesia", "2.500+ bengkel", "120.000+ pemilik kendaraan", "Garansi 14 hari / 1.000 KM", "Voucher Rp50k jika telat > 15 menit", "Omzet naik 180%", "Terlindungi Bank Indonesia", "Tax invoice valid".
Semua ini **tidak boleh ditampilkan sebelum benar** (risiko hukum/perlindungan konsumen). Angka statistik bisa diambil dari BE-1. Kebijakan butuh keputusan bisnis.

#### 12.6 Label teknis di UI
Stitch menampilkan istilah internal ke pelanggan: "PostGIS ST_DWithin", "Pessimistic Row-Locking", "Redis Concurrency Safe", "RFC-5424", "Engine v4.0". Kalau diikuti 100%, istilah ini tampil apa adanya.
**Saran:** pertahankan di portal admin, tapi ganti dengan bahasa awam di halaman pelanggan.

---

### 13. Daftar perubahan backend (gabungan)

Semua item di bawah **mengubah backend**, jadi perlu persetujuan tim sebelum dikerjakan. Nama kolom/endpoint hanya usulan.

##### BE-1 Statistik publik
`GET /stats/public` → `{ active_workshops, active_mechanics, total_customers, avg_platform_rating, avg_emergency_response_minutes, cities[] }`. Cache di Redis ±5 menit. **S–M**

##### BE-2 Profil bengkel diperluas (foto, fasilitas, wilayah, merek)
- Tabel `workshop_photos (id, workshop_id, path, is_cover, sort_order)` + `POST/DELETE /workshops/photos` (validasi gambar seperti QRIS, maks 2 MB) + `GET /workshops/:id/photos/:photoId` (publik, gambar dikompres/thumbnail).
- Kolom `workshops.facilities TEXT[]` (enum: `AC_LOUNGE`, `WIFI`, `MUSHOLLA`, `COFFEE`, `OPEN_SUNDAY`, `TOWING`, …), `certifications TEXT[]`, `specialties TEXT[]`, `brand_authorized TEXT[]`.
- Kolom `workshops.city`, `district`, `landmark` (patokan).
- Kolom `workshops.closed_weekdays SMALLINT[]`, `break_start TIME`, `break_end TIME`, tabel `workshop_holidays`.
- `GET /workshops` diperluas: filter `facility`, `city`, `sort=distance|rating|price`, dan respons berisi `cover_photo_url`, `min_service_price`, `facilities`, `city/district`, plus `total` untuk paginasi.
**M**

##### BE-3 Kategori layanan global
Tabel `service_categories (id, slug, name, description, icon, badge)` + `services.category_id` + `GET /service-categories` (dengan `min_price`, `workshop_count`) + filter `category` di `GET /workshops`. **M**

##### BE-4 Cari bengkel berdasarkan ketersediaan slot
`GET /workshops?date=&time_slot=` hanya mengembalikan bengkel yang masih punya kuota, plus `next_available_slot` per bengkel. `GET /workshops/:id/availability/summary?from=&to=` untuk status 7 hari. **M**

##### BE-5 Reservasi sementara (hold) slot & batas waktu bayar
Tabel `slot_holds (id, workshop_id, date, time_slot, customer_id, expires_at)`, `POST /booking/hold`, `DELETE /booking/hold/:id`, cron pembersih, perhitungan kuota yang memperhitungkan hold. Jika alur 12.2 diikuti: status `AWAITING_PAYMENT`, `transactions.pay_before`, dan pembatalan otomatis. **L**

##### BE-6 Pit / bay servis
Tabel `workshop_bays (id, workshop_id, name, type, capacity_note, is_active)`, `booking_details.bay_id`, penugasan bay otomatis bersama mekanik, status bay. Endpoint CRUD bay + `GET /workshops/me/board?date=` untuk papan pit. Kolom `mechanics.photo_path`, `title`, `certifications`. **L**

##### BE-7 Armada & lokasi mekanik live
Tabel `fleet_units (id, workshop_id, type, plate, label)`, `mechanics.unit_id`, endpoint mekanik/owner untuk mengirim lokasi (`POST /orders/:id/mechanic-location`) atau aplikasi mekanik terpisah, `GET /orders/:id/tracking` (posisi terakhir). Opsional: WebSocket/SSE agar tidak polling. **L** (+ INT untuk ETA/rute)

##### BE-8 Kendaraan tersimpan pelanggan
Tabel `vehicles (id, user_id, type, brand, model, year, color, plate)`, CRUD `/vehicles`, `orders.vehicle_id`. **M**

##### BE-9 Detail kendaraan & jenis masalah darurat
`emergency_details.problem_category` (enum: `BATTERY`, `TIRE`, `ENGINE`, `TOWING`, `FUEL`, `OTHER`), `orders.vehicle_id` (BE-8) atau kolom model/warna di order, `emergency_details.address_text`, `region`. Daftar peralatan per kategori. **S–M**

##### BE-10 Multi-layanan / add-on per pesanan
Tabel `order_items (order_id, service_id, name, price, qty, kind)`, `services.is_addon`, total dihitung server. `POST /booking` menerima `addon_service_ids[]`. Laporan & e-receipt membaca item. **L**

##### BE-11 Promo & voucher
Tabel `promotions` (kode, jenis potongan, syarat jam/slot, kuota, masa berlaku), validasi saat booking, `order_items` berjenis `DISCOUNT`. Halaman "Promo & Garansi". **M–L**

##### BE-12 Komisi platform & biaya layanan
Kolom `transactions.platform_fee`, `net_amount`, konfigurasi persentase, laporan. Bergantung keputusan 12.4. **M** (tanpa payment gateway) / **L** (dengan split settlement)

##### BE-13 Audit log
Tabel `audit_logs (id, actor_id, action, entity, entity_id, payload_hash, created_at)`, append-only, dicatat di aksi penting (approval, verifikasi bayar, perubahan status). `GET /admin/audit-logs`. **M**

##### BE-14 Health & telemetri (admin & owner)
`GET /admin/health` → status DB/PostGIS (latensi), Redis, jadwal cron berikutnya, versi. Metrik lock (deadlock, hold time) perlu instrumentasi di `withTransaction()`. **M**

##### BE-15 Manajemen akses admin
CRUD user (nonaktifkan user, ganti role, admin tambahan) + pengaturan platform. **M**

##### BE-16 Pencarian admin
`GET /admin/search?q=` lintas bengkel, pesanan (order_number/invoice), dan transaksi (RRN). **S–M**

##### BE-17 Dokumen & verifikasi mitra
Tabel `workshop_documents (workshop_id, type: NIB|NPWP|FACADE_PHOTO|BANK_BOOK, path, status, note)`, upload saat daftar, status `NEEDS_REVISION`, skor verifikasi, grade UMKM, jadwal survei, verifikasi NIK & OTP WhatsApp (INT). **L**

##### BE-lain (kecil)
- `transactions.invoice_number`, `payer_reference` (RRN), `payer_name`, `method` (`QRIS`/`VA`/`CASH`). **S** ✅ invoice/RRN/nama pengirim selesai 20 Okt; `method` (tunai/VA) masih menunggu keputusan pembayaran.
- `workshops.code` (mis. `WKS-JKT-0982`), `qris_merchant_name`, `qris_nmid`, `emergency_base_fee`. **S**
- Format nomor antrean berhuruf (`A-04`) dan nomor pesanan `BGO-…` (opsional). **S**
- `order_status_history` untuk timeline berjam. **M**
- `PATCH /orders/:id/cancel` menerima `reason` (✅ selesai 20 Okt); `PATCH /orders/:id/reschedule`; `POST /orders/:id/check-in`. **M**
- `PATCH /emergency/:id/respond` menerima `mechanic_id`. **S** ✅ **Selesai 20 Okt** (Paket A, backend).
- Statistik owner `GET /workshops/me/stats?date=` dan admin `GET /admin/stats`, `GET /admin/transactions`. **M**
- Pengingat H-2 jam (selain H-1) + kanal WhatsApp. **M**
- **Tambahan 19 Okt 2026** (muncul dari fitur frontend hari ini; frontend sudah memakai solusi sementara):
  - **Kisaran biaya SOS**: kolom `emergency_details.price_min`, `price_max` (+ validasi min ≤ max) dan diterima di `POST /emergency/request`. Sekarang kisaran dititipkan sebagai baris terakhir `problem_description` dan dipisah lagi di frontend (`frontend/src/utils/priceRange.ts`); setelah kolom ada, frontend cukup diganti membaca kolom itu. **S** ✅ **Selesai 20 Okt** (Paket A, backend).
  - **Ubah estimasi biaya SOS setelah diterima**: endpoint (mis. `PATCH /emergency/:id/price`) agar owner bisa mengubah harga saat status `ACCEPTED`/`IN_PROGRESS`. Sekarang harga hanya bisa diisi saat menerima, atau sebagai total akhir saat selesai. **S** ✅ **Selesai 20 Okt** (Paket A, backend).
  - **Notifikasi sisi server**: tabel `notifications (user_id, type, title, body, link, read_at, created_at)`, `GET /notifications`, `PATCH /notifications/read`, dibuat di setiap perubahan status/pembayaran; lalu kanal di luar aplikasi (Web Push/FCM, email, WhatsApp) terutama untuk SOS masuk ke owner. Sekarang notifikasi dihitung di frontend dari polling, riwayatnya hanya di perangkat itu, dan tidak ada pemberitahuan saat aplikasi tertutup. **M–L** (+ INT untuk WhatsApp/push)
  - **Hapus layanan**: `DELETE /workshops/services/:id` (soft delete). Sekarang layanan hanya bisa dinonaktifkan. **S** ✅ **Selesai 20 Okt** (Paket A, backend).
  - **Balasan owner untuk ulasan**: kolom `reviews.owner_reply`, `replied_at` + endpoint owner. **S** ✅ **Selesai 20 Okt** (Paket A, backend).
  - **IP asli pengguna untuk rate limiter**: `app.set('trust proxy', …)` sesuai jumlah proxy (NGINX/Cloudflare). Sekarang semua pengguna lokal terhitung satu IP (`172.18.0.1`), sehingga satu orang bisa menghabiskan kuota login semua orang. Lihat temuan nomor 2 di [status_backlog_prd.md](#temuan-selama-pengujian). **S**
- **Bug yang ditemukan saat pengujian:** `updateServiceSchema` dan `updateMechanicSchema` memakai `.partial()` di atas field ber-`.default()`, sehingga PATCH parsial mereset `duration_minutes` ke 60 dan `specializations` ke `[]` ([workshop.schema.ts:36-47](backend/src/features/workshop/workshop.schema.ts:36)). Dibuktikan ulang 19 Okt: PATCH `{price}` saja mengubah durasi 90 → 60. Frontend menambalnya **di satu tempat** (`ownerApi.updateService/updateMechanic` di `frontend/src/services/api/endpoints.ts` selalu mengirim ulang nilai lama) dan ada tes E2E yang menjaganya. Perbaikan yang benar tetap di backend: hapus default pada skema update. **S** ✅ **Selesai 20 Okt** (Paket A, backend).

### 14. Integrasi pihak ketiga (INT)

| Integrasi | Dipakai di | Pilihan |
|---|---|---|
| Virtual Account / kartu / e-wallet langsung | QRIS (bagian 5), ringkasan booking | Midtrans, Xendit, DOKU |
| Pencocokan mutasi bank / OCR bukti bayar ("Auto-OCR 99%", "Verifikasi otomatis") | QRIS, owner, admin | Payment gateway (notifikasi otomatis) atau layanan OCR |
| Reverse geocoding (koordinat → alamat & wilayah) | Beranda tab SOS, tracking SOS | Nominatim (OSM), Google Geocoding |
| ETA, rute, kondisi lalu lintas | Beranda radar, tracking SOS, status booking, owner | OSRM (rute tanpa lalu lintas), Google Directions / HERE (dengan lalu lintas) |
| Google/Apple Wallet pass | Status booking ("Simpan Pass") | Google Wallet API, Apple PassKit |
| OTP WhatsApp & verifikasi NIK | Onboarding mitra (admin) | Penyedia WhatsApp Business API; verifikasi NIK butuh mitra resmi |
| PDF e-receipt | Status booking, admin export | Bisa tanpa pihak ketiga (library PDF) |

### 15. Urutan pengerjaan yang disarankan

| Fase | Isi | Butuh backend? | Perkiraan |
|---|---|---|---|
| **1. Visual murni** | Bagian 1 (token), 2.1–2.5 (shell, termasuk owner tab horizontal & top bar admin tanpa data baru), susunan ulang layout semua layar (stepper, kartu, banner, pass putih + QR dari nomor pesanan, modal batal, SOS strip, grafik throughput dari data kuota), konten statis yang **benar** (keunggulan, FAQ), dan halaman QRIS terpisah (tanpa timer). | Tidak | 4–6 hari |
| **2. Data kecil** | BE-1, BE-lain (invoice, RRN, nama pembayar, kode bengkel, NMID, alasan batal, `mechanic_id` saat terima SOS), statistik owner/admin, daftar transaksi admin, perbaikan bug skema update. | Ya (S–M) | 4–6 hari |
| **3. Profil & katalog** | BE-2 (foto, fasilitas, wilayah, jam istirahat), BE-3 (kategori layanan), BE-4 (cari berdasarkan slot), BE-8/BE-9 (kendaraan & kategori masalah), riwayat status. Plus konten foto asli. | Ya (M) | 1,5–2 minggu |
| **4. Fitur besar** | BE-5 (hold slot + bayar dulu) setelah keputusan 12.2, BE-6 (pit), BE-10/11 (add-on, promo), BE-13/14 (audit & telemetri), BE-17 (dokumen mitra). | Ya (L) | 3–5 minggu |
| **5. Integrasi** | Payment gateway/VA, OCR, geocoding, ETA/lalu lintas, armada live (BE-7), wallet pass, WhatsApp OTP. | Ya + pihak ketiga | 3–6 minggu |
| **6. Layar baru** | Desain di Stitch untuk halaman di bagian 11, lalu implementasi. | Sebagian | 1–2 minggu |

Setelah setiap fase, lakukan **perbandingan berdampingan** dengan screenshot Stitch resolusi penuh di lebar 1280px dan 390px. Screenshot penuh bisa diunduh dari URL screenshot Stitch dengan akhiran `=w1280` (desktop) atau `=w390` (mobile).

---

### Lampiran A: Aset yang harus disiapkan tim

- [ ] Logo BengkelGo (SVG, versi terang & gelap) + favicon
- [ ] Foto setiap bengkel mitra (fasad, area servis/pit), minimal 1 foto sampul per bengkel
- [ ] Foto mekanik (dengan persetujuan mekanik)
- [ ] Ikon/ilustrasi kategori layanan
- [ ] Aset logo QRIS/GPN dan logo bank/e-wallet sesuai pedoman merek masing-masing
- [ ] Teks: FAQ, Syarat & Ketentuan, Kebijakan Privasi, Kebijakan Pembatalan, Garansi, Skema Kemitraan, artikel panduan
- [ ] Nomor hotline darurat & WhatsApp CS
- [ ] Daftar kota/wilayah layanan

> Gambar di mockup Stitch (foto bengkel, mekanik, logo) adalah gambar AI yang di-host sementara oleh Google (`lh3.googleusercontent.com/aida-public/...`). Gambar itu **tidak boleh** dipakai di produksi, karena tautannya bisa kedaluwarsa dan tidak menggambarkan bengkel asli.

---

## Lampiran 2: Keputusan dari review flowchart booking

Dipindah dari [review_flowchart_booking_vs_backend.md](review_flowchart_booking_vs_backend.md) pada 19 Oktober 2026. Perbandingan per langkah tetap di file aslinya.

### Hal yang perlu dibahas dengan tim

#### 1. Sparepart tidak ada di PRD

Ini fitur baru, jadi backend belum mengenalnya. Kalau mau dimasukkan, backend butuh:

- **Katalog sparepart per bengkel**: nama, harga, stok, jenis kendaraan (motor/mobil), status aktif. Owner bisa menambah, mengubah, dan menonaktifkan item.
- **Item sparepart per booking**: sparepart apa saja dan berapa jumlahnya untuk setiap booking.
- **Total tagihan** = harga layanan + total sparepart.
- **Penguncian stok** dengan `SELECT … FOR UPDATE`, sama seperti kuota slot. Tanpa itu, dua pelanggan bisa membeli unit terakhir secara bersamaan. Ini sesuai prinsip PRD nomor 2 (transaksi database dan penguncian).
- **Pengembalian stok** saat booking dibatalkan.

Pertanyaan untuk tim:

- [ ] Apakah sparepart masuk cakupan proyek ini? Kalau ya, PRD perlu diperbarui.
- [ ] Kapan stok dikurangi: saat booking dibuat, atau saat servis selesai?
- [ ] Kalau booking masuk waiting list (`IN_QUEUE`), apakah stok sparepart-nya ikut dipesan?
- [ ] Bolehkah owner mengubah daftar sparepart setelah booking dibuat (misalnya mekanik menemukan kerusakan lain saat servis)?

#### 2. Langkah "pilih layanan servis" tidak ada di flowchart

Backend mewajibkan `service_id` (misalnya "Servis Rutin + Ganti Oli") saat booking, karena dari situ harga dan jenis kendaraan ditentukan. Di flowchart, user langsung memilih jadwal lalu sparepart.

Pertanyaan untuk tim:

- [ ] Apakah urutannya pilih layanan, lalu jadwal, lalu sparepart (opsional)?
- [ ] Atau memang boleh booking **hanya untuk beli/pasang sparepart** tanpa layanan servis?

#### 3. Kasus slot penuh belum digambarkan

Di backend, slot yang penuh **tidak ditolak**. Booking tetap dibuat dengan status **`IN_QUEUE`** (waiting list), dan otomatis naik menjadi `CONFIRMED` kalau ada yang membatalkan atau owner menambah kapasitas.

Saran untuk flowchart:

- Tambahkan cabang "Slot penuh?". Kalau ya, tampilkan peringatan "Anda akan masuk antrean", lalu user memilih lanjut atau ganti jadwal.
- Tiket booking menampilkan **status** (`CONFIRMED` / `IN_QUEUE`), **nomor antrean**, dan **posisi di waiting list**.

#### 4. Login diminta sebelum melihat profil bengkel

Ini **tidak bertentangan** dengan backend, karena profil, layanan, dan jadwal bengkel bersifat publik. Tapi dari sisi UX, biasanya user dibiarkan melihat-lihat dulu, lalu login diminta saat menekan **"Konfirmasi Booking"**. Dengan begitu, calon pelanggan tidak langsung terhalang halaman login.

Pertanyaan untuk tim:

- [ ] Login di awal (seperti flowchart sekarang) atau di akhir sebelum konfirmasi? Backend mendukung keduanya.

#### 5. Filter "rating" dan "kombinasi"

Saat ini backend hanya punya dua cara mengurutkan:
- tanpa lokasi: urut rating tertinggi;
- dengan lokasi: urut jarak terdekat.

Untuk filter "rating" dengan lokasi dan filter "kombinasi", backend perlu parameter `sort`, misalnya `sort=distance | rating | recommended`. Untuk "recommended" bisa memakai skor gabungan jarak dan rating, seperti yang sudah dipakai di fitur emergency (0,6 × kedekatan + 0,4 × rating). Perubahannya kecil.

- [ ] Apa definisi "kombinasi" menurut tim? Skor gabungan, atau filter bertingkat (misalnya radius 5 km lalu diurutkan berdasarkan rating)?

#### 6. Data registrasi

Flowchart menyebut "input username & password", sedangkan backend memakai **nama, email, nomor WhatsApp, password**. Email dipakai untuk login dan pengingat booking, dan nomor WhatsApp untuk dihubungi bengkel.

Selain itu, backend sudah mendukung **Login dengan Google**, yang bisa ditambahkan sebagai jalur alternatif di flowchart.

#### 7. Cakupan flowchart baru sebatas booking

Alur berikut belum punya flowchart, padahal sudah ada di backend:

- **Emergency / SOS breakdown**, yang merupakan fitur inti PRD: scan bengkel radius 5 km, kirim permintaan, bengkel menerima atau menolak, otomatis dialihkan ke bengkel lain, mekanik dikirim.
- **Pembayaran QRIS**: lihat QRIS bengkel, upload bukti bayar, bengkel memverifikasi.
- **Review**: beri rating setelah order selesai.
- **Sisi bengkel (owner)**: registrasi, approval admin, atur layanan/mekanik/kuota, kelola antrean.
- **Sisi admin**: approval bengkel, laporan transaksi.

---

### Ringkasan keputusan yang dibutuhkan

| # | Keputusan | Dampak ke backend |
|---|---|---|
| 1 | Sparepart masuk cakupan atau tidak? | **Besar**: tabel baru, endpoint baru, penguncian stok, test |
| 2 | Pilih layanan wajib atau tidak? | Kecil hingga sedang |
| 3 | Kasus slot penuh dimasukkan ke flow? | Tidak ada (backend sudah mendukung) |
| 4 | Login di awal atau di akhir? | Tidak ada (keputusan frontend) |
| 5 | Definisi filter "kombinasi"? | Kecil: tambah parameter `sort` |
| 6 | Data registrasi disamakan dengan backend? | Tidak ada (flowchart yang menyesuaikan) |
| 7 | Flowchart untuk emergency, pembayaran, review, owner, admin? | Tidak ada (dokumentasi tim) |

---

## Lampiran 3: Checklist verifikasi manual portal owner & admin

Dipindah dari [checklist_verifikasi_portal_owner_admin.md](checklist_verifikasi_portal_owner_admin.md) pada 19 Oktober 2026. Sebagian besar alurnya kini juga diuji otomatis lewat Playwright (`npm run test:e2e` di `frontend/`); checklist ini tetap berguna untuk pengecekan visual oleh manusia.

**Konteks:** frontend sudah diganti ke desain Stitch ("Traveloka-Style Landing Page"). Halaman pelanggan sudah dicek di browser. **Portal owner dan admin belum dicek secara visual.** Dokumen ini berisi langkah untuk memeriksanya.
**Yang diubah:** hanya `frontend/src/components/`, `pages/`, `theme/`, `App.tsx`, `index.html`. Backend tidak disentuh.
**Tanggal dibuat:** 18 Oktober 2026

---

#### 0. Persiapan

1. Backend hidup: `cd backend && docker compose up -d` (API di `http://localhost:8080`).
2. Frontend:
   ```bash
   cd frontend
   npm run dev
   ```
   Buka `http://localhost:5173`. Kalau port 5173 sedang dipakai, jalankan `npm run dev -- --port 5180`.
3. Siapkan dua ukuran layar: **desktop (1440px)** dan **mobile (375px)**. Di Chrome: DevTools → Toggle device toolbar. Ini sesuai PRD 8.2.

#### 1. Akun yang dipakai

| Peran | Email | Password | Catatan |
|---|---|---|---|
| Admin | `admin@bengkelapp.com` | nilai `SEED_ADMIN_PASSWORD` di `backend/.env` (baris 56) | Satu-satunya akun yang dibuat seeder (`npm run seed`). Kalau login gagal, jalankan ulang `cd backend && npm run seed`. Seeder akan mengatur ulang password admin ke nilai di `.env`. |
| Owner bengkel | **belum ada** | – | Seeder tidak membuat owner. Owner dari load test k6 tidak punya password. Buat lewat langkah 2 di bawah. Usulan data akun ada di file akun uji lokal (tidak masuk Git). Boleh juga pakai data sendiri. |
| Pelanggan (Sinta) | akun uji lama | password milik Anda | Login ulang kalau perlu. |

> Password yang dipakai di formulir harus: min. 8 karakter, ada huruf besar, huruf kecil, dan angka.

---

#### 2. Daftar bengkel uji (membuat akun owner)

Buka `/register/workshop`.

- [ ] Banner navy "Daftarkan bengkel Anda" tampil. Kartu **Data pemilik**, **Data bengkel**, dan **Lokasi bengkel** tersusun rapi.
- [ ] Ikon pada input (person, mail, call, lock, schedule) tampil sebagai ikon, bukan teks seperti `mail`. Kalau yang muncul teks, berarti font Material Symbols gagal dimuat.
- [ ] Pilihan jenis kendaraan berbentuk tombol pil (Motor & Mobil / Motor / Mobil) dan bisa diganti.
- [ ] Peta menampilkan label "Klik pada peta untuk menandai lokasi". Setelah diklik, muncul titik biru dan teks koordinat.
- [ ] Tombol **Daftarkan bengkel** nonaktif sebelum titik peta dipilih.
- [ ] Isi formulir:
  - Nama bengkel: `Bengkel Uji Desain Stitch`
  - Pilih titik di **Jakarta Pusat**, supaya masuk radius 5 km untuk uji SOS.
  - Kirim formulir. Setelah itu Anda otomatis masuk ke `/owner`.

#### 3. Portal owner

Layout yang diharapkan (diperbarui 19 Okt 2026): **sidebar kiri + top bar**, sama seperti portal admin. Menu sidebar: Ringkasan · Panggilan Darurat · Semua Pesanan · Kalender & Kuota Slot · Kelola Teknisi · Verifikasi Pembayaran · Pengaturan Bengkel · Notifikasi. Di top bar ada tombol status "Buka & Siaga SOS", lonceng notifikasi (dropdown 6 terbaru + "Lihat semua notifikasi"), dan menu akun (Lihat situs pelanggan, Keluar). Di mobile sidebar diganti tombol ☰. Layanan dan QRIS kini berada di tab **Pengaturan Bengkel**.

##### 3a. Ringkasan (`/owner`)
- [ ] Judul berisi nama bengkel, ditambah chip status **Menunggu verifikasi**, Buka/Tutup, Siaga SOS, dan rating "Baru".
- [ ] Muncul alert kuning "Status bengkel: Menunggu verifikasi…" dan alert "QRIS belum diunggah…" yang berisi tautan **Unggah QRIS**.
- [ ] Ada strip hijau berkedip "Tidak ada panggilan darurat masuk…" (radar memeriksa setiap 5 detik).
- [ ] Ada 4 kartu statistik: Booking hari ini, Darurat ditangani, Utilisasi kuota, Menunggu verifikasi.
- [ ] Kartu "Antrean booking hari ini" kosong dan memakai empty state berikon. Kartu "Verifikasi pembayaran" juga kosong.

##### 3b. Layanan (`/owner/services`)
- [ ] Tambahkan 1 layanan, misalnya `Servis Rutin` Rp 80.000, 60 menit, Motor. Layanan muncul di tabel.
- [ ] Klik harga di tabel. Prompt "Harga baru" muncul, dan setelah disimpan harga berubah.
- [ ] Tombol Nonaktifkan/Aktifkan berfungsi. Baris layanan nonaktif tampil pudar.

##### 3c. Teknisi (`/owner/mechanics`, tab "Kelola Teknisi")
- [ ] Tambahkan 1 teknisi dengan keahlian `matic, injeksi`. Teknisi tampil sebagai kartu (avatar huruf, chip keahlian, rating "Baru").
- [ ] Badge "N aktif" di header ikut berubah.
- [ ] **Ubah**: modal edit nama/WA/keahlian, simpan, kartu ikut berubah.
- [ ] **Hapus**: modal konfirmasi, teknisi pindah ke "arsip teknisi" (data & rating tetap tersimpan).
- [ ] **Pulihkan** dari arsip: teknisi aktif lagi dengan keahlian yang sama.

##### 3d. Kuota slot (`/owner/quotas`)
- [ ] Strip tanggal 14 hari bisa digeser, dan tanggal terpilih berwarna biru.
- [ ] Setiap jam tampil sebagai kartu (rentang jam, chip Sisa/Penuh, progress bar, tombol − / + untuk kapasitas).
- [ ] Ubah kapasitas satu slot lalu **Simpan**. Badge "x/y terisi" di atas ikut berubah.

##### 3e. Profil & QRIS (`/owner/profile`)
- [ ] Tampilan 2 kolom di desktop: Informasi + Lokasi di kiri, Operasional di kanan.
- [ ] Toggle **Bengkel buka** dan **Siaga darurat SOS** berbentuk switch dan bisa digeser.
- [ ] **Simpan profil**: muncul alert hijau "Profil tersimpan."
- [ ] Unggah gambar QRIS (PNG/JPG, < 2 MB). Badge berubah menjadi "Sudah diunggah", dan alert QRIS di Ringkasan hilang.

##### 3f. Pesanan (`/owner/orders`)
- [ ] Filter Tipe (pil), Status (dropdown), dan Tanggal berfungsi. Tombol **Reset** muncul saat ada filter aktif.
- [ ] Saat belum ada data, empty state "Tidak ada pesanan." tampil.
- [ ] Pesanan **dibatalkan** tidak tampil di daftar; tombol **Lihat riwayat dibatalkan (n)** menampilkannya.

##### 3g. Mobile (375px)
- [ ] Sidebar tersembunyi. Tombol ☰ membuka menu, dan menu tertutup otomatis setelah pindah halaman.
- [ ] Tidak ada scroll horizontal di semua halaman owner (cek terutama tabel Layanan dan kartu Kuota).

Setelah selesai, klik ikon **keluar** di kotak user.

---

#### 4. Portal admin

Login di `/login` dengan akun admin (lihat bagian 1). Anda otomatis masuk ke **Dashboard Overview** (`/admin`), yang berisi KPI, pipeline persetujuan, status pesanan, dan bengkel teratas.

##### 4a. Persetujuan mitra (`/admin/workshops`)
- [ ] Layout sidebar dengan logo "BengkelGo Admin" dan 2 menu: Persetujuan Mitra, Laporan Transaksi.
- [ ] Filter pil: Menunggu verifikasi (default), Aktif, Ditolak, Dinonaktifkan, Semua.
- [ ] Kartu **Bengkel Uji Desain Stitch** tampil dengan border kuning. Bagian bawahnya memuat info Pemilik, Operasional, Kendaraan, dan Koordinat (+ tautan "Lihat peta").
- [ ] Klik **Setujui mitra**. Muncul alert hijau "Status mitra berhasil diperbarui.", dan kartu hilang dari filter "Menunggu verifikasi".
- [ ] Di filter **Aktif**, bengkel uji muncul dengan tombol **Nonaktifkan** (merah). Tombol ini memunculkan prompt alasan. *Jangan dikonfirmasi kalau bengkel masih mau dipakai.*

##### 4b. Laporan transaksi (`/admin/reports`)
- [ ] Input tanggal Dari/Sampai berada di kanan header. Defaultnya 30 hari terakhir.
- [ ] Ada 4 kartu KPI: Pendapatan terverifikasi, Menunggu verifikasi, Total pesanan, Selesai/batal.
- [ ] Grafik **Tren harian**: setiap batang punya tooltip (tanggal · pesanan · pendapatan). Grafik bisa di-scroll horizontal kalau periodenya panjang.
- [ ] Kartu "Per tipe layanan", "Per status" (dengan progress bar), dan tabel "Bengkel teratas" tampil.
- [ ] Ubah rentang tanggal ke periode tanpa data. Muncul teks "Belum ada…", bukan error.

##### 4c. Mobile (375px)
- [ ] Menu ☰ berfungsi. Kartu persetujuan tersusun vertikal dan tombol aksi tidak terpotong.

---

#### 5. Uji lanjutan setelah bengkel disetujui (opsional, end-to-end)

Bagian ini menguji tampilan alur yang melibatkan owner, yaitu kartu SOS masuk dan verifikasi pembayaran.

- [ ] **Beranda (`/`)**: bengkel uji muncul di daftar dan kartunya bisa dibuka.
- [ ] **SOS sebagai tamu**: buka jendela incognito, masuk ke `/emergency`, lalu pilih titik di dekat bengkel uji dan isi kendala + nama/WA. Klik **Kirim permintaan bantuan**.
  - [ ] Di sisi tamu tampil header merah dengan **countdown** batas respons, timeline status, dan tips keselamatan.
  - [ ] Di dashboard owner (dalam 5 detik) muncul **kartu panggilan darurat merah** dengan countdown, tombol **Terima & kirim mekanik**, dan **Tolak / alihkan**.
  - [ ] Klik Terima. Timeline tamu berpindah ke "Bengkel menerima & mekanik dikirim", dan kartu mekanik muncul dengan tombol Telepon/WhatsApp.
- [ ] **Booking + QRIS**: login sebagai pelanggan, booking di bengkel uji, lalu upload bukti di panel **Pembayaran QRIS**.
  - [ ] Owner: kartu "Verifikasi pembayaran" di Ringkasan berisi pesanan tersebut. Buka detailnya, lalu cek tombol **Verifikasi lunas** dan **Tolak & minta unggah ulang**.

---

#### 6. Catatan temuan

| # | Halaman | Ukuran layar | Masalah | Screenshot |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |

#### 7. Bersih-bersih

- Tidak ada endpoint untuk menghapus bengkel. Kalau bengkel uji tidak ingin tampil ke pelanggan, nonaktifkan lewat admin: filter **Aktif** → **Nonaktifkan** (isi alasan, misalnya "data uji").
- File file akun uji lokal (tidak masuk Git) berisi password akun uji. Jangan di-commit.
