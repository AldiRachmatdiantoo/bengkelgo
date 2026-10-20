# Bengkel Frontend (BengkelGo)

Frontend **React + TypeScript (Vite) + Tailwind** untuk seluruh alur aplikasi. Tampilannya mengikuti desain final dari proyek Stitch **"Traveloka-Style Landing Page"** (design system *Azure Fleet & Roadside System*: Plus Jakarta Sans + Inter, ikon Material Symbols, palet PRD 3.1). Arsitekturnya **component-based**: hanya `components/`, `pages/`, `theme/`, dan `App.tsx` yang diganti; `services/`, `hooks/`, dan `utils/` tidak berubah dari prototipe.

Konten fiktif di mockup Stitch (nomor pit, promo, garansi, Virtual Account, statistik nasional) **tidak** diterapkan. Semua angka di layar berasal dari API.

## Menjalankan

Backend harus hidup dulu (`cd backend && docker compose up -d`). Lalu:

```bash
cd frontend
cp .env.example .env    # sekali saja
npm install             # sekali saja
npm run dev             # http://localhost:5173
```

Semua request `/api/*` diteruskan oleh Vite ke backend (`VITE_PROXY_TARGET`, default `http://localhost:8080`). Karena itu cookie refresh token langsung berfungsi tanpa pengaturan CORS. Kalau backend dijalankan dengan `npm run dev` (port 4000), ubah `VITE_PROXY_TARGET`.

Akun admin = `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` dari `backend/.env`.

## Struktur & apa yang diganti saat desain final

```
src/
├── services/          ✅ DIPERTAHANKAN: logika & koneksi ke backend
│   ├── api/types.ts       tipe data respons API
│   ├── api/client.ts      axios, token di memori, auto-refresh token, pesan error
│   ├── api/endpoints.ts   satu fungsi per endpoint backend
│   └── auth/AuthProvider  status login, restore sesi saat reload, logout
├── hooks/             ✅ DIPERTAHANKAN: useGeolocation (GPS), useProtectedImage (QRIS/bukti bayar)
├── utils/format.ts    ✅ DIPERTAHANKAN: format Rupiah/tanggal/jarak, label & warna status
├── theme/index.css    🔁 token warna PRD 3.1 + token Stitch (line, ink-2/3, *-soft, shadow-soft/lift/float)
├── App.tsx            🔁 DISESUAIKAN: daftar halaman & hak akses per role
├── components/        ❌ DIGANTI: tampilan
│   ├── ui/                Button, Input, Card, Badge, Table, …
│   ├── layout/            Navbar, layout, route guard (RequireRole tetap dipakai)
│   ├── map/               MapPicker & PointsMap (Leaflet + OpenStreetMap)
│   ├── workshop/          kartu bengkel, pilih layanan, pilih slot, ulasan
│   └── orders/            tiket, status darurat, panel bayar, ulasan, aksi bengkel
└── pages/             ❌ DIGANTI: susunan halaman (logika data tetap memanggil services/)
    ├── public/            beranda + filter, detail bengkel & booking
    ├── auth/              login, daftar pelanggan, daftar bengkel
    ├── customer/          SOS darurat, pesanan saya, detail pesanan
    ├── owner/             dashboard, pesanan, layanan, mekanik, kuota, profil & QRIS
    └── admin/             verifikasi bengkel, laporan transaksi
```

**Aturan untuk desain final:** halaman dan komponen boleh dirombak total, tapi **jangan panggil axios langsung**. Selalu lewat `services/api/endpoints.ts`. Dengan begitu, penanganan token, refresh, dan error tetap konsisten.

## Halaman

