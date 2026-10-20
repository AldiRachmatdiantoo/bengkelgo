# Rencana: Membuat Frontend 100% Sama dengan Desain Stitch

**Acuan desain:** proyek Stitch "Traveloka-Style Landing Page" (8 layar, design system *Azure Fleet & Roadside System*)
**Acuan kode:** [frontend/](frontend/README.md), [backend/](backend/README.md), skema [001_init.sql](backend/src/db/migrations/001_init.sql)
**Tanggal:** 18 Oktober 2026
**Status saat ini:** frontend sudah memakai *gaya* Stitch, tetapi tata letak, token, dan banyak bagiannya belum sama. Dokumen ini merinci **semua** pekerjaan agar sama 100%, termasuk yang butuh perubahan backend.

---

## Cara membaca

Setiap item diberi label jenis pekerjaan:

| Label | Arti |
|---|---|
| **FE** | Cukup diubah di frontend (`components/`, `pages/`, `theme/`). Data sudah tersedia dari API. |
| **BE** | Butuh perubahan backend: kolom/tabel baru, endpoint baru, atau logika baru. |
| **INT** | Butuh integrasi pihak ketiga (bank, payment gateway, OCR, peta lalu lintas, dll.). |
| **KONTEN** | Butuh konten asli dari tim (foto, teks, kebijakan, nomor hotline). Tidak boleh diisi data karangan. |
| **KEPUTUSAN** | Bertentangan dengan PRD atau alur backend sekarang, jadi tim perlu memutuskan dulu. |

Ukuran usaha: **S** (< ½ hari), **M** (½–2 hari), **L** (> 2 hari).

---

## Ringkasan

