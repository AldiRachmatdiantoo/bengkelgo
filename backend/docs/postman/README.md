# Dokumentasi API: Postman

| File | Isi |
| --- | --- |
| `Bengkel-API.postman_collection.json` | 106 request dalam 14 folder. Setiap request punya deskripsi, aturan field, kode error, dan contoh respons asli. |
| `Bengkel-API.local.postman_environment.json` | Variabel `server_url`, `base_url`, `admin_email`, `admin_password`. Tidak masuk Git (berisi password); salin dari `Bengkel-API.local.postman_environment.example.json` lalu isi `admin_password`. |
| `sample-image.png` | Gambar contoh untuk request upload QRIS dan bukti bayar. |

## Import ke Postman

1. Buka Postman, klik **Import**, lalu pilih kedua file `.json` di atas.
2. Di kanan atas, pilih environment **Bengkel API - Local**.
3. Sesuaikan isi environment:
   - `server_url`:
     - `http://localhost:8080` kalau lewat NGINX (`docker compose up`)
     - `http://localhost:4000` kalau server jalan lewat `npm run dev`
   - `admin_email` / `admin_password`: samakan dengan `SEED_ADMIN_*` di `.env`.
4. Pastikan admin sudah dibuat:
   - Docker: jalankan `docker compose exec api node dist/db/seed.js`
   - Lokal: jalankan `npm run seed`

Dokumentasi yang mudah dibaca ada di tab **Documentation**, yaitu ikon 📄 di sidebar kanan collection.

## Menjalankan alur lengkap (end-to-end)

Klik kanan collection, pilih **Run collection**, lalu **Run**. Urutan request sudah disusun sebagai satu skenario utuh:

1. Pendaftaran:
   - Register customer dan owner bengkel.
   - Admin login, lalu meng-approve bengkel.
2. Persiapan oleh owner:
   - Mengatur profil dan mengupload QRIS.
   - Menambah layanan dan mekanik.
   - Mengatur kuota slot.
3. Emergency: guest scan radius 5 km, lalu mengirim request, lalu owner ACCEPT.
4. Booking: customer membuat booking, lalu membatalkannya.
5. Penyelesaian order: owner mengubah status menjadi IN_PROGRESS, lalu COMPLETED.
6. Pembayaran: guest membuka QRIS dan mengupload bukti bayar, lalu owner memverifikasi.
7. Guest memberi review.
8. Admin membuka laporan transaksi, lalu logout.

Token per role (`customer_token`, `owner_token`, `guest_token`, `admin_token`) dan ID (`workshop_id`, `service_id`, `emergency_order_id`, `booking_order_id`, dst.) **tersimpan otomatis** di collection variables. Jadi setiap request juga bisa dijalankan satu per satu setelah langkah sebelumnya dijalankan.

**Upload file:** saat request dijalankan manual di Postman Desktop, pilih ulang `sample-image.png` pada field file (`qris` / `proof`) jika Postman meminta. Agar file bisa dibaca dari folder ini, aktifkan *Settings → General → Allow reading files outside working directory*, atau salin file ke working directory Postman.

**Request yang sengaja gagal:**
- `Google OAuth 2.0 (PKCE)` mengembalikan 401/503 karena memakai authorization code contoh.
- `Respond Emergency — DECLINE` mengembalikan 409 karena order sudah di-ACCEPT.

**Rate limit:** endpoint auth dibatasi 15 request per 15 menit per IP. Satu kali run memakai 7 request auth. Kalau collection dijalankan berulang kali dan muncul **429**, tunggu 15 menit atau jalankan `docker compose exec redis redis-cli FLUSHALL` (lingkungan lokal saja).

## Memperbarui dokumentasi

Collection ini dihasilkan oleh `scripts/postman/build-collection.js`. Jangan edit file JSON secara manual; ubah script-nya lalu jalankan:

```bash
npm run docs:postman            # generate ulang collection + environment
npm run docs:postman:verify     # jalankan seluruh collection dengan Newman ke server yang hidup, lalu tempel respons asli sebagai contoh
```

`verify` membutuhkan stack yang berjalan (`docker compose up -d`) dan admin hasil seed. Token di contoh respons otomatis disamarkan menjadi `<redacted>`.
