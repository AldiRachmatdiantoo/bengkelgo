# Rancangan alur bertahap (wizard)

**Dibuat:** 15 November 2026 · **Status:** tahap 1 (darurat) selesai 15 Nov, tahap 2 dan seterusnya belum
**Usulan dari:** tim (Aldi). Tampilan sekarang sudah bagus, tapi formulir yang panjang dalam satu halaman membuat pengguna bingung harus mulai dari mana. Usulannya: isian dipecah per langkah dengan tombol **Lanjut**, berurutan, dan tidak hanya untuk darurat.

Dokumen ini berisi rancangan saja. Kode belum diubah.

---

## 1. Masalah di alur sekarang

| Halaman | Kondisi sekarang | Kenapa membingungkan |
|---|---|---|
| Bantuan darurat (`/emergency`) | Satu halaman: kartu lokasi + peta, kendaraan & kendala, kontak, kisaran biaya, dan panel "Bengkel siaga dalam 5 km" yang baru terisi setelah menekan **Pindai** | Orang yang sedang mogok melihat banyak kotak sekaligus. Panel bengkel ada di samping/bawah dan harus dipindai sendiri, padahal bengkel dipilih otomatis oleh sistem. Tombol kirim baru terlihat setelah menggulir jauh. |
| Detail booking (`/workshops/:id`) | Satu halaman: info bengkel, kendaraan, layanan, jadwal (tanggal + jam), WhatsApp, keluhan, lalu ulasan & mekanik di bawah tombol | Pilihan wajib dan opsional bercampur. Ulasan dan mekanik ikut menumpuk di halaman yang sama dengan formulir. |
| Pilih bengkel (`/workshops`) | Lokasi, jenis kendaraan, nama bengkel, jadwal, lalu daftar hasil | Filter dan hasil berada di satu layar panjang; di HP hasil baru terlihat setelah menggulir. |
| Pembayaran (`/orders/:id/pay`) | QRIS, ringkasan, unggah bukti, nomor referensi, nama pengirim dalam satu halaman | Masih wajar, tapi urutan "bayar dulu, baru unggah bukti" tidak terlihat jelas. |
| Daftar mitra (`/register/workshop`) | Satu formulir panjang: data pemilik, data bengkel, jam, kapasitas, jenis kendaraan, peta | Formulir terpanjang di aplikasi; kesalahan di bagian atas baru terlihat setelah menekan kirim di paling bawah. |

---

## 2. Prinsip yang berlaku di semua alur

1. **Satu tugas per langkah.** Setiap layar punya satu judul pertanyaan ("Di mana kendaraan Anda?") dan hanya isian untuk menjawabnya.
2. **Penanda posisi.** Bilah progres + teks "Langkah 2 dari 5" di atas judul. Langkah yang dilewati otomatis tidak dihitung.
3. **Tombol tetap di bawah.** Memakai `BottomBar` yang sudah ada: **Kembali** (kiri, sekunder) dan **Lanjut** (kanan, utama). Di langkah terakhir tombol utama berganti sesuai aksi: "Kirim SOS", "Booking", "Kirim bukti", "Daftarkan bengkel".
4. **Lanjut hanya aktif bila langkah valid.** Kesalahan ditampilkan di langkah itu juga, bukan di akhir.
5. **Isian tidak hilang.** Kembali ke langkah sebelumnya tidak menghapus isian. Draft disimpan per tab (`sessionStorage`, seperti draft booking sekarang), jadi aman saat muat ulang atau saat diminta masuk akun.
6. **Langkah per URL.** `?langkah=2` di alamat, sehingga tombol back browser/HP mundur satu langkah, bukan keluar dari alur.
7. **Langkah dilewati bila datanya sudah ada.** Contoh: pengguna yang sudah masuk dan punya nomor WhatsApp tidak melihat langkah kontak; kendaraan tersimpan cukup dipilih satu ketukan.
8. **Ringkasan sebelum kirim.** Langkah terakhir menampilkan semua pilihan dengan tombol **Ubah** per bagian yang melompat langsung ke langkahnya.
9. **Aksesibilitas.** Saat pindah langkah, fokus pindah ke judul langkah dan pembaca layar mengumumkan "Langkah 3 dari 5: Keluhan". Tombol 44 px, kontras seperti sekarang.
10. **Desktop.** Tetap bertahap, tapi kolom isian maks. ±560 px di tengah, dengan ringkasan pilihan sejauh ini di kolom kanan (layar ≥ 1024 px).

---

## 3. Alur bantuan darurat (prioritas pertama)

Target: dari membuka halaman sampai SOS terkirim **di bawah 1 menit**. Karena itu setiap langkah sebisa mungkin terisi otomatis.