| Kelompok | Jumlah item | Catatan |
|---|---|---|
| Hanya frontend (**FE**) | ±45 | Token, layout, header/footer, susunan tiap layar. Bisa langsung dikerjakan. |
| Butuh backend (**BE**) | ±30 | Foto bengkel/mekanik, fasilitas, kendaraan tersimpan, pit, layanan tambahan, promo, nomor invoice, dokumen mitra, statistik, dll. |
| Butuh integrasi (**INT**) | 7 | Virtual Account, OCR bukti bayar, pencocokan mutasi bank, ETA & lalu lintas, posisi mekanik live, sinkron kalender, PDF e-receipt. |
| Butuh konten (**KONTEN**) | ±12 | Logo, foto, testimoni, FAQ, kebijakan garansi, hotline, daftar kota. |
| Butuh keputusan (**KEPUTUSAN**) | 6 | Lihat [bagian 12](status_backlog_prd.md#12-konflik-yang-harus-diputuskan-tim). |

> **Penting:** Stitch hanya punya 8 layar. Halaman **login, daftar pelanggan, daftar bengkel, daftar pesanan saya, serta sub-halaman owner (pesanan, layanan, mekanik, profil) dan admin (laporan)** tidak ada desainnya. Agar "100% sama", halaman-halaman ini harus **dibuat dulu di Stitch** memakai design system yang sama ([bagian 11](status_backlog_prd.md#11-halaman-yang-belum-ada-desainnya-di-stitch)).

---

## Status pengerjaan (diperbarui 18 Oktober 2026)

**Fase 1 (frontend saja, tanpa mengubah backend) sudah dikerjakan.** Typecheck & build lolos, dan semua alur sudah diuji di browser: tamu, pelanggan, owner, admin, booking → bayar QRIS → status, SOS → batal, persetujuan mitra, ekspor CSV. Tidak ada scroll horizontal di 375px.

| Bagian | Yang sudah diterapkan | Pengganti jujur (karena data belum ada) |
|---|---|---|
| 1 Token | Primer `#006191` (+ `primary-bright #0194DA`), `primary-fixed`, `surface-low/ /high`, `canvas #f8fafb`, `secondary`, radius kartu 12px, `shadow-sm`, skala teks `text-display`, `text-headline-*`, `text-label-sm` | – |
| 2.1 Header | Tinggi 80px + bayangan, menu lengkap (Beranda, Bantuan Darurat SOS, Booking Jadwal Servis, Cari Bengkel Terdekat, Gabung Mitra, Masuk), CTA merah "Bantuan Darurat 24 Jam", avatar bulat + menu akun | Logo masih ikon (KONTEN); menu "Promo & Garansi" tidak ditampilkan |
| 2.2 Strip status | – | Ditunda (butuh BE-1) |
| 2.3 Footer | Putih, 4 kolom, baris bawah | Kolom kota, hotline, dan halaman legal ditunda (KONTEN) |
| 2.4 Portal owner | Header + **tab horizontal** sesuai Stitch, badge Mitra Resmi, status radar, **toggle "Buka & Siaga SOS"**, lonceng berangka (SOS + bukti bayar), menu akun, footer status koneksi | Kode bengkel & "Pit" ditunda (BE) |
| 2.5 Portal admin | Sidebar (Dashboard Overview, Persetujuan Mitra, Audit Transaksi) + badge Governance HQ, top bar dengan status API, lonceng persetujuan, menu akun | Menu Monitoring PostGIS, Manajemen Akses, Pengaturan, kotak cari: ditunda (BE-14/15/16) |
| 3 Beranda | Hero, kartu pencarian **3 tab** (Booking: lokasi/kendaraan/tanggal + **hari pasaran Jawa**/nama; SOS: GPS + 4 jenis masalah → form SOS terisi; Cari: nama/kendaraan/urutan), banner SOS, **carousel** "Top Verified", **peta radar** + kartu bengkel terdekat, 4 kartu keunggulan, **ulasan asli** dari pelanggan, banner mitra gradien, **FAQ** accordion | Foto bengkel → header gradien; katalog layanan (3.3, butuh BE-3), testimoni karangan, dan statistik "120.000+" tidak ditampilkan. **Tambahan di luar Stitch:** bagian **Cara Kerja** (`/#cara-kerja`) dengan 3 panduan (Booking, SOS, Pemilik Bengkel) × 4 langkah. **Perubahan susunan atas permintaan tim:** kotak pencarian 3 tab, banner SOS, daftar bengkel, dan radar dipindah ke halaman baru **`/workshops`** (Cari & Booking); landing `/` kini hanya menjelaskan BengkelGo (hero + 2 CTA, "Apa yang Bisa Anda Lakukan?", Cara Kerja, keunggulan, ulasan, mitra, FAQ) |
| 4 Booking | **Stepper 1 baris** dengan konektor, banner kuota (tanpa timer), kartu bengkel + "paket servis dipilih", **strip tanggal "Okt (Sel)"** + "Pilih di Kalender", slot **dikelompokkan per sesi** dengan badge "N Slot / Sisa / Penuh", "+ Waiting List", estimasi selesai, catatan maks 300, ringkasan kanan (baris biaya, "GRATIS", total), CTA "Konfirmasi & Lanjut ke QRIS", kartu bantuan | Timer kunci slot, pit/teknisi per slot, kendaraan tersimpan, add-on, promo: ditunda (BE-5/6/8/10/11) |
| 5 Bayar QRIS | **Halaman baru `/orders/:id/pay`** (langkah 4): kotak kode reservasi + salin, kartu QRIS (salin nominal, 3 langkah, chip penyedia, unduh QR), **dropzone drag & drop**, ringkasan pemesanan, perlindungan pengendara | Timer bayar, NMID, RRN/nama pembayar, VA, bayar di tempat: ditunda (BE/INT) |
| 6 Status booking | Hero horizontal + **Unduh E-Receipt (cetak/PDF via browser)**, **Simpan ke Kalender (.ics)**, **Bagikan**; baris info; **Digital Pass putih ber-QR** (QR = nomor pesanan) + estimasi kedatangan; alur kedatangan 3 langkah; kartu bengkel dengan peta mini; **e-receipt**; **sinkron Google Calendar / iCal** | Nomor invoice, pit, check-in QR, reschedule, Wallet pass: ditunda |
| 7–8 Tracking SOS | **Strip header putih** (ikon berdenyut, badge status, timer batas respons), peta dengan **label + garis rute** + baris statistik, timeline "Live Sync" berjam, kartu mekanik (Telepon merah / WhatsApp hijau), kartu kendala, **kartu estimasi biaya**, **banner keselamatan navy** + tombol batal, **modal batal** | ETA, lalu lintas, posisi mekanik live, armada, alasan batal tersimpan: ditunda (BE-7/INT) |
| 9 Dashboard owner | Banner SOS merah muda + timer + Terima/Tolak, **4 KPI dengan progress** (SOS hari ini, utilisasi kuota, mekanik siaga, pembayaran lunas hari ini), **papan kuota per jam** berisi booking + tombol ±slot, **grafik utilisasi per jam** ("Kini"), kartu verifikasi QRIS dengan **thumbnail bukti** + Verifikasi/Minta Unggah Ulang, **tim mekanik + tugas aktif**, kartu Radar SOS; tab baru **Panggilan Darurat** & **Verifikasi Pembayaran**; Pengaturan = profil + layanan + QRIS | Papan per **pit**, pendapatan bruto resmi, shift, OCR: ditunda |
| 10 Dashboard admin | Hero + pilihan periode + **Export CSV**, 4 KPI (volume terverifikasi **+ pertumbuhan vs periode sebelumnya**, mitra aktif + antrean, pesanan SOS, menunggu verifikasi), **pipeline persetujuan** + antrean berikutnya, status pesanan, bengkel teratas, **toast** aksi, **modal alasan** tolak/nonaktif, kartu mitra dengan **peta coverage 5 km** + jumlah mitra lain dalam radius 5 km | Dokumen mitra, skor verifikasi, telemetri, tabel per transaksi, komisi 5%: ditunda (BE-12/13/14/17) |

**Keputusan yang saya ambil di Fase 1** (bisa dibalik):
- 12.1: primer sempat `#006191` (Stitch), lalu **diganti ke `#4361EE` atas permintaan tim** (teks putih 5,0:1, tetap lolos WCAG AA); navy teks, tint, dan garis ikut diturunkan dari hue yang sama.
- 12.2: alur tetap "booking dulu, bayar sesudahnya", tetapi pelanggan **langsung diarahkan ke halaman bayar** setelah booking terkonfirmasi, sehingga terasa seperti 4 langkah Stitch.
- 12.5: klaim marketing dan angka karangan tidak ditampilkan.
- 12.6: istilah teknis tetap ada di portal admin; halaman pelanggan memakai bahasa awam.

### Pembaruan 19 Oktober 2026 (frontend saja, backend tidak diubah)

| Area | Yang diubah |
|---|---|
| Tipografi | Teks isi 11px (`text-sm`/`text-base`), subjudul 13px (`text-subtitle`), judul tetap memakai `text-headline-*`/`text-display` |
| Warna SOS | Merah `#D9383A` diganti oranye **`#F05A28`** (hover `#EA580C`, teks kecil `#C2410C`) di seluruh aplikasi, atas permintaan tim |
| Tombol | Sudut kotak 8px (`rounded-lg`); bentuk pil hanya untuk badge/chip, avatar, titik |
| SOS | Tombol "Bantuan Darurat 24 Jam" di header diganti **tombol mengambang bulat** di kanan bawah; tombol SOS di hero dibuat bergaris tepi oranye |
| Beranda | Chip lokasi di atas judul; judul bagian rata kiri; bagian "Kenapa BengkelGo berbeda?" berpita penuh (3.6); **ilustrasi isometrik Stitch** menggantikan kartu gradien hero (disimpan lokal di `src/assets`); animasi ringan framer-motion |
| Pesanan | Pesanan **dibatalkan disembunyikan** dari daftar utama, dilihat lewat "Riwayat dibatalkan" (pelanggan) / status Dibatalkan (owner) |
| Harga SOS | Default **"Bisa dibicarakan"** (bukan Rp0/gratis); pelanggan bisa mengisi kisaran biaya saat SOS. Karena tidak ada kolom di backend, kisaran dikirim sebagai baris terakhir `problem_description` (lihat `frontend/src/utils/priceRange.ts`). Kolom khusus tetap disarankan (BE-lain) |
| Owner | **CRUD teknisi**: tambah, ubah (modal), hapus (= nonaktif, bisa dipulihkan dari arsip) |
| 4.3 | **Jarak "x km dari lokasi Anda"** di kartu bengkel halaman booking (haversine di FE, GPS diminta hanya saat tombol ditekan) — selesai |
| 11 | **Halaman 404** baru |
| Deploy | `frontend/vercel.json` (rewrite SPA + cache aset) dan **code-splitting** per halaman (bundle awal ±640 KB, sebelumnya ±983 KB) |
| 2.4 Portal owner | **Diubah ke sidebar + top bar** (seperti admin) atas permintaan tim; menu: Ringkasan, Panggilan Darurat, Semua Pesanan, Kalender & Kuota, Kelola Teknisi, Verifikasi Pembayaran, Pengaturan, Notifikasi |
| Notifikasi | Lonceng + **halaman riwayat notifikasi** per peran (dihitung di FE dari data polling; lihat `frontend/README.md`). Versi penuh (push/email/WA, riwayat lintas perangkat) tetap butuh BE |
| 10 Admin | **Export PDF** laporan (jendela cetak browser) di samping CSV |
| Aksesibilitas | Warna teks redup `ink-3` digelapkan ke `#5F6784` (≥4,5:1); banner halaman SOS memakai oranye tua `#C2410C` agar teks putih terbaca |
| Test | Vitest (komponen) + Playwright (2 journey PRD + axe) di `frontend/` |

Semua item **BE / INT / KONTEN / KEPUTUSAN** di bawah masih terbuka.

---

## 1. Token desain global (FE, S)

Nilai berikut diambil langsung dari `tailwind.config` di HTML Stitch. Masukkan ke `frontend/src/theme/index.css` (`@theme`).

| Token | Stitch | Sekarang | Tindakan |
|---|---|---|---|
| `primary` (tombol, link, tab aktif) | **`#006191`** | `#0194DA` | Ganti ke `#006191`. Simpan `#0194DA` sebagai `primary-bright` (aksen/ikon). ⚠️ **KEPUTUSAN** (PRD menyebut `#0194DA`), lihat [12.1](status_backlog_prd.md#121-warna-primer). |
| `primary-container` | `#007bb6` | – | Tambah (hover tombol). |
| `primary-fixed` | `#cbe6ff` (sering dipakai `/30`) | `sky #E8F5FC` | Tambah. Dipakai untuk pill nav aktif `bg-primary-fixed/30`. |
| `text-primary` | `#002D62` | `navy` | Sama. |
| `text-secondary` | `#4B6178` | `ink-2` | Sama. |
| `text-muted` | `#7A90A4` | `ink-3` | Sama. |
| `background` / `surface` | `#f8fafb` | `canvas #F7F9FA` | Ganti ke `#f8fafb`. |
| `surface-container-low/ /high` | `#f2f4f5` / `#eceeef` / `#e6e8e9` | – | Tambah. Stitch memakai ini untuk isian abu-abu (kotak info, chip, input). |
| `border-subtle` / `border-strong` | `#E5EBEF` / `#C5D3DE` | `line` / `line-strong` | Sama. |
| `sos-emergency` / `-subtle` | `#D9383A` / `#FDECEB` | sama | – |
| `success-green` / `-subtle` | `#00A651` / `#E6F6EE` | sama | – |
| `warning-amber` / `-subtle` | `#F59E0B` / `#FEF3C7` | sama | – |
| `secondary` | `#3e5e95` | – | Tambah (dipakai di beberapa badge). |
| Radius | `DEFAULT 4px`, `lg 8px`, `xl 12px`, `full` | kartu `rounded-2xl/3xl` (16–24px) | Kartu → `rounded-xl` (12px), input → `rounded-lg` (8px), tombol → `rounded-full`. Hapus `rounded-3xl` kecuali hero tertentu. |
| Bayangan | `shadow-sm` (paling sering), `shadow-md`, `shadow-[0_1px_8px_rgba(0,45,98,0.06)]` di header | kartu tanpa bayangan | Kartu → `shadow-sm` + border tipis. |
| Font | Plus Jakarta Sans (heading/body), Inter (label) | sama | – |
| Skala teks | `display-hero 48/56 800`, `headline-lg 36/44 700`, `headline-md 24/32 700`, `headline-sm 18/26 600`, `body-lg 16/24`, `body-md 14/22`, `body-sm 12/18`, `label-lg 14/20 600`, `label-md 12/16 600`, `label-sm 11/14 700` | ukuran ad-hoc | Daftarkan sebagai utility (`text-headline-md` dst.) dan pakai konsisten. |
| Spacing | `gutter 24px`, `margin 32px`, mobile 16px | ad-hoc | Daftarkan. Lebar konten maks `max-w-7xl` (1280px), padding `px-6 lg:px-12`. |

---

## 2. Shell global

### 2.1 Header publik

| Elemen Stitch | Sekarang | Tindakan | Jenis |
|---|---|---|---|
| Logo **gambar** + teks "Bengkel**Go**" | ikon Material + teks | Minta file logo asli (SVG). Gambar logo di Stitch di-host sementara oleh Google dan tidak boleh dipakai di produksi. | KONTEN, FE · S |
| Tinggi 80px, putih 95% + blur, bayangan tipis | 80px, border bawah | Ganti border → `shadow-[0_1px_8px_rgba(0,45,98,0.06)]`. | FE · S |
| Menu: Beranda · Bantuan Darurat SOS · Booking Jadwal Servis · Cari Bengkel Terdekat · Promo & Garansi · Gabung Mitra · Masuk | Beranda · Bantuan Darurat · (Pesanan Saya) | Tambah item. "Booking Jadwal Servis" dan "Cari Bengkel Terdekat" bisa berupa anchor/tab di beranda. "Promo & Garansi" butuh halaman baru (lihat 3.9). "Gabung Mitra" → `/register/workshop`. | FE · S (+KONTEN untuk promo) |
| Tombol merah "Bantuan Darurat 24 Jam" + ikon avatar bulat di kanan | tombol "SOS 24 Jam" + nama user | Samakan teks dan bentuk; avatar jadi tombol bulat yang membuka menu akun (Pesanan saya, Keluar). | FE · S |
| Pill nav aktif `bg-primary-fixed/30 text-primary` | `bg-sky text-primary` | Ikuti token. | FE · S |

### 2.2 Strip status di bawah header (khusus beranda)

Isinya: "Live Status PostGIS 5KM: 412 Mekanik Siaga Aktif di Jabodetabek & Surabaya Raya", "Garansi Servis 14 Hari", "QRIS & BI Verified", "Pessimistic Quota Engine v4.0".

- **BE · M**: endpoint statistik publik, misalnya `GET /stats/public` → `{ active_mechanics, active_workshops, cities[] }`. Saat ini tidak ada endpoint seperti ini.
- **KONTEN/KEPUTUSAN**: "Garansi Servis 14 Hari" adalah **kebijakan bisnis**. Jangan ditampilkan sebelum benar-benar berlaku.
- Label teknis ("PostGIS", "Pessimistic Quota Engine v4.0") disarankan diganti bahasa awam. Kalau tetap mau 100% sama, cukup FE.

### 2.3 Footer

| Elemen Stitch | Sekarang | Tindakan | Jenis |
|---|---|---|---|
| Footer **putih** (bukan navy) | navy | Ganti latar ke putih/`surface`, teks navy. | FE · S |
| Deskripsi + kotak merah "HOTLINE DARURAT 24/7 NASIONAL 1500-898 / (021) 500-247" | tidak ada | Butuh nomor hotline asli. | KONTEN · S |
| Kolom "Cakupan Kota" (6 kota) | tidak ada | Butuh daftar kota layanan yang benar; bisa diturunkan dari data bengkel. | KONTEN atau BE (`GET /stats/public` → `cities`) · S |
| Kolom "Layanan Otomotif" (6 layanan) | "Layanan" (3 link) | Butuh kategori layanan (lihat 3.3). | BE/KONTEN · S |
| Kolom "Kemitraan UMKM & Legal" (Daftar Mitra, Portal Owner, Standar Mutu Sparepart, Jaminan Garansi, Syarat & Kebijakan Privasi) | "Kemitraan" (2 link) | Butuh halaman statis: Syarat & Ketentuan, Kebijakan Privasi, Standar Mutu, Jaminan Garansi. | KONTEN · M |
| Baris bawah: "Transaksi Terlindungi QRIS & Bank Indonesia", "Enkripsi 256-bit…", © | © + "Pembayaran via QRIS" | Klaim "terlindungi Bank Indonesia" hanya boleh dipakai jika benar (legal). | KONTEN/KEPUTUSAN · S |

### 2.4 Portal owner: header + tab horizontal (bukan sidebar)

Di Stitch, portal owner **tidak memakai sidebar**. Yang dipakai adalah header 2 baris:

| Elemen Stitch | Sekarang | Tindakan | Jenis |
|---|---|---|---|
| Logo "BengkelGo**Mitra**" + subjudul "Owner Operational Portal" | sidebar dengan logo | Buat `OwnerShell` baru dengan header atas. | FE · M |
| Badge "Mitra Resmi v4.0" | – | Bisa diturunkan dari `status = APPROVED`. | FE · S |
| Nama bengkel + **kode bengkel** (`WKS-JKT-0982`) | nama saja | Butuh kolom kode bengkel. | BE · S |
| "Radar 5 KM Aktif • Pit 4/4 Beroperasi" | – | "Radar" = `accepts_emergency`. "Pit" butuh konsep pit (lihat [BE-6](status_backlog_prd.md#be-6-pit--bay-servis)). | FE + BE |
| Pill hijau "BUKA & SIAGA SOS 24 JAM" dengan **toggle** | toggle ada di halaman Profil | Pindahkan toggle `is_open` / `accepts_emergency` ke header (pakai `PUT /workshops/profile`). | FE · S |
| Lonceng notifikasi dengan angka | – | Butuh sistem notifikasi, minimal hitungan SOS masuk + bukti bayar menunggu. Bisa dihitung di FE dari polling yang sudah ada; idealnya endpoint `GET /notifications`. | FE (versi sederhana) · S / BE (penuh) · M |
| Nama user + jabatan "Kepala Bengkel" + dropdown | nama + "Pemilik Bengkel" | Samakan; jabatan statis. | FE · S |
| Tab: **Ringkasan · Panggilan Darurat (badge "1 Baru") · Kalender & Kuota Slot · Kelola Mekanik · Verifikasi Pembayaran QRIS · Pengaturan Bengkel** | Ringkasan · Pesanan · Kuota · Layanan · Mekanik · Profil & QRIS | Ubah susunan tab. Tab "Panggilan Darurat" dan "Verifikasi Pembayaran QRIS" butuh halaman baru (bisa memfilter `GET /orders/workshop`). "Layanan" tidak ada di Stitch: pindahkan ke dalam "Pengaturan Bengkel". | FE · M |
| Footer strip status sistem ("PostGIS Spatial Engine: Online…", "Ping 18ms") | – | Butuh endpoint health (lihat [BE-14](status_backlog_prd.md#be-14-health--telemetri-admin--owner)). | BE · S |

### 2.5 Portal admin: sidebar + top bar

| Elemen Stitch | Sekarang | Tindakan | Jenis |
|---|---|---|---|
| Sidebar: logo "BengkelGo Platform Core", badge "GOVERNANCE HQ", kartu status cluster "AP-SE-1 Healthy / PostGIS & Redis 99.98%" | sidebar sederhana | Tambah kartu status (butuh [BE-14](status_backlog_prd.md#be-14-health--telemetri-admin--owner)). | FE + BE |
| Menu: **Dashboard Overview · Persetujuan Mitra · Audit Transaksi · Monitoring PostGIS · Manajemen Akses · Pengaturan** | Persetujuan Mitra · Laporan Transaksi | Tambah 4 menu. "Manajemen Akses" dan "Pengaturan" butuh endpoint user management (lihat [BE-15](status_backlog_prd.md#be-15-manajemen-akses-admin)). | FE + BE · L |
| Kotak "RFC-5424 ACTIVE / Immutable node logs enabled" di bawah sidebar | – | Butuh audit log (lihat [BE-13](status_backlog_prd.md#be-13-audit-log)). | BE |
| Top bar: strip "Supabase & PostGIS Live (Cluster AP-SE-1) • Redis Healthy • 99.98% Uptime", **kotak cari** "Cari ID Bengkel, Transaksi", lonceng (angka), user "Root Admin" | tidak ada top bar | Buat top bar. Pencarian butuh endpoint pencarian (lihat [BE-16](status_backlog_prd.md#be-16-pencarian-admin)). | FE + BE · M |

---

## 3. Beranda (`/`)

Stitch: 5.920px tinggi, 10 bagian. Sekarang: 5 bagian.

### 3.1 Hero + kartu pencarian 3 tab

| Elemen Stitch | Sekarang | Tindakan | Jenis |
|---|---|---|---|
| Latar putih dengan gradien biru sangat halus di kanan atas | gradien sky ke canvas | Samakan. | FE · S |
| Chip "Ekosistem Bengkel & Roadside Darurat #1 di Indonesia" | chip lain | Klaim "#1 di Indonesia" butuh dasar. | KONTEN · S |
| Judul "Solusi Lengkap Servis Kendaraan & Bantuan Darurat 24 Jam" + sub "Temukan **2.500+** bengkel mitra… tiba dalam 15–25 menit" | judul lain | Angka 2.500+ dan "15–25 menit" harus dari data asli (`GET /stats/public`, lihat [BE-1](status_backlog_prd.md#be-1-statistik-publik)). | FE + BE · S |
| **Tab 1 "Booking Servis Berkala"** (+ badge "Anti-Antre"): 4 kolom: **Kota/Lokasi** (dropdown wilayah + "Radius < 8 km"), **Jenis Kendaraan & Paket** (dropdown "Mobil • Ganti Oli + Filter…"), **Tanggal Servis** (+ "Besok, Jumat Legi"), **Jam Kedatangan** (dropdown "14:00 WIB (4 Slot Tersedia)") + tombol "Cari Bengkel Bergaransi" | kotak cari nama + segmented kendaraan + tombol GPS | (a) Kota/wilayah: perlu daftar wilayah dan filter wilayah di `GET /workshops` (**BE**). (b) "Paket": perlu kategori layanan global (**BE**, [BE-3](status_backlog_prd.md#be-3-kategori-layanan-global)). (c) Tanggal + jam: perlu pencarian bengkel yang **punya slot kosong** pada tanggal/jam itu (**BE**, [BE-4](status_backlog_prd.md#be-4-cari-bengkel-berdasarkan-ketersediaan-slot)). (d) Penanggalan Jawa ("Jumat Legi") bisa dihitung di FE. | FE + BE · L |
| **Tab 2 "Bantuan Darurat SOS (5 Km)"** (+ "Respon Cepat"): kotak GPS otomatis berisi **alamat jalan** + "Akurasi GPS 3.4 meter • 14 Bengkel & Derek Siap Luncur" + tombol "Perbarui Titik GPS"; pilihan masalah (Aki Mati/Jumper, Ban Bocor/Pecah, Mesin Mogok/Overheat, **Derek Gendong (Towing)**); "Standby Time Mekanik: 15–25 Menit"; tombol merah "Kirim Bantuan Darurat Sekarang" | SOS ada di halaman terpisah `/emergency` | (a) Pindahkan form SOS ringkas ke tab ini (FE). (b) Alamat jalan dari koordinat butuh **reverse geocoding** (INT: Nominatim/Google; bisa langsung dari FE). (c) Akurasi GPS tersedia di `coords.accuracy`; `useGeolocation` perlu diperluas (catatan: `hooks/` sebaiknya dipertahankan, jadi tambahkan hook baru). (d) Jumlah "bengkel siap" diambil dari `POST /emergency/scan`. (e) **Towing** bukan layanan yang dikenal backend: perlu kategori masalah/jenis bantuan (BE, [BE-9](status_backlog_prd.md#be-9-detail-kendaraan--jenis-masalah-darurat)). (f) "15–25 menit" butuh data ETA historis (BE). | FE + BE + INT · M |
| **Tab 3 "Cari Bengkel Terdekat"**: cari nama/merk, dropdown **Fasilitas** (AC, WiFi, Musholla, Buka Minggu, Spesialis Matic, Authorized Brand), dropdown **Urutkan** (Terdekat, Rating, **Harga Termurah**), tombol "Tampilkan 87 Bengkel Terdekat" | kotak cari + GPS | Fasilitas → [BE-2](status_backlog_prd.md#be-2-profil-bengkel-diperluas-foto-fasilitas-wilayah-merek). Urutan harga → `GET /workshops` perlu `sort` + harga layanan termurah (BE). Hitungan hasil → API perlu mengembalikan `total` (saat ini hanya array). | FE + BE · M |
| Baris pengaman "Pessimistic Row-Locking menjamin slot jam tidak akan bentrok…" | – | Teks statis. | FE · S |

### 3.2 Banner SOS di bawah hero

Sudah mirip. Samakan susunan: ikon kiri, judul + badge "Respon < 25 Mnt", tombol "SOS Panggil Sekarang" di kanan, dan posisinya **tepat di bawah kartu pencarian**. Angka "< 25 menit" butuh data (BE-1). **FE · S**

### 3.3 "Layanan Otomotif Terfavorit" (katalog 6 kartu, "Lihat Semua 28 Layanan")

Setiap kartu berisi ikon, badge ("Garansi 14 Hari", "Siaga 24 Jam", "Trade-in Aki", "Nano Coating"), judul, deskripsi, "Mulai dari Rp…", dan tombol "Pilih Jadwal"/"Panggil SOS".

- **Belum ada sama sekali.** Backend hanya punya layanan *per bengkel* (`services`), tanpa kategori global.
- **BE · M** → [BE-3](status_backlog_prd.md#be-3-kategori-layanan-global): tabel `service_categories` dan relasi `services.category_id`, plus endpoint `GET /service-categories` yang mengembalikan harga termurah per kategori.
- **KONTEN**: ikon, deskripsi, dan badge per kategori. Badge seperti "Garansi 14 Hari" dan "Trade-in Aki" adalah janji bisnis.
- **FE · M**: grid 3×2 dan halaman "Semua layanan". "Pilih Jadwal" diarahkan ke pencarian bengkel yang difilter kategori.

### 3.4 "Bengkel Rekomendasi Terdekat" (carousel)

| Elemen kartu Stitch | Sekarang | Tindakan | Jenis |
|---|---|---|---|
| **Foto bengkel** (rasio ±16:9) + badge "Mitra Resmi BengkelGo" + chip jarak di atas foto | tanpa foto | [BE-2](status_backlog_prd.md#be-2-profil-bengkel-diperluas-foto-fasilitas-wilayah-merek): upload & simpan foto. **KONTEN**: foto asli tiap bengkel. Foto di Stitch adalah gambar AI yang di-host sementara oleh Google, jadi tidak bisa dipakai. | BE + KONTEN + FE · M |
| Baris "KEBAYORAN BARU, JAKARTA SELATAN" (wilayah) + rating "(418)" | alamat penuh | Butuh kolom kecamatan/kota terstruktur (BE-2) atau parsing alamat. | BE · S |
| Deskripsi spesialisasi | tidak tampil di kartu | `description` sudah ada → tampilkan. | FE · S |
| Chip fasilitas (AC Lounge, Free WiFi, Buka Hari Minggu, Free Coffee, Garansi Part Asli, QRIS Ready, Laser Calibrated, Emergency Towing, Musholla) | chip kendaraan + SOS | Fasilitas → BE-2. "QRIS Ready" = `has_qris` (sudah ada). | BE + FE · S |
| Kotak hijau "Hari Ini: 3 Slot Jam 14:00 • Pessimistic Locked" | – | Butuh **slot kosong berikutnya** per bengkel di respons list (BE, [BE-4](status_backlog_prd.md#be-4-cari-bengkel-berdasarkan-ketersediaan-slot)). Alternatif FE: panggil `/availability` per kartu, tapi boros request. | BE · M |
| "Paket Servis Mulai Rp 175.000" | – | Butuh `min_service_price` di respons `GET /workshops` (BE, S). | BE · S |
| Tombol navy "Pilih Jadwal" | tombol biru | Ikuti token. | FE · S |
| Carousel dengan panah ‹ › + label "Top Verified • Pilihan Komunitas Otomotif" | grid | Ubah jadi carousel horizontal (scroll-snap). | FE · S |

### 3.5 "Pantau Bengkel & Unit Towing Aktif di Sekitar Anda" (peta radar)

Isinya: peta lebar, kartu melayang "SOS Dispatcher Ready / Mekanik Terdekat Terdeteksi: Teknisi Roni Santoso (Motor Siaga & Jumper Kit) berjarak 850m / Estimasi 12–18 menit / Rating 4.96 / Panggil Teknisi Ini Sekarang", dan chip "14 Armada Siap Dispatch".

- **FE · M**: peta + penanda bengkel (bisa memakai `GET /workshops` dengan lat/lng).
- **BE · L**: "mekanik terdekat" dan "armada siap" butuh **lokasi mekanik/armada** (backend hanya tahu lokasi bengkel) → [BE-7](status_backlog_prd.md#be-7-armada--lokasi-mekanik-live).
- **INT**: estimasi waktu tiba (ETA) butuh layanan routing (OSRM/Google Directions).

### 3.6 "Teknologi Andal, Servis Transparan Tanpa Tipu-tipu" (4 kartu keunggulan)

Kartu: Sistem Kuota Anti-Antre, PostGIS Smart Routing 5 KM, Pembayaran Aman QRIS Statis, **Garansi Perbaikan 14 Hari**.
- **FE · S** untuk 3 kartu pertama (fiturnya sudah ada).
- Kartu ke-4 **KONTEN/KEPUTUSAN**: garansi 14 hari belum menjadi fitur atau kebijakan.

### 3.7 "Dipercaya Lebih dari 120.000+ Pemilik Kendaraan" (testimoni + rating 4.9/5.0)

- **BE · S**: angka pengguna dan rata-rata rating platform dari `GET /stats/public` (BE-1).
- **BE · S**: testimoni sebaiknya diambil dari **ulasan asli** (tabel `reviews` sudah ada). Perlu endpoint `GET /reviews/featured` (ulasan bintang 5 terbaru + nama pelanggan, kendaraan, layanan). Kendaraan pelanggan belum tersimpan → [BE-9](status_backlog_prd.md#be-9-detail-kendaraan--jenis-masalah-darurat).
- ❌ Jangan memakai testimoni dan angka "120.000+" dari mockup. Itu karangan.

### 3.8 Banner mitra "Tingkatkan Omzet Bengkel Anda hingga 180%…"

Gradien navy→biru, 2 tombol ("Daftarkan Bengkel Sekarang", "Pelajari Skema Kemitraan"), 3 centang ("Gratis Biaya Pendaftaran", "Aplikasi Owner Bengkel Lengkap", "Pelatihan Standar Servis").
- **FE · S** untuk tampilan.
- **KONTEN**: klaim "180%" dan "Pelatihan Standar Servis" harus benar. Halaman "Skema Kemitraan" belum ada.

### 3.9 FAQ (4 pertanyaan, accordion) + "Panduan & Tips Otomotif Terkini" (2 artikel)

- **FE · S**: accordion.
- **KONTEN**: jawaban FAQ dan artikel. Kalau artikel mau dikelola tim tanpa deploy, butuh tabel `articles` + admin CMS (**BE · M**).

### 3.10 Footer

Lihat [2.3](#23-footer).

---

## 4. Detail bengkel & booking (`/workshops/:id`): layar Stitch "Pilih Jadwal & Slot Kuota Servis"

### 4.1 Stepper

| Stitch | Sekarang | Tindakan | Jenis |
|---|---|---|---|
| Stepper **satu baris di bawah header**, menempel penuh lebar, garis penghubung antar langkah, langkah selesai bercentang hijau, langkah aktif berbadge "Langkah 2 • AKTIF ●" | 4 kotak dalam grid | Ubah jadi bar horizontal dengan konektor. | FE · S |
| Urutan: Bengkel & Paket → Pilih Jadwal & Slot Jam → Kendaraan & Pemilik → **Bayar & QRIS** | sama, tapi bayar dilakukan setelah booking | **KEPUTUSAN**: di Stitch bayar dulu, lalu "Booking Berhasil Dikonfirmasi". Di backend booking langsung `CONFIRMED`, dan bayar belakangan. Lihat [12.2](status_backlog_prd.md#122-alur-bayar-sebelum-atau-sesudah-konfirmasi). | KEPUTUSAN |

### 4.2 Banner "Pessimistic Quota Engine v4.0 Aktif: Slot jam yang Anda pilih langsung dikunci secara eksklusif selama **09:55** menit…"

- **BE · L**: backend **tidak mengunci slot sementara** (*hold*). Penguncian `FOR UPDATE` hanya terjadi di dalam transaksi `POST /booking`. Untuk menampilkan hitung mundur yang benar, butuh fitur reservasi sementara: `POST /booking/hold` → `{ hold_id, expires_at }`, kolom/tabel `slot_holds`, job pembersih, dan `POST /booking` yang menerima `hold_id`. Lihat [BE-5](status_backlog_prd.md#be-5-reservasi-sementara-hold-slot--batas-waktu-bayar).
- Tanpa BE-5, banner ini **tidak boleh** menampilkan timer (karena tidak benar).

### 4.3 Kartu bengkel terpilih

| Stitch | Sekarang | Tindakan | Jenis |
|---|---|---|---|
| Ikon toko, badge "Mitra Resmi", rating "(850+ ulasan)", "2.4 km dari lokasi Anda", nama, alamat, tombol "Ubah Bengkel" | header besar + peta di samping | Susun ulang jadi kartu ringkas tanpa peta. Jarak butuh lokasi user (`useGeolocation` + rumus haversine di FE). | FE · S |
| "PAKET SERVIS DIPILIH": nama paket, deskripsi, "Estimasi Durasi 75 Menit", "Garansi 14 Hari" | pemilihan layanan berupa grid kartu | Data durasi sudah ada. Pemilihan paket di Stitch dilakukan di langkah 1 (kartu terpisah), jadi pertimbangkan halaman/langkah pilih paket sendiri. Garansi → KONTEN/BE (kolom `services.warranty_days`). | FE + BE · S |
| Chip: "Sertifikasi Teknisi ASE & BNSP", "Sparepart Original 100%", "Ruang Tunggu AC & Free WiFi" | – | Fasilitas/sertifikasi bengkel → [BE-2](status_backlog_prd.md#be-2-profil-bengkel-diperluas-foto-fasilitas-wilayah-merek). | BE · S |
| Garis atas biru 3px pada kartu | – | FE. | FE · S |

### 4.4 "1. Pilih Tanggal Servis"

| Stitch | Sekarang | Tindakan | Jenis |
|---|---|---|---|
| 7 kartu tanggal: hari, angka, "Apr (Jum)", dan **status per hari** ("Sisa 3 Slot", "Tersedia Banyak", "Bengkel Tutup") | 7 kartu tanpa status | Butuh ringkasan ketersediaan **beberapa hari sekaligus**: `GET /workshops/:id/availability/summary?from=&to=` → `[{date, remaining, is_closed}]`. Saat ini hanya ada per tanggal (7 request jika dipaksa dari FE). Juga butuh **hari libur/tutup** bengkel (lihat BE-2: `closed_weekdays`, `holidays`). | BE · M |
| Tombol "Pilih di Kalender" (kanan atas) | input tanggal terpisah | Ubah jadi tombol yang membuka date picker. | FE · S |

### 4.5 "2. Pilih Jam Kedatangan & Slot Pit"

| Stitch | Sekarang | Tindakan | Jenis |
|---|---|---|---|
| Dikelompokkan per sesi: "Sesi Pagi (08:00–11:30 WIB) – Rekomendasi…", "Sesi Siang & Sore (13:00–17:30 WIB) – Kapasitas 4 Pit Hidrolik Aktif" | grid jam | Pengelompokan bisa di FE berdasarkan jam. | FE · S |
| **Pita istirahat** "12:00–13:00 WIB • Sesi Istirahat Mekanik, Kalibrasi Alat… – OPERASIONAL REHAT" | – | Butuh jam istirahat bengkel (BE-2: `break_start`, `break_end`). Logika slot di backend juga harus melewatkan jam ini. | BE · M |
| Rentang slot **mengikuti durasi layanan** ("08:00–09:15, WIB (75 menit)") | slot per jam tetap ("09:00–10:00") | Backend memakai slot **per jam**. Rentang berbasis durasi butuh perubahan mesin kuota yang besar. **KEPUTUSAN**: sebaiknya tetap per jam, dan tampilkan "estimasi selesai" = jam + durasi layanan. | KEPUTUSAN / BE · L |
| Badge "3 Slot", "Sisa 2 Slot", "Penuh" | "Sisa 3 slot" | Sama, tinggal disamakan tampilannya. | FE · S |
| Baris **teknisi + nomor pit** di tiap slot ("Teknisi Roni S. • Pit #1") | – | Mekanik baru ditugaskan **setelah** booking. Untuk menampilkannya sebelum booking, butuh penugasan mekanik per slot + konsep pit → [BE-6](status_backlog_prd.md#be-6-pit--bay-servis). | BE · L |
| Slot terpilih: label "Slot Terpilih", status "Terkunci", "Antrean #A-04 Dipesankan" | centang | "Terkunci" butuh BE-5. Format antrean "A-04" butuh perubahan format nomor antrean (BE, S). | BE |
| Slot penuh: tombol "+ Waiting List" | slot penuh tetap bisa dipilih (otomatis daftar tunggu) | Samakan tampilan dengan tombol eksplisit. | FE · S |
| Legenda Terpilih/Tersedia/Penuh (kanan atas) | legenda di atas grid | Pindah posisi. | FE · S |
| Kotak hijau "Jaminan Pasti Dikerjakan Tepat Waktu: … langsung masuk ke Pit #2 … terlambat lebih dari 15 menit…" | – | Kebijakan bisnis + pit. | KONTEN + BE-6 |

### 4.6 "3. Data Kendaraan & Catatan Khusus"

| Stitch | Sekarang | Tindakan | Jenis |
|---|---|---|---|
| **Kartu kendaraan tersimpan** ("Honda HR-V 1.5 E CVT, Plat B 1842 WKV • Tahun 2021", "Yamaha NMAX…") yang bisa dipilih + "Gunakan Kendaraan Lain" | input plat bebas | Butuh tabel `vehicles` milik pelanggan + CRUD + `orders.vehicle_id` → [BE-8](status_backlog_prd.md#be-8-kendaraan-tersimpan-pelanggan). | BE + FE · M |
| Catatan maks **300** karakter + teks "Teknisi akan membaca catatan ini pada lembar kerja pra-servis" | maks 500 | Samakan batas (backend menerima ≤ 500, jadi aman). | FE · S |
| **Layanan tambahan** dengan checkbox ("Flushing Minyak Rem DOT 4 +Rp85.000", "Ganti Filter Kabin AC +Rp95.000") | – | Booking saat ini hanya untuk **1 layanan**. Butuh `booking_items` (banyak layanan per pesanan) + flag `services.is_addon` + harga total dihitung server → [BE-10](status_backlog_prd.md#be-10-multi-layanan--add-on-per-pesanan). | BE + FE · L |

### 4.7 Ringkasan pesanan (kolom kanan)

| Stitch | Sekarang | Tindakan | Jenis |
|---|---|---|---|
| Badge "Aman & Terlindungi" | "Anti-overbooking" | Samakan teks. | FE · S |
| Kotak waktu kedatangan dengan ikon kalender + "Pit #2" | baris ringkas | Samakan layout; pit butuh BE-6. | FE + BE |
| **Rincian biaya per baris**: paket, tambahan, **"Promo Diskon Slot Pagi −Rp25.000"**, "Biaya Platform & Layanan Sistem GRATIS", "Biaya Reservasi Slot Anti-Wait Rp0" | 1 baris estimasi | Butuh add-on (BE-10), **promo/voucher** ([BE-11](status_backlog_prd.md#be-11-promo--voucher)), dan biaya platform (BE-12). | BE · L |
| "Total Tagihan (Nett) Rp410.000" + "Hemat Rp25.000 hari ini" | "Estimasi biaya" | Total dihitung server (BE-10/11). | BE |
| Daftar jaminan: "Garansi 14 Hari / 1.000 KM", "Garansi Tanpa Antre di Tempat", "Bisa Bayar via QRIS, **Virtual Account**, atau **Kartu**" | – | VA & kartu → INT (payment gateway). Garansi → KONTEN. | INT + KONTEN |
| Tombol "Lanjut ke Konfirmasi QRIS →" + teks persetujuan "Ketentuan Layanan & Kebijakan Pembatalan" | "Konfirmasi booking" | Teks tombol ikut alur [12.2](status_backlog_prd.md#122-alur-bayar-sebelum-atau-sesudah-konfirmasi). Halaman Ketentuan & Kebijakan Pembatalan → KONTEN. | FE + KONTEN |
| Kartu "Punya Pertanyaan Khusus? CS BengkelGo siap membantu 24 Jam – WhatsApp CS" | – | Butuh nomor WhatsApp CS. | KONTEN · S |

> Di Stitch, bagian **ulasan** dan **daftar mekanik** tidak ada di halaman ini. Agar 100% sama, keduanya harus dipindah (misalnya ke halaman profil bengkel tersendiri) atau dihapus dari halaman booking. **KEPUTUSAN**

---

## 5. Konfirmasi & Pembayaran QRIS: layar Stitch "Konfirmasi & Pembayaran QRIS"

Saat ini **tidak ada halaman tersendiri**. Panel QRIS menumpang di halaman detail pesanan. Agar sama, buat route baru, misalnya `/orders/:id/pay` (**FE · M**), yang dibuka setelah booking.

| Elemen Stitch | Tindakan | Jenis |
|---|---|---|
| Stepper semua langkah (1–3 centang, 4 "LANGKAH TERAKHIR") | Pakai komponen stepper dari 4.1. | FE · S |
| Kartu kuning **"Selesaikan Pembayaran Dalam: 14:42"** + "Slot Pit #2 (Antrean #A-04) sedang terkunci (Row-Lock)…" + bar progres oranye | Butuh **batas waktu bayar** + pelepasan slot otomatis jika lewat → [BE-5](status_backlog_prd.md#be-5-reservasi-sementara-hold-slot--batas-waktu-bayar). | BE · L |
| "KODE RESERVASI BGO-20250418-8921" + tombol salin | Format nomor pesanan saat ini `BK-YYYYMMDD-NNNNNN`. Ganti ke `BGO-…` jika diinginkan (BE, S), atau tampilkan `order_number` apa adanya (FE). | FE (+BE opsional) |
| Badge "METODE PRIORITAS INSTAN" + "Verifikasi Otomatis" | "Verifikasi otomatis" butuh pencocokan mutasi bank/OCR → INT. Tanpa itu, teksnya harus "Diverifikasi bengkel". | INT / KEPUTUSAN |
| Judul "Pembayaran QRIS Nasional" + logo "QRIS \| GPN" | Logo QRIS/GPN adalah merek dagang; pakai aset resmi sesuai ketentuan. | KONTEN · S |
| Kotak "TOTAL PEMBAYARAN RESMI Rp410.000 (Bebas Biaya Admin)" + tombol "Salin Nominal" | Data sudah ada. | FE · S |
| Gambar QR dengan **logo di tengah** + "BENGKELGO - MITRA PRESISI MANDIRI" + **"NMID: ID1020348291029"** | QR sudah ada (gambar QRIS statis bengkel). Nama merchant & NMID butuh kolom baru `workshops.qris_merchant_name`, `qris_nmid` (BE, S). Logo di tengah tidak bisa ditambahkan ke QRIS statis yang diunggah bengkel, karena gambar QR-nya milik bengkel. | BE · S |
| "3 Langkah Mudah Bayar" dengan nama penerima & nominal disebut | Sudah ada; tambahkan nama merchant + nominal di teks. | FE · S |
| Chip penyedia: BCA Mobile, Livin Mandiri, BRImo, GoPay, OVO, DANA, ShopeePay | Statis. Logo/nama merek → KONTEN. | FE · S |
| "Unduh Kode QR (PNG)" + "Sudah Scan? Konfirmasi di Bawah ↓" | Sudah ada tombol simpan; samakan. | FE · S |
| Kartu "Konfirmasi & Bukti Pembayaran" + badge "Otomatisasi 1–3 Menit" | Badge waktu otomatis butuh INT. | FE + INT |
| Dropzone **seret & lepas** | Sekarang hanya klik; tambahkan drag & drop. | FE · S |
| Input **"Nomor Referensi Bank / RRN (Opsional)"** dan **"Nama Pemilik Rekening / E-Wallet (Opsional)"** | `POST /payments/upload` hanya menerima file. Butuh kolom `transactions.payer_reference`, `payer_name` + validasi. | BE · S |
| Info "Dual-Layer Verification: … mencocokkan mutasi QRIS secara real-time via gateway perbankan" | Hanya benar jika INT dikerjakan. | INT / KONTEN |
| Tombol "Saya Sudah Membayar & Konfirmasi Bukti" | Ganti teks. | FE · S |
| "Ingin Menggunakan Metode Lain?": accordion **Virtual Account** (nomor VA + salin) dan **Bayar di Tempat (Kasir Bengkel)** + tombol "Ganti ke Bayar di Lokasi" | VA → INT (Midtrans/Xendit/dll.). Bayar di tempat → BE: kolom `transactions.method` (`QRIS`/`VA`/`CASH`) + alur verifikasi kasir oleh owner. | INT + BE · L |
| Kolom kanan: ringkasan pemesanan (bengkel, rating, jadwal, **Alokasi Pit & Mekanik**, **Kepala Mekanik**, kendaraan terdaftar, rincian paket & biaya, diskon, "Pajak Termasuk") | Sebagian ada (bengkel, jadwal, mekanik setelah konfirmasi). Pit (BE-6), kendaraan (BE-8), rincian (BE-10/11), pajak (BE-12). | FE + BE |
| "Jaminan Perlindungan Pengendara" (3 item) + "Butuh Bantuan Pembayaran? Chat WhatsApp CS 24 Jam" | KONTEN. | KONTEN · S |

---

## 6. Status booking & e-receipt (`/orders/:id`, tipe BOOKING): layar Stitch "Status Booking & E-Receipt Resmi"

| Elemen Stitch | Sekarang | Tindakan | Jenis |
|---|---|---|---|
| Kartu hero **horizontal**: ikon centang kiri, badge "PEMBAYARAN TERVERIFIKASI INSTAN (QRIS)", judul 2 baris, deskripsi; tombol kanan **"Unduh E-Receipt PDF"**, **"Simpan Pass"**, **"Bagikan"** | hero di tengah tanpa tombol | Susun ulang layout (FE). PDF: bisa dibuat di FE (mis. `jspdf`) atau di BE (`GET /orders/:id/receipt.pdf`). "Simpan Pass" (Google/Apple Wallet) → INT. "Bagikan" → Web Share API (FE). | FE + INT · M |
| Baris "NO. RESERVASI", **"NO. INVOICE INV/20250418/BGO/8841092"**, "WAKTU PEMBAYARAN", chip "LUNAS (PAID)" | nomor pesanan, tanggal dibuat, status bayar | Nomor invoice butuh kolom/generator `transactions.invoice_number` (BE, S). Waktu bayar = `verified_at` (sudah ada). | BE + FE · S |
| Kartu **"Digital Fast-Track Pass"** (latar putih): **QR code** + ID pass "BGO-PASS-8921", badge "Siap Check-In", "PIT #2 • Antrean #A-04", jadwal, **estimasi kedatangan "09:20 WIB (10 mnt lebih awal)"**, kepala teknisi + sertifikasi | kartu navy tanpa QR | (a) Ubah ke kartu putih (FE). (b) QR bisa dibuat di FE dari `order_number` (perlu library, mis. `qrcode`). Agar QR **bisa dipindai bengkel**, butuh endpoint check-in `POST /orders/:id/check-in` + status `CHECKED_IN` (BE, M). (c) Pit (BE-6), format antrean (BE). (d) Sertifikasi mekanik → kolom `mechanics.certifications` (BE-6/BE-7). | FE + BE · M |
| "Alur Kedatangan Express (Zero-Wait)" 3 langkah: Tiba (lajur "BengkelGo Priority"), Pindai QR Pass, Langsung ke Pit | – | Konten statis, tetapi menjanjikan proses fisik di bengkel. | KONTEN + BE (check-in) |
| Kartu bengkel: nama, rating "(1.240+ ulasan)", alamat + **patokan**, **peta mini dengan status lalu lintas** ("Lalu Lintas Lancar (18 menit dari lokasi Anda)"), tombol "Buka Rute Navigasi (Maps / Waze)" + "Hubungi Bengkel" | kartu tanpa peta | Peta mini (FE). Patokan → kolom `workshops.landmark` (BE-2). Lalu lintas & waktu tempuh → INT. | FE + BE + INT |
| Kartu **"E-Receipt BengkelGo"** + "TAX INVOICE VALID": pemilik, no. HP, mobil (model + tahun + plat), keluhan, tabel layanan & sparepart dengan subtotal, voucher, biaya platform, **kotak total biru "TOTAL PEMBAYARAN (LUNAS)"** + "QRIS BI Lunas Instan", jaminan, **"Security Hash"** | "Rincian pesanan" sederhana | Layout (FE). Model/tahun kendaraan (BE-8), banyak item (BE-10), voucher (BE-11). "Tax invoice" butuh data pajak resmi bengkel (NPWP) → KEPUTUSAN/legal. Security hash bisa berupa HMAC dari server (BE, S). | FE + BE · M |
| "Sinkronkan ke Kalender Pribadi" (Google Calendar, Outlook/Apple iCal) + "pengingat H-1 dan H-2 jam" | – | File `.ics` bisa dibuat di FE (S); link Google Calendar juga bisa dari FE. Pengingat **H-2 jam** belum ada di backend (cron sekarang hanya H-1 email) → BE. | FE + BE · S |
| Info **reschedule** "gratis maksimal 2 jam sebelum jadwal" + "Ubah Jadwal" | – | Belum ada endpoint ubah jadwal: `PATCH /orders/:id/reschedule` dengan penguncian kuota (BE, M). | BE · M |
| "Bantuan 24/7", "Kembali ke Beranda", "Lihat Riwayat & Status Servis Saya" | tombol kembali | FE. | FE · S |

---

## 7. SOS: tracking desktop (`/orders/:id`, tipe EMERGENCY): layar Stitch "Layanan Darurat SOS 24 Jam & Live Tracking 5 KM"

| Elemen Stitch | Sekarang | Tindakan | Jenis |
|---|---|---|---|
| **Strip header putih** (bukan blok merah): ikon SOS bulat berdenyut, "Layanan Darurat SOS 24 Jam (Roadside Breakdown)", badge "MEKANIK MENUJU LOKASI", "ID Laporan • Waktu Panggil • **Wilayah: DKI Jakarta Selatan**"; kartu kanan "ENGINE POSTGIS ST_DWITHIN 5 KM / Auto-Routing Presisi Aktif" + "Fallback auto-reassign: 01:37" | blok merah besar dengan countdown | Ubah layout (FE). Wilayah butuh reverse geocoding (INT) atau disimpan saat request (BE). | FE + INT · M |
| Peta besar: kotak alamat di atas ("RADIUS PERLINDUNGAN GPS: Jl. TB Simatupang KM 22…") + "Perbarui Titik" + "G-Maps"; **penanda mekanik bergerak** dengan label "Roni (2.1 KM)" + **garis rute putus-putus**; label "TITIK MOGOK ANDA"; lingkaran radius; chip "POSTGIS ST_DWITHIN: 5 KM RADIUS TERKUNCI"; tombol zoom kustom | peta biasa + 2 titik | Alamat (INT reverse geocoding). "Perbarui Titik" butuh endpoint ubah lokasi SOS (BE, S). **Posisi mekanik live + rute** → [BE-7](status_backlog_prd.md#be-7-armada--lokasi-mekanik-live) + INT routing. | FE + BE + INT · L |
| Baris statistik di bawah peta: **ETA "± 11 Menit"**, **Jarak Presisi "2.1 Kilometer"**, **Kondisi Lalu Lintas "Lancar"** | – | Jarak bisa dihitung (bengkel↔titik sudah ada; mekanik↔titik butuh BE-7). ETA & lalu lintas → INT. | FE + BE + INT · M |
| Timeline "Status Penanganan Darurat Real-Time" + badge "Live Sync": **jam di tiap langkah**, langkah aktif dalam kotak biru "Sedang Berlangsung • 09:18 WIB – Saat Ini", deskripsi rinci | timeline tanpa jam | Butuh **riwayat status dengan timestamp**: tabel `order_status_history (order_id, status, at, note)` + ditampilkan di `GET /orders/:id`. Saat ini hanya ada `created_at`, `responded_at`, `completed_at`. | BE · M |
| Langkah timeline Stitch (6): Diterima Dispatcher → Validasi PostGIS → Bengkel Konfirmasi → **Teknisi Meluncur** → **Penanganan, Diagnosa & Jumper** → **Penyelesaian & Berita Acara Digital** | 5 langkah | Status "meluncur" vs "tiba/menangani" dibedakan → status baru `EN_ROUTE`/`ARRIVED` atau dari BE-7. **Berita acara digital** (tanda tangan pelanggan) → BE (fitur baru). | BE · M–L |
| Kartu mekanik: **foto**, centang verifikasi, rating + "(420+ Panggilan SOS Sukses)", jabatan "Teknisi Senior Siaga Reaksi Cepat", **Armada Penolong "Motor Reaksi Cepat (B 3314 SBO)"**, Mitra Bengkel, **Pangkalan Siaga** + jarak; tombol merah "Hubungi Roni (Telepon)" + hijau "WhatsApp"; "Sambungkan ke Operator Call Center Darurat" | kartu tanpa foto/armada | Foto & jabatan mekanik → kolom `mechanics.photo_path`, `title`. Jumlah SOS sukses → agregasi (BE). Armada → [BE-7](status_backlog_prd.md#be-7-armada--lokasi-mekanik-live). Call center → KONTEN. Warna tombol telepon merah (FE). | BE + FE · M |
| Kartu "Kendaraan & Kendala": badge plat, **model**, **warna/tipe**, gejala, **"Peralatan Siaga Yang Dibawa Teknisi"** (chip) | jenis + plat + kendala | Model/warna → [BE-9](status_backlog_prd.md#be-9-detail-kendaraan--jenis-masalah-darurat) (atau BE-8). Peralatan → daftar peralatan per jenis masalah (BE, S) atau statis per kategori (FE). | BE · S |
| Kartu **"Estimasi Biaya Transparan"** + badge "ANTI-GETOK HARGA": rincian (Biaya Panggilan Darurat Radius 5 KM, Diagnosa & Jumper, Biaya Platform GRATIS), total, "Jaminan Standar SK BengkelGo", "Metode Bayar di Lokasi: QRIS, GoPay/OVO, Tunai" | estimasi 1 angka | Rincian biaya → tarif dasar SOS per bengkel (`workshops.emergency_base_fee`) + item biaya pada order (BE-10). Metode tunai → `transactions.method` (BE). | BE · M |
| Banner **navy** "Prosedur Keselamatan…" 3 langkah + "CALL CENTER DEREK & POLISI TERPADU 1500-898" + tombol "Batalkan Permintaan Bantuan" | kartu kuning | Ubah ke banner navy + pindahkan tombol batal ke sini. Nomor call center → KONTEN. | FE + KONTEN · S |
| **Modal batal** dengan dropdown alasan (Mesin sudah menyala, Bantuan derek polisi/tol, Salah titik, Lainnya) + "Kembali ke Peta" / "Ya, Batalkan SOS" | `confirm()` bawaan browser | Modal (FE, S). Alasan disimpan butuh `PATCH /orders/:id/cancel` menerima `reason` + kolom `orders.cancel_reason` (BE, S). | FE + BE · S |

## 8. SOS: tracking mobile (390px): layar Stitch "SOS Darurat & Live Tracking 5 KM (Mobile)"

| Elemen Stitch | Tindakan | Jenis |
|---|---|---|
| **Top bar khusus** (bukan header situs): tombol back, judul "Live Mechanic Tracking", ikon headset (bantuan), avatar | Layout mobile khusus untuk halaman SOS (FE, M). | FE · M |
| Strip: chip ID, "Mekanik OTW", timer merah "01:33"; baris "PostGIS ST_DWithin: Radius < 5 KM • Auto-Fallback Aktif" | FE. | FE · S |
| Peta **full-bleed** dengan tombol bulat "lokasi saya" & "layer"; label mekanik + plat; label "Mobil Mogok Anda" | BE-7 untuk posisi mekanik. | FE + BE |
| Kartu melayang di bawah peta: **ETA ±11 Menit**, Jarak 2.1 KM • nama jalan, chip "Lancar" | INT. | INT |
| Kartu mekanik dengan foto + "Unit: Reaksi Cepat Vario 160 (B 3314 SBO)", tombol "Telepon Langsung" (merah) / "Chat WhatsApp" (hijau), "Pusat Bantuan 1500-898" | BE-7 + KONTEN. | BE + KONTEN |
| Kartu kendaraan: model, plat • warna, chip kategori ("Aki / Kelistrikan"), gejala, peralatan | BE-9. | BE |
| Timeline dengan jam, "Rincian Biaya Pasti", "Petunjuk Keselamatan", tombol "Batalkan Panggilan Darurat" + "Pembatalan gratis sebelum teknisi tiba" | Sama seperti desktop. Kebijakan "pembatalan gratis" → KONTEN. | FE + BE + KONTEN |

> Catatan: Stitch **tidak punya desain form permintaan SOS** (halaman `/emergency` sekarang). Form ringkasnya ada di **tab 2 beranda** (lihat 3.1). Agar 100% sama, `/emergency` diganti dengan tab tersebut, atau desain form SOS dibuat dulu di Stitch.

---

## 9. Dashboard owner (`/owner`): layar Stitch "BengkelGo Mitra – Dashboard Operasional & Kuota"

Header dan tab: lihat [2.4](#24-portal-owner-header--tab-horizontal-bukan-sidebar).

| Elemen Stitch | Sekarang | Tindakan | Jenis |
|---|---|---|---|
| **Banner SOS masuk** (latar merah muda, bukan kartu putih): ikon, badge "EMERGENCY SOS RADIUS 2.1 KM", ID, chip **kategori masalah** ("Aki / Alternator Melemah"), nama pelanggan • **mobil + warna + plat**, alamat, "Estimasi Tempuh Motor Siaga: 7 Menit", kotak timer "01:20 menit / Auto-fallback aktif", tombol **"Terima & Tugaskan Roni Santoso"** + "Tolak / Alihkan" | kartu putih dengan header merah | Layout (FE). Kategori & mobil → BE-9. Waktu tempuh → INT. **Memilih mekanik saat menerima**: `PATCH /emergency/:id/respond` perlu menerima `mechanic_id` (saat ini mekanik dipilih otomatis oleh server) → BE, S. | FE + BE · M |
| KPI 1 "PANGGILAN SOS HARI INI 8 • Selesai, 1 Sedang ditangani Roni, Avg 3.2m respons" + progress bar | "Darurat ditangani" | Butuh statistik owner per hari: total SOS, selesai, rata-rata waktu respons (`responded_at - created_at`) → `GET /workshops/me/stats?date=` (BE, M). | BE · M |
| KPI 2 "UTILISASI KUOTA SLOT 88% 28/32 Slot Terkunci, Redis Concurrency Safe, Sisa 4 Slot Bebas" + bar | sudah ada (tanpa bar) | Tambah progress bar + teks. | FE · S |
| KPI 3 "MEKANIK SIAGA & LAPANGAN 6/6 100% Aktif, 4 Pit Hidrolik • 2 Unit Reaksi Cepat, Shift Pagi" | – | Jumlah mekanik aktif ada. Pit & unit (BE-6/BE-7). **Shift** mekanik → fitur jadwal shift (BE, M). | FE + BE |
| KPI 4 "PENDAPATAN BRUTO HARI INI Rp 4.850.000, 14 Transaksi QRIS Lolos, Buku Kas Harian" | – | Butuh laporan pendapatan per bengkel: `GET /workshops/me/stats` (BE, S). "Buku Kas Harian" = halaman laporan owner baru (FE + BE, M). | BE · M |
| **"Manajemen Kuota Slot & Jalur Pit"**: daftar **pit** (Pit 1 Hidrolik Heavy Lift, Pit 2 Quick Bay…) + kapasitas, teknisi, alat, status ("Berjalan 55m", "Terkunci Antrean", "Pit Bebas"); **timeline slot per pit** berisi kendaraan + plat + layanan + status (Selesai/Aktif/Tunggu Bayar/Antrean #A-05/Tersedia 1 Slot) | halaman kuota terpisah, per jam saja | Ini fitur terbesar di layar owner → [BE-6 Pit / bay servis](status_backlog_prd.md#be-6-pit--bay-servis): tabel `workshop_bays`, penugasan booking ke bay, status per bay. FE: komponen papan pit. | BE + FE · L |
| Tombol "Tambah Slot Darurat (+1)", "Kunci Slot Alat (Maint.)", "4 Jalur Pit Hidrolik Beroperasi Normal", tombol tune per pit | – | "+1" bisa memakai `PUT /workshops/quotas` yang sudah ada (FE). "Kunci slot maintenance" butuh `max_slot_per_hour = 0` + alasan (BE, S). | FE + BE · S |
| Grafik **"Throughput Unit Masuk & Utilisasi Per Jam"** (batang + garis, "Peak 10:00–11:00", jam sekarang ditandai "(Kini)") | – | Data per jam sudah ada di `GET /workshops/quotas?date=` (booked vs max). Buat grafik di FE (S). "Throughput unit masuk" sebenarnya butuh check-in (lihat 6). | FE · S |
| Kartu **"Verifikasi Pembayaran QRIS"** + "1 Menunggu Validasi": invoice no., nominal, judul booking, **thumbnail bukti**, badge "Auto-OCR 99%", ukuran file, bank/QRIS antarbank, atas nama, RRN, waktu transfer; tombol "Verifikasi & Rilis Digital Pass" + "Minta Re-upload"; "14 Struk terverifikasi otomatis hari ini • Buka Ledger" | daftar sederhana (nama + nominal) | Thumbnail bisa di FE (`useProtectedImage` + `paymentApi.proofPath`). Nama pemilik & RRN → BE (lihat bagian 5). OCR & hitungan otomatis → INT. "Ledger" → halaman laporan owner (BE + FE). Tombol verifikasi langsung dari dashboard (FE, S). | FE + BE + INT |
| Kartu **"Tim Mekanik & Penugasan"**: foto, nama, badge keahlian ("Master ASE", "Reaksi Cepat", "Teknisi Rem", "Spooring Pro"), tugas sekarang ("Tugas: Pit #2 (Tune-Up HR-V)", "Menuju SOS TB Simatupang"), rating, status ("Di Bengkel", "ETA 7m", "Tersedia"); tombol tambah; "Total 6 mekanik terdaftar aktif • Atur Jadwal Shift" | halaman mekanik terpisah | Foto mekanik (BE). Tugas & status sekarang → turunkan dari order aktif per mekanik (BE: tambahkan `current_order` di `GET /workshops/mechanics`). ETA → INT. Shift → BE. | BE + FE · M |
| Kartu "Radar Satelit SOS (5 KM) – Menerima sinyal darurat otomatis… • Aktif" | – | Status = `accepts_emergency` (FE). | FE · S |
| Footer strip status sistem + "Latensi 24ms" | – | [BE-14](status_backlog_prd.md#be-14-health--telemetri-admin--owner). | BE · S |

> Halaman owner yang **tidak ada di Stitch**: Pesanan (list), Layanan, Mekanik (detail), Profil & QRIS. Lihat [bagian 11](status_backlog_prd.md#11-halaman-yang-belum-ada-desainnya-di-stitch).

---

## 10. Dashboard admin (`/admin`): layar Stitch "BengkelGo Admin – Platform Governance, Workshop Approval & Financial Analytics"

Sidebar & top bar: lihat [2.5](#25-portal-admin-sidebar--top-bar). Di Stitch semuanya ada di **satu halaman dashboard**. Sekarang dipecah menjadi `/admin/workshops` dan `/admin/reports`.

| Elemen Stitch | Sekarang | Tindakan | Jenis |
|---|---|---|---|
| Toast hijau "Aksi Berhasil – Perubahan status mitra telah dipublikasikan…" | alert inline | Komponen toast (FE, S). | FE · S |
| **Modal "Audit Log Transaksi BI RFC-5424"** berisi log mentah (timestamp, POST webhook, SHA256, RRN, acquirer, gross, fee 5%, net, OCR match, ledger entry) + "Unduh Raw Cryptographic Log" | – | Butuh audit log ([BE-13](status_backlog_prd.md#be-13-audit-log)) + webhook bank (INT). | BE + INT · L |
| Hero: chip "Governance Core Sprint 4 • PBI-405/406", judul besar, deskripsi, **dropdown rentang tanggal**, **"Export Audit CSV / PDF"**, **"Sinkronisasi Manual Bank Gateway"** | judul + 2 input tanggal | Dropdown periode (FE). Export CSV bisa di FE dari data laporan (S); PDF (FE lib atau BE). Sinkron bank → INT. | FE + INT |
| KPI 1 **GTV** "Rp 1.482.950.000 +18.4% MoM, 12.420 Transaksi Selesai via QRIS & VA" | "Pendapatan terverifikasi" | Pertumbuhan MoM: laporan perlu membandingkan periode sebelumnya (BE, S, atau FE dengan 2 panggilan). | FE/BE · S |
| KPI 2 "Mitra Bengkel Aktif & Siaga 148 Bengkel, 142 Ready, 98.2% Service Rate, 8 bengkel baru butuh persetujuan" | – | Butuh hitungan bengkel per status + "ready" (buka & punya mekanik) → `GET /admin/stats` (BE, S). | BE · S |
| KPI 3 "Panggilan Darurat SOS Selesai 1.894 Kasus, Avg Dispatch 3.8 Menit, Tingkat Auto-fallback < 1.4%" | – | Agregasi dari `emergency_details` (`routing_attempts`, `responded_at`) → `GET /admin/stats` (BE, S). | BE · S |
| KPI 4 "Pendapatan Platform (Take Rate) Rp 74.147.500, 5% Net Fee, Rekonsiliasi Bank 100% Sesuai" | – | **Model bisnis komisi 5% belum ada** (pembayaran langsung ke QRIS bengkel). → [BE-12](status_backlog_prd.md#be-12-komisi-platform--biaya-layanan) + **KEPUTUSAN** bisnis. | KEPUTUSAN + BE · L |
| **"Pipeline Persetujuan Kemitraan Bengkel Baru"** + "3 Menunggu Verifikasi Manual": kartu besar dengan **foto bengkel**, badge **"Grade A Umkm"**, alamat, pemilik + **"NIK & WA OTP Verified"**, **skor verifikasi 94/100**, kapasitas (4 pit), unit SOS (2 motor), **sertifikasi mekanik (5 teknisi BNSP)**, koordinat + **peta coverage 5 km** + cek "bebas kanibalisasi mitra" & "zonasi Pemprov", **berkas terlampir** (NIB, NPWP, Foto Fasad & Pit, Buku Rekening), tombol "Jadwalkan Survei Lapangan", "Tolak & Minta Perbaikan Dokumen", "Setujui & Terbitkan Akses Kemitraan"; **antrean berikutnya** (inisial, kota, % dokumen lengkap, status "Menunggu Audit NPWP"/"Menunggu Validasi GPS", tombol "Periksa") | daftar kartu sederhana | Ini butuh **onboarding mitra yang lengkap** → [BE-17](status_backlog_prd.md#be-17-dokumen--verifikasi-mitra): upload dokumen, verifikasi NIK & OTP WhatsApp (INT), skor verifikasi, grade UMKM, jadwal survei, status "perlu perbaikan". Peta coverage + cek tumpang-tindih radius dengan mitra lain (BE: query PostGIS, S). Zonasi Pemprov → INT/data eksternal. | BE + INT · L |
| **"Spatial & Infra Telemetry"** + "Live Node": PostGIS cluster (latensi, validitas indeks GIST), Redis lock engine (deadlock, rata-rata hold time), Node-Cron worker (jadwal berikutnya, jumlah pengingat), OWASP monitor | – | [BE-14](status_backlog_prd.md#be-14-health--telemetri-admin--owner). Beberapa metrik (deadlock, hold time) perlu instrumentasi khusus. | BE · M–L |
| **"Audit Rekonsiliasi Transaksi Finansial"**: tab filter (Semua, Berhasil Lunas, Menunggu Verifikasi, **Refund/Sengketa**), **kotak cari** "ID Invoice atau RRN", **tabel per transaksi** (ID & invoice, waktu & layanan, pelanggan & kendaraan, bengkel tujuan, metode & RRN, nilai kotor, **fee 5%**, **net bengkel**, status audit "Lunas (Auto-OCR 99%)"), **paginasi** ("1–3 dari 12.420") | laporan agregat (per tipe, per status, top bengkel, harian) | Butuh **endpoint daftar transaksi** untuk admin: `GET /admin/transactions?status=&q=&page=` + total (BE, M). Refund/sengketa → status pembayaran baru + alur (BE, L). Fee & net → BE-12. RRN → bagian 5. OCR → INT. | BE + INT · L |
| Footer strip "Enkripsi Data…", "PostGIS Cluster Latency 14ms", "Audit Log RFC-5424 Active" | – | BE-13 / BE-14. | BE · S |

> Laporan agregat yang **sudah ada** (per tipe, per status, top bengkel, tren harian) **tidak ada** di desain Stitch. Agar 100% sama, bagian ini dihapus atau dipindah ke halaman "Audit Transaksi". **KEPUTUSAN**

---

## 11–15 & Lampiran A: dipindah ke status backlog

Daftar pekerjaan yang belum dikerjakan (halaman tanpa desain Stitch, konflik yang harus diputuskan tim, daftar perubahan backend BE-1 s/d BE-17 + BE-lain, integrasi pihak ketiga, urutan pengerjaan, dan aset yang harus disiapkan tim) sekarang ada di **[status_backlog_prd.md](status_backlog_prd.md#lampiran-1-sisa-pekerjaan-dari-rencana-desain-stitch)**, supaya semua pekerjaan tertunda ada di satu file.

Bagian 1–10 di atas tetap di sini sebagai pembanding per layar Stitch; item terbukanya sudah dirangkum di lampiran tersebut sebagai BE-x / INT / KONTEN / KEPUTUSAN.

---

## Lampiran B: Yang sudah sesuai Stitch saat ini

- Font (Plus Jakarta Sans + Inter) dan ikon (Material Symbols Outlined)
- Warna semantik: merah SOS, hijau sukses, amber peringatan, navy teks, abu-abu border
- Chip status huruf kapital dengan titik warna
- Tombol pil, input setinggi 48px dengan ikon di kiri
- Strip tanggal 7 hari, kartu slot dengan progress kuota
- Panel QRIS 3 langkah + dropzone unggah bukti
- Timeline SOS bertitik, kartu mekanik dengan tombol Telepon/WhatsApp, tips keselamatan
- Kartu SOS masuk di dashboard owner dengan timer, serta tombol Terima/Tolak
- `data-testid` pada elemen kunci untuk E2E (PBI-407)
