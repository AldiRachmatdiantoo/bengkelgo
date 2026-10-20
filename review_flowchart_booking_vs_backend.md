# Review: Flowchart Booking vs Backend

**Dokumen yang direview:** [flowchart_booking_bengkel.md](flowchart_booking_bengkel.md)
**Dibandingkan dengan:** PRD v4.0 ([prd.md](prd.md)) dan backend yang sudah dibuat ([backend/](backend/README.md))
**Status:** untuk didiskusikan dengan tim. Belum ada perubahan kode.

---

## Kesimpulan singkat

Sebagian besar alur di flowchart **sudah sejalan** dengan backend. Ada **satu fitur besar yang belum ada sama sekali**, yaitu **sparepart**. Fitur ini juga tidak tercantum di PRD. Selain itu ada beberapa detail kecil yang perlu disamakan antara flowchart dan backend.

---

## Perbandingan per langkah

| Langkah di flowchart | Kondisi di backend | Status |
|---|---|---|
| Dashboard, lalu list rekomendasi bengkel | `GET /workshops` (urut rating tertinggi) | ✅ Sejalan |
| Filter "terdekat" | `GET /workshops?latitude=&longitude=&radius_km=` (urut jarak) | ✅ Sejalan |
| Filter "rating" dan "kombinasi" | Belum ada parameter `sort`. Kalau lokasi dikirim, hasil selalu diurutkan berdasarkan jarak saja | ⚠️ Perlu tambahan kecil |
| Cek sudah login atau belum | Frontend yang mengecek token; backend sudah mendukung | ✅ Sejalan |
| Register "username & password" | Backend memakai **nama, email, nomor WhatsApp, password**. Tidak ada username | ⚠️ Flowchart perlu disesuaikan |
| Login | `POST /auth/login`, plus Google OAuth yang belum muncul di flowchart | ✅ Sejalan (Google bisa ditambahkan ke flow) |
| Redirect kembali ke profil bengkel | Urusan frontend | ✅ Tidak butuh backend |
| Tampilkan profil bengkel dan jadwal | `GET /workshops/:id` dan `GET /workshops/:id/availability?date=` | ✅ Sejalan |
| Tampilkan **sparepart** | **Belum ada** | ❌ Belum ada |
| Pilih jadwal servis | Slot per jam lewat `POST /booking` | ✅ Sejalan |
| Katalog sparepart, lalu tambah ke list | **Belum ada** (tabel, endpoint, dan stok belum ada) | ❌ Belum ada |
| Konfirmasi ringkasan, lalu simpan booking | `POST /booking` | ✅ Sejalan, tapi belum mencakup sparepart |
| Tampilkan bukti atau tiket | Respons berisi `order_number`, `queue_number`, `status`; ada juga `GET /orders/:id` | ✅ Sejalan |

---

## Hal yang perlu dibahas & keputusan: dipindah

Pertanyaan untuk tim dan ringkasan keputusan (sparepart, pilih layanan, slot penuh, login di awal/akhir, filter "kombinasi", data registrasi, flowchart lain) sekarang ada di **[status_backlog_prd.md](status_backlog_prd.md#lampiran-2-keputusan-dari-review-flowchart-booking)**.