| URL | Role | Isi |
|---|---|---|
| `/` | publik | landing ringkas: hero penjelas + 2 CTA, "Apa yang Bisa Anda Lakukan?", Cara Kerja (`/#cara-kerja`), keunggulan, ulasan asli, banner mitra, FAQ. Tautan lama `/#booking`, `/#sos`, `/#cari` dialihkan ke `/workshops` |
| `/workshops` | publik | **Cari & Booking**: kotak 3 tab (`?tab=booking\|sos\|cari`), banner SOS, grid hasil bengkel, radar peta |
| `/workshops/:id` | publik | **booking** 4 langkah (ada "Hitung jarak dari lokasi saya") (paket → tanggal → jam per sesi → kendaraan). Login diminta saat konfirmasi; pilihan tersimpan selama login. `?date=` mengisi tanggal awal |
| `/emergency` | publik / customer | **SOS**: lokasi (GPS atau klik peta), scan 5 km, kirim permintaan. Tanpa akun → otomatis masuk sebagai tamu |
| `/login`, `/register`, `/register/workshop` | publik | autentikasi; daftar bengkel dengan map picker |
| `/orders`, `/orders/:id` | customer / tamu | riwayat; status booking (digital pass ber-QR, e-receipt cetak/PDF, kalender .ics, bagikan) atau tracking SOS (auto-refresh 5 detik), ulasan, batal |
| `/orders/:id/pay` | customer | langkah 4: bayar QRIS + unggah bukti (drag & drop). Dibuka otomatis setelah booking terkonfirmasi |
| `/owner`, `/owner/emergency`, `/owner/quotas`, `/owner/mechanics`, `/owner/payments`, `/owner/profile`, `/owner/orders` | pemilik bengkel | tab: Ringkasan, Panggilan Darurat (auto-refresh 5 detik), Kalender & Kuota Slot, Kelola Mekanik, Verifikasi Pembayaran QRIS, Pengaturan Bengkel (profil + layanan + QRIS); semua pesanan lewat menu akun |
| `/admin`, `/admin/workshops`, `/admin/reports` | admin | Dashboard Overview (KPI + pipeline persetujuan), Persetujuan Mitra (coverage 5 km), Audit Transaksi (periode + ekspor CSV). Admin mendarat di `/admin` setelah login |
| URL lain | publik | halaman 404 (kembali ke beranda, cari bengkel, link SOS) |

## Catatan

- **Font & ikon** dimuat dari Google Fonts di `index.html` (Plus Jakarta Sans, Inter, Material Symbols Outlined). Pakai `<Icon name="…" />` dari `components/ui`.
- **`data-testid`** sudah dipasang pada elemen kunci alur E2E (SOS, booking, upload bukti, verifikasi, approval admin) untuk Playwright (PBI-407).
- **Layout dipilih per halaman** (`components/layout/AppLayout.tsx`): portal owner dan admin = **sidebar + top bar**, halaman lain = situs publik (owner/admin melihat tombol "Ke Portal").
- **Komponen baru** di `components/ui`: `Modal`, `toast()`/`Toaster`, `QrCode` (library `qrcode`, QR dari nomor pesanan), `CopyButton`, `ProgressBar`, `SectionHeading`.
- **Hijau sukses** = `#077A3A` (PRD `#00A651` hanya 3,2:1; versi lebih gelap ini 5,4:1 untuk teks hijau maupun teks putih di tombol hijau).
- **Warna primer** = `#4361EE` (permintaan tim; teks putih di atasnya 5,0:1, lolos WCAG AA). Turunannya dari hue yang sama: hover `#2B4AD4`, tint `#D3DBFD`, latar sorot `#F0F3FF`, navy teks `#192557`. Semua ada di `src/theme/index.css`.