| # | Langkah | Isi layar | Bisa dilewati? |
|---|---|---|---|
| 1 | **Lokasi** | Judul "Di mana kendaraan Anda?". GPS langsung diminta saat halaman dibuka (dengan dialog izin yang sudah ada). Peta dengan titik yang bisa digeser, kotak cari lokasi, kolom patokan (opsional). Lanjut aktif setelah titik ada. | Tidak |
| 2 | **Bengkel terdekat** | Pindai dijalankan otomatis begitu masuk langkah ini (endpoint scan yang sudah ada). Peta radius 5 km + daftar bengkel siaga beserta jarak, label "Prioritas" dan "Mekanik sibuk". Teks jelas: *"Sistem menghubungi bengkel prioritas lebih dulu. Jika tidak merespons dalam 2 menit, permintaan pindah ke bengkel berikutnya."* Pengguna **tidak memilih** bengkel (sesuai backend sekarang). Bila 0 bengkel: pesan kosong + tombol "Geser lokasi" kembali ke langkah 1, Lanjut nonaktif. | Tidak |
| 3 | **Kendaraan** | Kendaraan tersimpan sejenis sebagai kartu pilihan (yang pertama sudah terpilih), atau "Motor/Mobil lain" + plat (opsional). | Dilewati bila tidak ada kendaraan tersimpan sejenis; plat lalu diisi di langkah Keluhan |
| 4 | **Keluhan** | Kategori masalah (aki, ban, mesin, bensin, derek, kunci) sebagai kartu pilihan; mengisi otomatis teks keluhan. Kolom "Apa yang terjadi?" (min. 5 karakter). Kisaran biaya yang disiapkan (opsional, default "Bisa dibicarakan"). | Tidak |
| 5 | **Kontak** | Tamu: nama + nomor WhatsApp. Akun Google tanpa nomor: nomor WhatsApp saja (disimpan ke akun). | Dilewati bila sudah masuk dan punya nomor |
| 6 | **Periksa & kirim** | Ringkasan: titik lokasi (peta kecil), bengkel prioritas, kendaraan, keluhan, kisaran, kontak. Tombol merah **Kirim SOS**. Setelah terkirim langsung ke halaman status darurat yang sudah ada. | Tidak |

Jumlah layar: **4** untuk pelanggan yang sudah masuk tanpa kendaraan tersimpan (1, 2, 4, 6), **5** untuk pelanggan dengan kendaraan tersimpan dan untuk tamu.

**Yang berubah saat dikerjakan (15 Nov):**
- Pilihan Motor/Mobil pindah ke langkah 2, karena daftar bengkel siaga bergantung pada jenis kendaraan. Langkah 3 tinggal memilih kendaraan tersimpan.
- GPS hanya jalan sendiri bila browser sudah pernah diizinkan. Bila belum, tombol "Gunakan GPS saya" tetap ditekan pengguna, supaya penjelasan izin lokasi muncul sebelum browser bertanya.
- Tombol Lanjut tidak dinonaktifkan; bila isian kurang, daftar "Lengkapi dulu" muncul di langkah itu.

Catatan:
- Urutan mengikuti usulan tim: GPS → bengkel → keluhan → nama. Kendaraan dipisah dari keluhan karena untuk pelanggan tetap ia sering terlewati otomatis.
- Payload ke backend **tidak berubah** (`latitude`, `longitude`, `vehicle_type`, `vehicle_plate`, `vehicle_id`, `problem_category`, `problem_description`, `price_min/max`, `address_note`, data tamu). Tidak perlu migrasi.

---

## 4. Alur booking servis

Sekarang: Pilih bengkel → Detail booking (satu halaman) → status pesanan → pembayaran.

| # | Langkah | Isi layar | Bisa dilewati? |
|---|---|---|---|
| 1 | **Kendaraan** | Motor/mobil, atau kendaraan tersimpan. | Terisi dari tombol "Servis motor/mobil" di beranda atau kendaraan tersimpan tunggal |
| 2 | **Bengkel** | Lokasi (GPS / cari daerah), lalu daftar bengkel yang melayani kendaraan itu, terdekat dulu. Ketuk kartu = pilih. Tautan "Lihat profil" membuka profil bengkel (foto, ulasan, mekanik) tanpa keluar dari alur. | Dilewati bila alur dimulai dari tombol "Booking di bengkel ini" di profil bengkel |
| 3 | **Layanan** | Kartu layanan dengan harga dan durasi. | Tidak |
| 4 | **Jadwal** | Chip tanggal (7 hari + "Lain") lalu chip jam beserta sisa tempat. Jam penuh tetap bisa dipilih dengan keterangan "masuk daftar tunggu". | Tidak |
| 5 | **Keluhan & kontak** | Keluhan (opsional, maks. 300 karakter). Nomor WhatsApp hanya bila akun belum punya. | Bisa dilewati (tombol "Lewati") |
| 6 | **Periksa & booking** | Ringkasan bengkel, kendaraan, layanan, tanggal & jam, keluhan, estimasi biaya. Bila belum masuk: tombol "Masuk untuk booking", draft tetap tersimpan dan pengguna kembali ke langkah ini setelah masuk. Tombol **Booking**. | Tidak |

Setelah booking: halaman status pesanan tetap seperti sekarang.

