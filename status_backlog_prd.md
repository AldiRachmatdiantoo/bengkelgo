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
| ⚠️ Selesai dengan catatan | 3 | **103** (keputusan istilah di PRD), **106** (uji login Google sungguhan), **407** (uji alur lengkap di produksi) |
| ❌ Belum selesai | 0 | – |

Total ada **27 PBI** (Sprint 1: 8, Sprint 2: 6, Sprint 3: 6, Sprint 4: 7). PBI-306 (k6 stress test) sudah **dijalankan dan lolos** hari ini. Detailnya ada di bagian [Hasil PBI-306](#hasil-pbi-306-k6-stress-test).

---

## Daftar tindakan yang butuh tim (ringkasan)

Satu tempat untuk semua hal yang **tidak bisa diselesaikan tanpa tim**, dengan tautan ke detailnya. Diperbarui 20 Oktober 2026 (setelah Paket A & B backend).

| # | Perlu dari tim | Jenis | Detail |
|---|---|---|---|
| 1 | ~~Google Cloud OAuth Client ID untuk login Google~~ ✅ diisi di Render & Vercel 21 Okt; tombol tampil dan Google menerima permintaan. Sisa: uji login sungguhan dengan akun Google (akun baru & akun lama) | Akun | [PBI-106](#pbi-106-google-oauth-20) |
| 2 | ~~Isi SMTP Gmail + App Password~~ ✅ selesai 20 Okt, email pengingat terkirim | Akun | [PBI-404](#pbi-404-cron-pengingat-email) |
| 3 | ~~Deploy gratis~~ ✅ live 20 Okt (Vercel + Render + Supabase), Gmail API & ping cron-job.org ✅ (dikonfirmasi 21 Okt). Detail awal: akun GitHub, Supabase, Render, Vercel, Google Cloud (Gmail API), cron-job.org. Kode & panduan ✅ siap 20 Okt: [docs/deploy-gratis.md](docs/deploy-gratis.md) | Akun & infrastruktur | [PBI-407 B](#b-deploy-frontend-ke-vercel) |
| 4 | Izin & lingkungan uji untuk pen-test OWASP ZAP | Izin | [Pekerjaan siap dikerjakan B](#pekerjaan-siap-dikerjakan-butuh-tindakan-tim) |
| 5 | Keputusan sistem pembayaran: bayar tunai, payment gateway, wajib bayar dulu (RRN/nama pengirim ✅ 20 Okt) | Keputusan + backend | [Catatan sistem pembayaran](#catatan-sistem-pembayaran-pbi-401--pbi-402) |
| 6 | ~~Set `TRUST_PROXY` sesuai jumlah proxy di produksi~~ ✅ `TRUST_PROXY=4` di Render (diukur 20 Okt) | Konfigurasi | [Temuan nomor 2](#temuan-selama-pengujian) |
| 7 | Sisa perubahan backend desain Stitch yang **butuh keputusan/konten**: BE-3 kategori layanan (daftar kategori), BE-5 tahan slot + bayar dulu (12.2), BE-6 pit (12.3), BE-7 lacak mekanik live, BE-10 add-on, BE-11 promo, BE-12 komisi (12.4), BE-17 dokumen mitra; sebagian BE-2 (fasilitas, sertifikasi, kota). ✅ Sudah 20 Okt: BE-1, BE-4, BE-8, BE-9 (kategori), BE-13, BE-14, BE-16, foto & jadwal dari BE-2, dan BE-lain (invoice/RRN, alasan batal, pilih mekanik, reschedule, statistik, riwayat status, kisaran/ubah harga SOS, notifikasi server, hapus layanan, balas ulasan) | Keputusan + backend | [Paket A](#paket-a-backend-20-oktober-2026-frontend-tidak-diubah), [Paket B](#paket-b-backend-20-oktober-2026-frontend-tidak-diubah), [bagian 13](#13-daftar-perubahan-backend-gabungan) |
| 8 | ~~Bug skema PATCH layanan/mekanik~~ ✅ diperbaiki di backend 20 Okt (Paket A) | Backend | [Paket A](#paket-a-backend-20-oktober-2026-frontend-tidak-diubah) |
| 9 | Integrasi pihak ketiga (VA, OCR, ETA, wallet pass, OTP WA; geocoding ✅ 21 Okt) | Integrasi | [Lampiran 1, bagian 14](#14-integrasi-pihak-ketiga-int) |
| 10 | Konten asli: logo, foto bengkel/mekanik, nomor hotline & WA CS, FAQ resmi, S&K, kebijakan privasi/pembatalan/garansi, daftar kota | Konten | [Lampiran 1, Lampiran A](#lampiran-a-aset-yang-harus-disiapkan-tim) |
| 11 | Keputusan desain/bisnis: warna primer & SOS di PRD 3.1, alur bayar (12.2), slot per jam (12.3), komisi 5% (12.4), klaim marketing (12.5) | Keputusan | [Lampiran 1, bagian 12](#12-konflik-yang-harus-diputuskan-tim); catatan di [prd.md](prd.md) 3.1 |
| 12 | Fitur sparepart masuk cakupan atau tidak | Keputusan + backend | [Lampiran 2](#lampiran-2-keputusan-dari-review-flowchart-booking) |
| 13 | Transaction manager: terima pendekatan helper atau minta middleware | Keputusan | [PBI-103](#pbi-103-transaction-manager-middlewares) |
| 14 | ~~Aktifkan lagi bengkel uji "Bengkel Uji Desain Stitch"~~ tidak relevan lagi: database lokal dikosongkan 21 Okt (lihat Tahap 21 Oktober) | Data uji | – |
| 15 | ~~Dua temuan backend 19 Okt (penugasan mekanik vs SOS, refund pesanan lunas)~~ ✅ diperbaiki 20 Okt atas persetujuan tim | Backend | [Temuan nomor 4–5](#temuan-selama-pengujian) |
| 16 | ~~Potong otomatis QRIS~~ ❌ tidak dikerjakan (keputusan tim 21 Okt): gambar QRIS tetap disimpan utuh | Keputusan | – |
| 17 | Pengamanan penyalahgunaan booking: ~~batas booking aktif, batas per bengkel per hari, pembatas kecepatan, verifikasi email~~ ✅ selesai 21 Okt; sisa: keputusan wajib bayar/DP (butuh keputusan tim) | Keputusan | [Pengamanan penyalahgunaan booking](#pengamanan-penyalahgunaan-booking-dicatat-20-okt-2026) |

**Sudah dikerjakan tanpa tim (19 Okt 2026, frontend saja, backend tidak diubah):** ubah layanan lengkap (nama/deskripsi/harga/durasi), cek + kompres foto sebelum unggah, pesan error berbahasa Indonesia, alur login Google PKCE (tombol tersembunyi sampai Client ID diisi), tes lintas browser (WebKit/Safari desktop & iPhone), tes tata letak 375px untuk semua portal. Rinciannya di [Pekerjaan frontend 19 Oktober](#pekerjaan-frontend-19-oktober-2026-tanpa-mengubah-backend).

**Backend 20 Okt (Paket A & B, frontend tidak diubah):** lihat [Paket B](#paket-b-backend-20-oktober-2026-frontend-tidak-diubah) dan [Paket A](#paket-a-backend-20-oktober-2026-frontend-tidak-diubah). ERD: [docs/erd.md](docs/erd.md).

**Tahap 20 Okt 2026 (semua yang bisa dikerjakan tanpa tim):** ✅ selesai, lihat [Tahap 20 Oktober](#tahap-20-oktober-2026-frontend-paket-a--b-aksesibilitas-bundle-visual-regression-akses-admin-pengingat-h-2).

**Tahap 21 Okt 2026:** ✅ pengaman booking, batas login per email, repository 6 fitur, antrean email di database, verifikasi email, pencarian lokasi + alamat dari titik, bilah bawah HP lebih ringkas, bahasa non-teknis di tampilan. Lihat [Tahap 21 Oktober](#tahap-21-oktober-2026).

**Lanjutan 21 Okt (sore):**
- ✅ **Email pesanan:** dibatalkan bengkel (alasan + dana dikembalikan), dibatalkan pelanggan, pembayaran lunas (invoice), pesanan selesai (ajakan ulasan); semua email pelanggan memakai satu tampilan (`common/mail/layout.ts`). Di-push.
- ✅ **Login Google** dipasang di produksi: `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI` di Render, `VITE_GOOGLE_CLIENT_ID` di Vercel. Dicek: tombol tampil, Google membuka halaman login tanpa error. Belum diuji sampai masuk dengan akun Google sungguhan.
- ❌ **Potong otomatis QRIS** tidak dikerjakan (keputusan tim).
- ✅ **Script reset database** `npm run db:reset`: mengosongkan semua data kecuali akun admin (atau hanya `--only-admin=<email>`), mengulang nomor pesanan/invoice, menghapus semua file unggahan (folder lokal atau Supabase Storage); hanya jalan dengan `--confirm=<host database>`.
- ✅ **Database lokal dikosongkan** 21 Okt: dari 329 akun / 97 bengkel / 392 pesanan menjadi 1 akun (admin utama); 164 file unggahan dihapus.
- ⏳ **Database produksi belum dikosongkan** (dicek 21 Okt lewat `/stats/public`: 2 bengkel, 5 pelanggan, 2 pesanan selesai). Kredensial Supabase hanya ada di Render, jadi dijalankan pemilik akun dari laptop:
  `DATABASE_URL="<pooler URI>" DATABASE_SSL=true STORAGE_DRIVER=supabase SUPABASE_URL="<url>" SUPABASE_SERVICE_ROLE_KEY="<key>" npm run db:reset` (cek), lalu tambahkan `-- --confirm=<host> [--only-admin=<email>]`. Tidak bisa dibatalkan (Supabase Free tanpa backup yang bisa dipulihkan).

- ✅ **Performa (PageSpeed 21 Okt: HP 70, desktop 86; LCP HP 15,1 dtk):** penyebab utama font ikon Material Symbols 2,3 MB (73% unduhan beranda, `display=block` menahan tampilan). Kini hanya ikon yang dipakai dan dua ketebalan yang dipakai: **±40 KB**; daftar ikon diisi otomatis saat build (`vite.config.ts`), dijaga `e2e/icons.spec.ts` (33 halaman, semua ikon tampil sebagai ikon). Juga: meta description, `robots.txt` (sebelumnya ikut dijawab dengan halaman web = 21 error), urutan judul footer.
- ✅ **Hasil setelah deploy (PageSpeed HP, 21 Okt):** skor 70 → 77 (subset ikon) → **93** (font dari server sendiri); FCP 2,9 → 2,2 dtk, LCP 15,1 → 2,7 dtk, TBT 0 md, CLS 0,058 (hijau, sedikit naik karena font huruf kini tampil dengan font cadangan sesaat), aksesibilitas 94 → 100; unduhan beranda ±3,1 MB → ±0,83 MB. Sisa saran kecil: JavaScript tak terpakai ±87 KB.
- ✅ **Font dari server sendiri:** sisa penghambat tampilan pertama adalah 2 CSS Google Fonts (±750 md masing-masing, karena sambungan baru ke dua server Google). Kini Plus Jakarta Sans & Inter dari `@fontsource` (ikut CSS web) dan font ikon diunduh saat build lalu dikirim dari Vercel (preload); 0 permintaan ke Google saat halaman dibuka (juga lebih baik untuk privasi pengunjung).
- ✅ **Foto lebih ringan (21 Okt):** foto bengkel kini disimpan sebagai WebP: versi tampil maks. 1600 px dan versi kecil 640 px untuk kartu & deretan foto (`?size=sm`); foto teknisi 480 px; data lokasi kamera ikut dibuang. Foto yang diunggah sebelumnya (mis. PNG 779 KB di produksi) dikonversi otomatis saat pertama dibuka, sekali saja walau banyak pengunjung bersamaan, lalu file aslinya dihapus. Gambar rusak ditolak dengan pesan jelas (bukan error server). Cache foto 30 hari. Migrasi `009_photo_variants.sql`; tes `photo-variants.int.test.ts`.
- ✅ **Foto tampil sebelum bengkel disetujui (21 Okt):** di portal pemilik, foto bengkel dan foto teknisi sebelumnya muncul sebagai ikon rusak selama bengkel menunggu persetujuan, karena alamat publik hanya untuk bengkel yang sudah disetujui. Kini portal memuat foto lewat alamat khusus pemilik (wajib login, tidak di-cache bersama): `GET /workshops/photos/:id/file?size=sm` dan `GET /workshops/mechanics/:id/photo`. Pemilik lain tidak bisa membukanya, dan publik tetap baru bisa melihat setelah disetujui. Tes: integration + E2E; Postman 92 request.
- ✅ **Foto bengkel (21 Okt):** kartu bengkel di daftar kini memakai foto sampul (`GET /workshops` mengirim `cover_photo_url`; tanpa foto tetap ilustrasi biru), dan halaman detail menampilkan foto sampul selebar kartu dengan deretan foto kecil untuk berganti foto (sebelumnya foto tampil kecil di kiri). Kotak ikon toko disembunyikan bila ada foto.
- ✅ **Lupa / reset password lewat email (21 Okt):** tautan "Lupa password?" di halaman masuk → isi email → email berisi tombol "Buat password baru" (sekali pakai, 30 menit, disimpan sebagai hash; jawaban sama untuk email tak terdaftar; batas per IP & 5/jam per email) → password baru (aturan sama dengan daftar) → semua sesi lama dicabut, email dianggap terverifikasi, dan email pemberitahuan "Password sudah diganti" dikirim. Akun Google bisa memakainya untuk membuat password. Migrasi `008_password_reset.sql`. Diuji: integration 5, E2E alur lengkap di browser (tautan diambil dari antrean email lokal), Postman 90/90.
- ✅ **"Web terasa berat" (dicek 21 Okt):** API Render cepat (±0,15–0,2 dtk per permintaan); halaman di HP simulasi (CPU 4× lebih lambat, 4G) termuat 1,2–4,2 dtk dan scroll 60 fps. Yang diperbaiki untuk HP sungguhan: denyut tombol SOS kini animasi GPU (sebelumnya digambar ulang tiap frame selama halaman terbuka, ditandai PageSpeed) dan mati bila "kurangi gerakan" aktif; efek blur kaca di header dan bilah kirim SOS hanya di layar besar (di HP latar putih solid). Catatan: halaman berpeta (Cari Bengkel, SOS) memuat library peta ±153 KB + tile OpenStreetMap ±140–220 KB; portal owner memeriksa SOS & notifikasi tiap 5 dtk (±27 permintaan/menit).
- ✅ **Warna SOS** diganti `#CC4410` (hover `#B33B0E`) atas persetujuan tim: tulisan putih 4,8:1 (lolos WCAG AA, sebelumnya 3,4:1); pengecualian aksesibilitas dihapus. Badge tab aktif di Cari Bengkel kini putih bertulisan biru.

## Fitur Akun Saya / profil pengguna (26 Okt 2026)

Permintaan tim 26 Okt: fitur profil pengguna. Dikerjakan di branch `main`. ✅ **Selesai 26 Okt** (belum di-push).

| # | Bagian | Isi | Status |
|---|---|---|---|
| 1 | Halaman **Akun Saya** | Pelanggan `/akun`, pemilik bengkel `/owner/akun`, admin `/admin/akun`; menu "Akun saya" di menu avatar (dan sidebar portal). Akun tamu hanya bagian data diri. | ✅ |
| 2 | Data diri | Ubah nama dan nomor WhatsApp (aturan sama dengan daftar). | ✅ |
| 3 | Foto profil | Unggah/ganti/hapus; dikecilkan di browser lalu disimpan WebP 256 px tanpa data lokasi; tampil di avatar header. Hanya pemilik akun yang bisa membukanya. | ✅ |
| 4 | Ganti email | Kode 6 angka dikirim ke **email baru** (15 menit, maks. 5 kali salah); butuh password saat ini bila akun punya password; email lama diberi tahu. Juga jalan keluar untuk yang salah ketik email saat daftar (kode tidak pernah sampai). | ✅ |
| 5 | Password | Ganti password (wajib password lama) atau **buat password** untuk akun yang daftar lewat Google; perangkat lain dikeluarkan, email pemberitahuan dikirim. | ✅ |
| 6 | Perangkat yang sedang masuk | Daftar perangkat (browser & sistem, terakhir aktif), keluarkan satu perangkat atau semua perangkat lain. | ✅ |
| 7 | Info akun | Bergabung sejak, status email, tersambung dengan Google atau tidak. | ✅ |
| 8 | Hapus akun (pelanggan) | Sesuai hak di Kebijakan Privasi. Syarat: tidak ada pesanan yang belum selesai; konfirmasi password (atau ketik `HAPUS` untuk akun Google). Data pribadi dianonimkan (nama jadi "Pengguna dihapus", email/WA/password/foto/kendaraan/notifikasi dihapus); riwayat pesanan & ulasan tetap untuk catatan bengkel; email bisa dipakai daftar lagi. Pemilik bengkel & admin tidak bisa menghapus sendiri (hubungi admin). Tercatat di audit log. | ✅ |
| 9 | Nomor WhatsApp akun Google | Ditemukan tim 27 Okt: login Google tidak membawa nomor telepon, sehingga pelanggan bisa booking/SOS tanpa nomor dan bengkel tidak bisa menghubungi. Kini: kolom "Nomor WhatsApp Anda" muncul langsung di formulir booking dan SOS bila akun belum punya nomor (disimpan ke akun, cukup sekali); pengingat di bawah header untuk pelanggan tanpa nomor; peringatan di Akun Saya; server menolak booking/SOS tanpa nomor (`PHONE_REQUIRED`). Tes: integration + E2E booking akun tanpa nomor. | ✅ |

**Teknis:** migrasi `010_user_profile.sql` (`users.photo_path`, `users.deleted_at`, tabel `email_changes`); fitur backend baru `features/account` (schema → routes → controller → service → repository), dipasang di `/auth/me/...` agar cookie sesi ikut terkirim; batas `accountLimiter` 10/15 menit per akun untuk aksi berpassword. Frontend: `pages/shared/AccountPage.tsx`, avatar header memakai foto profil, tautan "Salah ketik email?" di halaman verifikasi. Keluar dengan sengaja (termasuk setelah hapus akun) kini selalu kembali ke beranda, bukan ke halaman masuk. Script `db:reset` ikut mengosongkan foto profil admin. Admin tidak bisa mengaktifkan lagi akun yang dihapus pemiliknya (`ACCOUNT_DELETED`).

**Tes:** integration `account.int.test.ts` 8 (total backend 149/149), Vitest 44/44 (+ nama perangkat), E2E `account.spec.ts` 2 (alur lengkap pelanggan: data diri, foto, password, ganti email dengan kode dari antrean email lokal, perangkat, hapus akun; portal pemilik), a11y + ikon + layar 375px untuk 3 halaman baru, fitur backlog 7/7, visual 12/12; Postman/Newman **106/106** (folder baru "12. Akun Saya"). ERD: 21 tabel, 30 relasi.

**Yang tersisa tanpa tim:** tidak ada pekerjaan kode yang tertunda. Sisanya butuh tindakan, izin, keputusan, atau konten (tabel di atas).

**Tidak bisa diselesaikan di laptop ini:** tes Firefox (build Firefox Playwright gagal dijalankan, masalah runtime Windows).

## Tahap 21 Oktober 2026

Disetujui tim: nomor 2, 3, 4, 5, 7, 8, 9, 10 (dan 11 setelah penjelasan, lihat di bawah) dari daftar usulan 21 Okt, plus permintaan tampilan HP dan bahasa non-teknis.

| Bagian | Isi | Bukti |
|---|---|---|
| Pencarian lokasi | Kotak cari tempat (Nominatim, cadangan Photon) di Cari Bengkel, SOS, Daftar Bengkel, Profil Bengkel; **alamat dari titik** (`GET /geocode/reverse`) di bawah peta dengan tombol "Pakai sebagai alamat" / "Salin ke patokan". Sudah di-push dan live. | unit geocode 10, E2E `place-search.spec.ts` |
| Pengaman booking | Maks. **3 booking belum selesai** per pelanggan (`ACTIVE_BOOKING_LIMIT`), **1 booking aktif per bengkel per hari** (`DAILY_WORKSHOP_LIMIT`, juga saat ganti jadwal), maks. **5 percobaan booking per jam per akun** (`BOOKING_RATE_LIMITED`, dihitung per akun, bukan per IP). Dicek di dalam transaksi dengan kunci per pelanggan, jadi request bersamaan tidak bisa menembus batas. Angka bisa diubah lewat `BOOKING_MAX_ACTIVE`, `BOOKING_MAX_PER_HOUR`. | integration `booking-limits.int.test.ts` (5 request serentak → tepat 3 lolos) |
| Celah IP login | Batas percobaan login **per email** (10 per 15 menit, email di-hash) di samping per IP, sehingga memalsukan `X-Forwarded-For` langsung ke alamat Render tidak bisa dipakai menebak password satu akun. | integration `auth.int.test.ts` |
| Repository | admin, notification, payment, review, stats, vehicle kini punya `*.repository.ts`; semua fitur backend berpola schema → routes → controller → service → repository. Perilaku tidak berubah. | semua tes backend |
| Antrean email | Migrasi `006_email_outbox.sql`: email booking dan pengingat H-1/H-2 ditulis ke `email_outbox` dalam transaksi yang sama, langsung dikirim, dan dicoba ulang oleh job tiap menit (15 dtk → 1 mnt → 5 mnt → 15 mnt → 1 jam → 3 jam, lalu `FAILED`). API restart tidak menghilangkan email; aman untuk beberapa replica. Data dihapus setelah 30 hari. Halaman admin Kesehatan Sistem menampilkan "Antrean email". | integration `booking-email.int.test.ts` |
| Verifikasi email | Migrasi `007_email_verification.sql`: akun baru (form) menerima kode 6 angka (HMAC, 15 menit, maks. 5 kali salah, kirim ulang 1×/menit). **Booking butuh email terverifikasi** (`EMAIL_NOT_VERIFIED`); SOS dan akun tamu tidak terdampak; akun lama dan login Google otomatis terverifikasi. Frontend: halaman `/verifikasi-email` setelah daftar, strip pengingat (tidak menempel), booking mengarahkan ke halaman kode dengan pilihan tetap tersimpan. Admin bisa **menandai email terverifikasi** (Admin → Pengguna, tercatat di audit log). | integration `email-verification.int.test.ts`, E2E alur daftar |
| Tampilan HP | Bilah kirim SOS jadi satu baris 57 px (sebelumnya ±130 px), tombol SOS mengambang 48 px, header 56 px; kartu bengkel di halaman booking dirapikan. Desktop tidak berubah. | visual regression (baseline HP diperbarui) |
| Bahasa non-teknis | Istilah database, server, API, slot/kuota, anti-overbooking, koordinat, radar, realtime diganti bahasa sehari-hari di semua halaman pelanggan dan pemilik bengkel. Halaman admin Kesehatan Sistem tetap teknis. | E2E + visual |
| Postman | 88 request (cari lokasi, alamat dari titik, verifikasi email, kirim ulang kode, admin tandai email). Newman 88/88. | `docs:postman:verify` |

**Hasil tes akhir 21 Okt:** backend unit 61/61, integration 61/61; frontend Vitest 42/42, typecheck lolos; Playwright journeys + geolocation + pencarian lokasi 11/11, fitur backlog + a11y 19/19, a11y login + 375px + lintas browser 16 lolos (6 dilewati sengaja), visual 12/12 stabil 2×; Postman/Newman 88/88. ERD diperbarui: 19 tabel, 28 relasi.

**✅ Di-push dan live 21 Okt** (migrasi 006 dan 007 berjalan otomatis di Render).

**✅ Nomor 11 (foto HEIC iPhone) selesai 21 Okt, disetujui tim:**
- **Di browser (utama):** Chrome/Android/Windows yang tidak bisa membuka HEIC memuat decoder `heic-to` (WebAssembly, ±793 KB gzip, file terpisah yang hanya diunduh saat pengguna memilih foto HEIC), lalu foto diperkecil jadi JPEG < 2 MB seperti foto lain. Safari tetap memakai kemampuan bawaannya. Lisensi `heic-to`/libheif: LGPL-3.0 (dimuat apa adanya sebagai file terpisah).
- **Di server (cadangan):** `heic-decode` + `sharp` 0.35.5 (versi yang sudah menambal celah keamanan libvips/libheif). Diukur: foto 12 MP butuh puncak ±460 MB dan decoder tidak mengembalikan memorinya, jadi decode berjalan di *worker thread* yang dimatikan setelahnya (memori kembali ke ±120 MB), satu per satu, dan ditolak di atas `HEIC_MAX_MEGAPIXELS`. **Mati secara default (0)**, juga di Render (`render.yaml`) karena RAM 512 MB; di sana semua konversi terjadi di browser. Nyalakan (mis. `13`) hanya di server dengan RAM cukup.
- Diuji: unit `heic-upload.test.ts` 7/7 (konversi 12 MP → 1600 px < 2 MB, QRIS 2000 px, batas megapiksel, mati/nyala, file rusak, video menyamar), E2E Chromium mengunggah foto iPhone 12 MP lewat Pengaturan Bengkel → dikonversi di browser → diterima API, dicek juga di dalam container Docker.

**Mode gelap portal admin & owner (21 Okt):** tombol bulan/matahari di top bar, default terang, pilihan disimpan per browser, halaman publik selalu terang. Token warna permukaan/garis/teks diganti di mode gelap; warna merek yang juga dipakai sebagai latar tombol hanya diterangkan saat dipakai sebagai teks, sehingga tombol putih-di-biru tetap terbaca. E2E `backlog-features` (saklar tersimpan, publik tetap terang).

## Perbaikan form & riwayat dibatalkan (20 Okt 2026)

- **"Lengkapi dulu" di setiap form berisian banyak** (komponen `MissingFields` di `components/ui`): daftar isian wajib yang belum diisi atau formatnya belum benar, ditampilkan di dekat tombol kirim; setiap item bisa diklik untuk lompat ke kolomnya. Dipasang di booking, SOS (di HP: ringkasan satu baris di bilah bawah + daftar lengkap di dalam form), daftar akun pelanggan, daftar bengkel, profil bengkel, tambah/ubah layanan, tambah/ubah teknisi, kendaraan, tambah admin, dan unggah bukti bayar. Form yang tombolnya dinonaktifkan selalu menampilkan daftar; form lain menampilkannya setelah pengguna menekan simpan. Aturan password dan nomor WhatsApp disamakan dengan backend (`utils/formChecks.ts`).
- **Riwayat dibatalkan di halaman Semua Pesanan (owner)** dipindah dari bawah daftar ke atas, tepat di bawah filter, dengan tombol "Kembali ke semua pesanan". Di halaman pesanan pelanggan, "Riwayat dibatalkan" sudah berupa filter di atas.
- Diuji: Vitest 40/40, E2E journeys + fitur backlog + a11y (desktop & HP) lolos, visual regression 12/12 (baseline SOS-HP dan daftar bengkel diperbarui karena memang berubah), dicek manual di browser.

## Pencarian lokasi (geocoding) — ✅ selesai 21 Okt 2026

Kotak "cari lokasi" seperti Google Maps (mis. "Margonda Depok", "Stasiun Bogor") untuk memudahkan mencari bengkel, **gratis** (item 9 integrasi pihak ketiga, bagian geocoding). Di-commit dan di-push 21 Okt (Render deploy backend + Vercel deploy frontend otomatis).

**Keputusan:**
- Sumber data OpenStreetMap, gratis tanpa akun/kartu: **Nominatim utama** (±0,5 detik dari Indonesia), **Photon cadangan** (±5,5 detik, server di Jerman). Google Places tidak dipakai (berbayar, butuh billing/kartu).
- **Cari saat Enter / tombol "Cari"**, bukan per ketikan, karena kebijakan Nominatim melarang autocomplete.
- Selalu lewat backend (bukan langsung dari browser): User-Agent `BengkelGo/1.0 (+APP_URL)`, Nominatim maks. 1 request/detik (antrean), cache 15 menit (maks. 500 entri, tidak bocor memori), pembatas `geocode` 40 request/menit per IP, hanya wilayah Indonesia.

**Isi:**
- Backend `backend/src/features/geocode/` → `GET /api/v1/geocode/search?q=…&limit=…&lat=&lng=` (publik, min. 3 huruf). Bila kedua layanan mati: 503 `GEOCODE_UNAVAILABLE` (pesan Indonesia di frontend).
- Frontend `components/map/PlaceSearch.tsx` (combobox aksesibel, Enter tidak mengirim form induk, panah atas/bawah, atribusi OpenStreetMap), dipasang di: **Cari Bengkel** (baris "Cari bengkel di sekitar…" + "Pakai GPS saya", label "Menampilkan bengkel di sekitar …", hapus lokasi), **SOS**, **Daftar Bengkel**, dan **Profil Bengkel** (di atas peta; peta pindah ke titik yang dipilih, titik bisa digeser dengan klik peta).

**Diuji 21 Okt:** typecheck frontend & backend; backend unit 56/56 (5 tes geocode) dan integration 50/50; Vitest 42/42; E2E journeys + geolocation 8/8, fitur backlog + a11y 18/18, a11y login + 375px + lintas browser 16 lolos (6 dilewati sengaja), E2E baru `e2e/place-search.spec.ts` 2/2 (respons API tiruan: cari hanya saat Enter, pilih hasil memindah titik, Enter di form SOS tidak mengirim permintaan, pesan saat layanan mati); visual regression 12/12 stabil 2× (baseline SOS & Daftar Bengkel desktop/HP diperbarui karena ada kotak baru). Dicoba di browser terhadap Docker lokal: "Margonda Depok" (Cari Bengkel) dan "Stasiun Bogor" (SOS) menghasilkan lokasi yang benar.

**Tambahan 21 Okt (lanjutan):**
- **Alamat dari titik (reverse geocoding):** `GET /api/v1/geocode/reverse?lat=&lng=` (publik, pembatas & cache sama; titik ±10 m berbagi cache; `null` bila titik di laut/luar Indonesia). Nama OSM yang berisi alamat lengkap dipendekkan ke bagian pertama agar alamat tidak dobel.
- Frontend `components/map/AddressHint.tsx`: "Perkiraan alamat: …" di bawah peta. **Daftar Bengkel** & **Profil Bengkel**: tombol "Pakai sebagai alamat" mengisi kolom Alamat. **SOS**: tombol "Salin ke patokan" (maks. 300 karakter). **Cari Bengkel**: label lokasi GPS menyebut nama tempatnya.
- **Postman:** request "Search Place (geocoding)" dan "Address of a Point (reverse geocoding)" di folder 4; koleksi kini 85 request, Newman 85/85 lolos dengan contoh respons asli.
- Diuji: backend unit 61/61 (10 tes geocode), integration 50/50; Vitest 42/42; E2E journeys + geolocation + pencarian lokasi 11/11 (tes baru: alamat titik mengisi kolom alamat, dengan respons tiruan), fitur backlog + a11y 18/18, a11y login + 375px + lintas browser 16 lolos (6 dilewati sengaja), visual 12/12; dicoba di browser (desktop & HP 375px, tanpa geser ke samping).

## Cek database & relasi lewat DBeaver (dicatat 20 Okt 2026)

**Koneksi** (New Database Connection → PostgreSQL):

| | Lokal (Docker di laptop) | Produksi (Supabase) |
|---|---|---|
| Host | `localhost` | host dari URI **Session pooler** (`aws-…pooler.supabase.com`) |
| Port | `5433` | `5432` |
| Database | `bengkel` | `postgres` |
| Username | `bengkel` | `postgres.ocivvfrsienwlwmjqcsx` |
| Password | `bengkel` (bawaan `docker-compose.yml`) | password database Supabase, **jangan ditulis di file ini / di repo** |
| SSL | tidak | **Use SSL**, mode `require` |

**Melihat relasi:**
- Seluruh database: Databases → `bengkel`/`postgres` → Schemas → klik kanan **`public`** → **View Diagram** (bisa diekspor jadi gambar). Abaikan `spatial_ref_sys` (PostGIS) dan `schema_migrations`.
- Satu tabel: buka tabelnya → tab **Properties → Foreign Keys** (tabel ini menunjuk ke mana), **References** (tabel mana yang menunjuk ke sini), atau tab **ER Diagram**.
- Hasil harus sama dengan [docs/erd.md](docs/erd.md) / [docs/erd-quickdbd.txt](docs/erd-quickdbd.txt): 20 tabel, 29 relasi (sejak migrasi 008).

**Hati-hati di Supabase:** cukup untuk melihat. Jangan edit/hapus data lewat DBeaver; paket gratis Supabase tidak punya backup yang bisa dipulihkan sendiri.

## Izin lokasi GPS (20 Okt 2026)

Keluhan penguji: "lokasi ditolak". Website **tidak bisa** memunculkan lagi pop-up izin resmi browser setelah pengguna menekan Tolak/Blokir, dan tidak bisa menyalakan lokasi HP. Perbaikan di `hooks/useGeolocation.tsx` (SOS, detail bengkel, cari bengkel):
- **Pop-up penjelasan sebelum pop-up resmi** (sekali per browser, hanya bila izin belum pernah diputuskan): menjelaskan kegunaan lokasi dan meminta memilih "Izinkan", lalu tombol "Lanjut" memicu pop-up resmi. Tujuannya mengurangi penolakan tidak sengaja.
- **Bila izin sudah diblokir**: dialog langkah membuka izin sesuai perangkat (iPhone Safari, Android Chrome, desktop) + tombol "Coba lagi"; status izin dicek dulu (Permissions API) sehingga panduan langsung muncul tanpa percobaan yang pasti gagal.
- **Browser dalam aplikasi** (WhatsApp, Instagram, Facebook, LINE, TikTok, WebView Android): saran membuka di Chrome/Safari + tombol salin link.
- **GPS lemah di dalam ruangan**: bila akurasi tinggi gagal 10 detik, otomatis mencoba lagi dengan akurasi biasa / lokasi terakhir (maks. 5 menit).
- Pilih titik di peta tetap jadi cadangan. Diuji: Vitest (deteksi perangkat/browser), E2E baru `e2e/geolocation.spec.ts`, journeys, a11y, visual; dicek di browser emulasi HP.

## Pengamanan penyalahgunaan booking (dicatat 20 Okt 2026)

**Kondisi sekarang:** satu akun pelanggan bisa membuat banyak booking (mis. 20 dalam 5 menit) selama slotnya berbeda. Pengaman yang sudah ada hanya: wajib login sebagai CUSTOMER, tidak boleh 2 booking di slot yang sama (`DUPLICATE_BOOKING`), maksimal 30 hari ke depan sesuai jam buka/libur, dan pembatas request umum 300/menit per IP (tidak menahan 20 booking).

**Dampak bila diisengi:** kuota slot bengkel terborong sehingga pelanggan asli masuk daftar tunggu; owner kebanjiran notifikasi palsu; tiap booking memicu email konfirmasi + pengingat H-1 + H-2 sehingga kuota Gmail (±500/hari) bisa habis, apalagi digabung akun palsu (pendaftaran belum memverifikasi email); statistik dan laporan ikut kotor. Penanganan manual sementara: owner/admin membatalkan booking palsu, admin menonaktifkan akunnya (Admin → Pengguna).

**Rencana perbaikan:**

| # | Perbaikan | Jenis | Catatan |
|---|---|---|---|
| 1 | **Maksimal booking aktif per pelanggan** (usul 3 booking yang belum selesai sekaligus) | Backend, tanpa perubahan DB | Paling efektif; cek di `bookingService.create` dalam transaksi yang sama, kode error baru mis. `ACTIVE_BOOKING_LIMIT` + pesan Indonesia di frontend |
| 2 | **Maksimal 1 booking aktif per bengkel per hari** untuk pelanggan yang sama | Backend, tanpa perubahan DB | Melengkapi `DUPLICATE_BOOKING` (sekarang hanya per slot) |
| 3 | **Pembatas kecepatan booking** (usul maks. 5 booking per jam per akun) | Backend, tanpa perubahan DB | Memakai rate limiter yang sudah ada (Redis/memori), kunci per akun |
| 4 | **Verifikasi email saat daftar** (kode 6 digit) | Backend + **DB** (kolom `users.email_verified_at` + tabel kode verifikasi, migrasi 006) + frontend | Mencegah banyak akun palsu; akun tamu tidak terdampak |
| 5 | **Wajib bayar dulu / DP** sebelum slot dikunci | **Keputusan tim** + backend | Paling kuat; terkait item 5 dan 11 (alur bayar 12.2) |

**✅ Nomor 1–4 selesai 21 Okt** (lihat [Tahap 21 Oktober](#tahap-21-oktober-2026)); angka batas bisa diubah lewat env. Nomor 5 menunggu keputusan bisnis.

---

## Status semua PBI

| PBI | Isi | Status |
|---|---|---|
| 101 | Template Express TS berlapis | ✅ |
| 102 | Docker Compose PostGIS, Redis, NGINX | ✅ |
| 103 | Migrasi, indeks, Transaction Manager | ⚠️ [lihat catatan](#pbi-103-transaction-manager-middlewares) |
| 104 | Rate limit Redis sliding window + Helmet | ✅ |
| 105 | JWT + refresh token rotation | ✅ |
| 106 | Google OAuth 2.0 | ⚠️ terpasang di produksi 21 Okt, tinggal uji login sungguhan [lihat catatan](#pbi-106-google-oauth-20) |
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
| 407 | E2E Playwright/Cypress + deploy Vercel | ⚠️ E2E ✅, deploy ✅ live 20 Okt, Gmail API ✅ terisi di Render, ping cron-job.org ✅ (dikonfirmasi tim 21 Okt) (sisa: uji produksi) [lihat catatan](#pbi-407-e2e-testing--deploy-vercel) |

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
- **Tidak pernah mengirim ke domain contoh/uji** (`example.com/.org/.net`, `*.test`, `*.example`, `*.invalid`, `*.localhost`, `*.local`; `isUndeliverable` di `config/mailer.ts`): hanya dicatat di log. Latar: tes E2E di Docker lokal (yang memakai Gmail asli) membuat booking dengan email `@example.test`, sehingga Gmail pengirim menerima banyak email gagal "Address not found" (20 Okt). Juga mencegah email gagal dari pendaftaran iseng memakai alamat contoh di produksi.
- Kalau gagal kirim (mis. DNS/SMTP sesaat bermasalah), dicoba ulang otomatis setelah 15 detik, 1 menit, dan 5 menit. ✅ Sejak 21 Okt percobaan ulang memakai antrean di database (`email_outbox`), jadi tidak hilang saat API restart; jeda 15 detik sampai 3 jam.
- ✅ 21 Okt: email juga dikirim saat **pesanan dibatalkan bengkel** (alasan + info dana dikembalikan), **pelanggan membatalkan** (konfirmasi), **pembayaran lunas** (total + nomor invoice) dan **pesanan selesai** (total, status bayar, ajakan ulasan); `features/order/order.email.ts`, tampilan bersama `common/mail/layout.ts`, lewat antrean email. Akun tamu tetap hanya notifikasi di aplikasi. Diuji di `tests/integration/booking-email.int.test.ts`.

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

**Kerapian arsitektur (20 Okt, PBI-101):** setiap fitur backend kini punya `*.controller.ts` (sebelumnya hanya `auth`); file `*.routes.ts` hanya berisi URL + middleware, skema validasi yang tadinya di routes dipindah ke `*.schema.ts` (admin, notification, payment, review). Perilaku tidak berubah: backend 99/99 tes dan Postman 83/83 lolos. ✅ 21 Okt: keenam fitur yang tersisa (admin, notification, payment, review, stats, vehicle) kini juga punya `*.repository.ts`.

**✅ LIVE 20 Okt 2026:** web https://bengkelgo-eight.vercel.app, API https://bengkelgo-api.onrender.com (Render Free, Singapore; kartu debit virtual Jago hanya untuk verifikasi Render), database & Storage Supabase (Singapore). Migrasi 001–005 jalan otomatis, admin dibuat dengan `npm run seed`. `TRUST_PROXY=4` (diukur: Vercel → Cloudflare → Render internal → lokal); halaman admin Kesehatan sistem menampilkan rantai header proxy untuk mengecek ulang.
- **✅ Gmail API sudah diisi di Render** (`GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`; dicek 21 Okt). Email booking produksi terkirim, tapi pernah **masuk folder spam** penerima (akun Gmail pribadi tanpa domain sendiri; lihat catatan pengiriman di PBI-404). Pastikan juga `APP_URL` = URL Vercel agar tautan di email tidak menunjuk ke `localhost`.
- **✅ Ping cron-job.org** ke `/health` sudah dipasang (dikonfirmasi tim 21 Okt).
- **Belum:** uji alur lengkap di produksi (langkah 8).
- **Risiko kecil yang dicatat:** request yang langsung ke alamat Render (tanpa Vercel) bisa memalsukan `X-Forwarded-For` dan mengakali pembatas login. ✅ 21 Okt: pembatas login kini juga per email (10 percobaan / 15 menit).

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
- ~~**Potong otomatis QRIS**~~ ❌ tidak dikerjakan (keputusan tim 21 Okt): gambar QRIS tetap utuh, sehingga nama merchant & NMID di stiker tetap terlihat.

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