- **Ilustrasi hero** (`src/assets/hero-workshop.webp`, 1536px, ±67 KB) diambil dari layar gambar di proyek Stitch (asli 1024px), dicerahkan + diperbesar dengan penajaman, lalu disimpan lokal, karena tautan gambar Stitch bersifat sementara. Gambar ini buatan AI: ganti dengan aset resmi tim bila ada.
- **Animasi (framer-motion)**: dibuat ringan dan ada di `components/ui/motion.tsx`: fade halaman saat pindah rute, fade-in bagian landing saat di-scroll (kartu muncul berurutan), hover avatar profil (membesar sedikit + ring), menu akun dan modal muncul halus. Otomatis mati jika pengguna mengaktifkan "kurangi gerakan" di sistem operasinya.
- **Tombol SOS mengambang (FAB)**: lingkaran oranye di kanan bawah yang selalu terlihat saat scroll (menggantikan tombol SOS di header). Tidak tampil di /emergency dan di portal owner/admin.
- **Bentuk tombol**: kotak dengan sudut 8px (`rounded-lg`), toggle/segmen `rounded-md`. Bentuk pil (`rounded-full`) hanya untuk badge/chip status, avatar, dan titik indikator.
- **Warna latar**: halaman = `bg-canvas` (`#F8F9FC`), kartu = putih cerah (`bg-card` = `#FFFFFF`).
- **Ukuran teks**: teks isi (paragraf, tombol, input, label) = 11px, sama dengan label "Bengkel diverifikasi admin" di landing. Judul memakai `text-headline-*`/`text-display`, subjudul memakai `text-subtitle` (13px). Diatur di `src/theme/index.css`.
- **Warna SOS/darurat** = `#F05A28` (hover `#EA580C`, teks putih tebal); teks oranye kecil memakai `text-emergency-ink` (`#C2410C`) agar terbaca. Tidak ada lagi merah.
- **Kisaran biaya SOS**: pelanggan memilih kisaran (default "Bisa dibicarakan"). Karena API belum punya kolomnya, kisaran dikirim sebagai baris terakhir `problem_description` (`Kisaran biaya: …`) dan dipisah lagi saat ditampilkan (`utils/priceRange.ts`). Pesanan SOS tanpa harga tampil "Bisa dibicarakan", bukan Rp0/gratis.
- **Pesanan dibatalkan** disembunyikan dari daftar utama; lihat lewat tab "Riwayat dibatalkan" (pelanggan) atau status "Dibatalkan" (owner).