Perubahan halaman:
- `/workshops` menjadi langkah 1–2 alur booking (tab Terdekat dan Darurat tetap ada sebagai jalan pintas).
- `/workshops/:id` menjadi **profil bengkel** saja (foto, alamat, jam, ulasan, mekanik) dengan satu tombol **Booking di bengkel ini** yang memulai alur di langkah 3.
- Alur baru di `/booking` (atau `/workshops/:id/booking`).

Keputusan yang dibutuhkan: urutan langkah 1–2 (kendaraan dulu lalu bengkel, seperti di atas, atau bengkel dulu). Usulan: kendaraan dulu, karena hasil bengkel bergantung pada jenis kendaraan.

---

## 5. Alur pembayaran

| # | Langkah | Isi layar |
|---|---|---|
| 1 | **Bayar** | Kotak "Menunggu pembayaran", kartu QRIS dengan nominal, Simpan QR / Salin nominal. Tombol **Sudah bayar, lanjut**. |
| 2 | **Unggah bukti** | Foto/screenshot bukti, nomor referensi dan nama pengirim (opsional). Tombol **Kirim bukti**. |

Tombol "Bayar nanti" tetap ada di langkah 1.

---

## 6. Alur daftar mitra bengkel

| # | Langkah | Isi layar |
|---|---|---|
| 1 | **Akun pemilik** | Nama, email, WhatsApp, password. |
| 2 | **Data bengkel** | Nama bengkel, telepon, alamat, jenis kendaraan yang dilayani. |
| 3 | **Jam & kapasitas** | Jam buka-tutup, kapasitas booking per jam. |
| 4 | **Lokasi** | Peta + cari alamat, "Pakai sebagai alamat". |
| 5 | **Periksa & kirim** | Ringkasan dengan tombol Ubah, lalu **Daftarkan bengkel**. Setelahnya tetap ke halaman verifikasi email + status "menunggu persetujuan admin". |

---

## 7. Yang tetap satu halaman

Isiannya pendek atau dipakai berulang, jadi dipecah justru memperlambat:
- Masuk, daftar akun pelanggan (4 isian), lupa password, buat password baru, verifikasi email.
- Akun saya, Pengaturan bengkel (sudah dibagi tab), Kalender & kapasitas, semua halaman portal pemilik dan admin.
- Status pesanan dan status darurat (halaman pantauan, bukan formulir).

---

## 8. Komponen yang dibutuhkan

Dibangun di atas kit Figma yang sudah ada (`components/ui/screen.tsx`):

| Komponen | Fungsi |
|---|---|
| `StepFlow` | Pembungkus alur: daftar langkah, langkah aktif dari `?langkah=`, aturan lewati, fokus + pengumuman saat pindah langkah. |
| `StepProgress` | Bilah progres + "Langkah n dari m". |
| `StepFooter` | `BottomBar` dengan Kembali / Lanjut (atau aksi akhir), status loading. |
| `ReviewList` | Ringkasan langkah terakhir dengan tombol Ubah per baris (memakai `SummaryCard`). |
| `useStepDraft(key)` | Simpan/baca draft per tab, dibersihkan setelah berhasil kirim. |

---

## 9. Dampak

- **Backend:** tidak ada perubahan; semua payload sama.
- **Tes E2E yang perlu diubah:** `journeys.spec.ts` (booking & SOS), `backlog-features.spec.ts`, `smoke-mobile.spec.ts`, `place-search.spec.ts`, `geolocation.spec.ts`, `a11y.spec.ts` (halaman per langkah), `visual.spec.ts` (baseline baru). `data-testid` yang ada dipertahankan di langkahnya masing-masing agar perubahan tes kecil.
- **Copy:** setiap langkah butuh judul pertanyaan pendek; ditulis dengan aturan antislop yang sama.

---

## 10. Urutan pengerjaan yang diusulkan

| Tahap | Isi |
|---|---|
| 1 | Komponen `StepFlow` + `useStepDraft`, lalu **alur darurat** (paling berdampak, pengguna sedang dalam kondisi terburu-buru). |
| 2 | **Alur booking** + pemisahan profil bengkel. |
| 3 | Pembayaran 2 langkah. |
| 4 | Daftar mitra 5 langkah. |
| 5 | Perbarui tes E2E, baseline visual, status backlog; deploy. |

## 11. Pertanyaan untuk tim

1. Booking: kendaraan dulu lalu bengkel (usulan), atau bengkel dulu?
2. Darurat: cukup melihat bengkel yang ditemukan (sesuai backend sekarang), atau pengguna ingin **memilih** bengkel sendiri? Memilih sendiri butuh perubahan backend dan mengubah aturan pengalihan 2 menit.
3. Langkah ringkasan di darurat: tetap ada (lebih aman dari salah kirim) atau langsung kirim dari langkah kontak (lebih cepat)? Usulan: tetap ada, karena SOS memanggil mekanik sungguhan.
4. Desktop: bertahap seperti HP (usulan) atau tetap satu halaman dua kolom?