- **Login Google (PKCE)** ada di `services/auth/googleOAuth.ts` + halaman `/auth/google/callback`. Tombolnya **hanya tampil kalau `VITE_GOOGLE_CLIENT_ID` diisi** di `.env`. Redirect URI = `<origin>/auth/google/callback`, harus sama persis dengan `GOOGLE_REDIRECT_URI` di `backend/.env` dan di Google Cloud Console.
- **Unggah foto** (QRIS & bukti bayar) lewat `hooks/usePreparedImage.ts` → `utils/imageUpload.ts`: jenis file dicek dari isinya (video/PDF/file yang diganti nama ditolak sebelum dikirim), foto > 2 MB diperkecil di browser jadi JPG, HEIC dikonversi di Safari, dan ada pratinjau. Foto ≤ 2 MB dikirim apa adanya agar QR tetap tajam.
- **Pesan error** dari API diterjemahkan per kode di `services/api/errorMessages.ts`. Tambahkan kode baru di sana bila backend menambah kode error.
- **Update layanan/teknisi** lewat `ownerApi.updateService(service, patch)` / `updateMechanic(mechanic, patch)`: fungsi ini selalu mengirim ulang `duration_minutes` / `specializations`, karena PATCH backend mereset field itu ke default bila tidak dikirim (bug backend, lihat `../status_backlog_prd.md`).
- **Ikon & tampil/sembunyi responsif**: CSS Material Symbols mengalahkan `hidden`/`lg:block` Tailwind pada `<Icon>` itu sendiri. Bungkus ikon dengan `<span className="hidden lg:block">`.
- **Fitur sparepart** belum ada, karena masih menunggu keputusan tim (lihat `../review_flowchart_booking_vs_backend.md`).
- **Error 401 `/auth/refresh` di console** saat belum login itu normal: aplikasi sedang mengecek apakah ada sesi tersimpan.
- **Notifikasi** (`services/notifications/NotificationCenter.tsx`): diambil dari `GET /notifications` (owner tiap 5 dtk, lainnya tiap 15 dtk). Server membuatnya bersamaan dengan aksinya, jadi riwayatnya lengkap dan sama di semua perangkat. Tampilan per jenis (`SOS_INCOMING`, `PAYMENT_PROOF`, …) diatur di tabel `LOOK`; jenis penting (SOS masuk, bukti bayar, refund, bukti ditolak) berbunyi untuk owner dan memakai notifikasi browser bila diizinkan. **Batasan:** belum ada push saat aplikasi tertutup (butuh Web Push/FCM/WhatsApp).
- **Halaman baru:** `/vehicles` (kendaraan saya), `/owner/reviews` (ulasan + balasan), tab `#jadwal` dan `#foto` di `/owner/profile` (tab mengikuti hash URL), `/admin/users`, `/admin/search`, `/admin/audit`, `/admin/health`. Foto bengkel/mekanik adalah gambar publik dari API; pakai `apiAsset(url)` untuk membentuk alamatnya.
- **Animasi** memakai `LazyMotion` + komponen `m` (bukan `motion`): mesin animasi (`components/ui/motion-features.ts`) dimuat setelah halaman tampil. Mode `strict` membuat impor `motion` langsung menjadi error.
- **Ekspor PDF** laporan admin (Dashboard & Audit Transaksi) lewat jendela cetak browser, tanpa library PDF.
- **Code-splitting**: hanya beranda yang ada di bundle utama; halaman lain (dan Leaflet) dimuat saat pertama dibuka (`React.lazy` di `App.tsx`).
- **Deploy Vercel**: `vercel.json` sudah ada (rewrite SPA + cache aset). Set *Root Directory* = `frontend` dan env `VITE_API_URL`.
- **Test otomatis (PRD 8.2)**:
  - `npm test`: Vitest + React Testing Library (40 test: komponen UI, kartu pesanan, kisaran biaya SOS, pengalihan setelah login, cek/kompres foto, terjemahan error, PKCE Google).
  - `npm run test:e2e`: Playwright, project `desktop` + `mobile`. Butuh backend hidup (`docker compose up -d`). Berisi:
    - `e2e/a11y.spec.ts`: axe-core WCAG 2.1 AA di 7 halaman publik, desktop + mobile. Pengecualian yang disengaja hanya tombol SOS solid (`data-a11y-exception`, putih di atas `#F05A28` = 3,4:1, warna pilihan tim).
    - `e2e/journeys.spec.ts`: dua user journey PRD (daftar bengkel → approval admin → kuota/teknisi/QRIS; tamu SOS + kisaran biaya → bengkel terima → bayar → verifikasi → selesai), termasuk notifikasi. Data uji dibuat sendiri, lalu bengkel uji dinonaktifkan otomatis. Ditambah: edit layanan/teknisi tidak mereset durasi/keahlian, unggah video ditolak & foto besar diperkecil, owner kembali ke tautan pesanan setelah login.
    - `e2e/smoke-mobile.spec.ts`: semua halaman portal pelanggan, owner, dan admin tidak boleh bergeser ke samping di layar 375px.
    - `e2e/cross-browser.spec.ts`: halaman publik + fitur khusus browser (kompres foto di canvas, Web Crypto untuk PKCE).
  - `npm run test:e2e:cross`: tes yang sama di WebKit (Safari desktop), Safari iPhone, dan Firefox. Pasang browsernya sekali: `npx playwright install firefox webkit`.
    - `e2e/backlog-features.spec.ts`: fitur Paket A & B lewat UI (kendaraan, ganti jadwal, riwayat, alasan batal, SOS + kategori, pilih mekanik, ubah estimasi, RRN/invoice, balasan ulasan, jadwal/libur, foto, hapus layanan, alat admin & pengguna).
    - `e2e/a11y-auth.spec.ts`: axe untuk halaman setelah login (pelanggan, owner, admin).
  - `npm run test:visual`: visual regression (`e2e/visual.spec.ts`, baseline di `e2e/visual.spec.ts-snapshots/`, per OS). Setelah perubahan desain yang disengaja: `npm run test:visual:update`, periksa PNG baru, lalu simpan.
  - Batas login backend 15×/15 menit per IP. Di Docker lokal semua request terhitung satu IP, jadi kalau E2E dijalankan berulang dan muncul *Terlalu banyak percobaan*, reset: `docker compose exec redis redis-cli DEL rl:auth:172.18.0.1` (di folder `backend`).
    - Kredensial admin diambil dari `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD` atau `SEED_ADMIN_*` di `../backend/.env`. Laporan HTML di `e2e-report/`.
