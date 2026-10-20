# Deploy gratis BengkelGo (tanpa kartu kredit)

Disiapkan 20 Oktober 2026. Semua layanan di bawah memakai paket gratis dan tidak meminta kartu.

```
Browser ──► Vercel (frontend, https://<proyek>.vercel.app)
               │  /api/*  diteruskan (proxy) ke ▼
               ▼
            Render Free (API Docker, https://bengkelgo-api.onrender.com)
               ├─► Supabase: database PostgreSQL + PostGIS
               ├─► Supabase Storage: foto, QRIS, bukti bayar (bucket private "uploads")
               └─► Gmail API: email booking & pengingat
cron-job.org ──► GET /health tiap 10 menit (API tidak tidur, database Supabase tidak di-pause)
```

**Kenapa begini:**
- Render Free **memblokir port SMTP** sejak September 2025, jadi email lewat **Gmail API** (HTTPS). Pengirim tetap Gmail Anda.
- Render Free **tidak punya disk permanen** (file hilang setiap restart/deploy), jadi upload disimpan di **Supabase Storage**.
- Browser memanggil API lewat alamat Vercel sendiri (`/api/...`), jadi cookie login dianggap satu situs. Tanpa ini Safari/iPhone memblokir cookie dan pengguna terus ter-logout.
- Redis tidak dipakai: API cukup 1 instance, pembatas percobaan login menyimpan hitungan di memori.

**Batasan paket gratis:**
- Render Free: 750 jam/bulan (cukup untuk 1 layanan menyala terus), RAM 512 MB. Kalau ping cron-job.org berhenti, server tidur setelah ±15 menit dan request pertama butuh ±1 menit.
- Supabase Free: database 500 MB, Storage 1 GB. Proyek di-pause bila 7 hari tanpa aktivitas (ping /health mencegahnya).
- Gmail: ±500 email/hari.
- Setiap deploy ulang di Render, API restart (±1–2 menit tidak bisa diakses).

Yang perlu disiapkan: akun **GitHub**, **Supabase**, **Render**, **Vercel**, **Google Cloud** (akun Gmail pengirim), dan **cron-job.org**. Semua bisa daftar dengan akun GitHub/Google.

> **Aturan rahasia:** semua nilai rahasia (password database, service role key, client secret, refresh token) **hanya** diisi di dashboard Render atau `backend/.env` laptop. Jangan dikirim di chat, jangan di-commit.

---

## Langkah 1. Kode ke GitHub (private)

1. Buat repository **private** baru di GitHub, mis. `bengkelgo`.
2. Upload kode proyek ini. File `.gitignore` di folder utama sudah mengecualikan `.env`, `node_modules`, folder upload, file akun uji lokal, dan file environment Postman yang berisi password.
3. Setelah upload, buka repo di GitHub dan pastikan **tidak ada** file `.env` (hanya `.env.example`).

## Langkah 2. Supabase (database + penyimpanan)

1. [supabase.com](https://supabase.com) → **New project**. Region: **Southeast Asia (Singapore)**. Simpan **Database password** (di pengelola kata sandi, bukan di chat).
2. **Connect** (tombol di atas) → tab **Connection string** → pilih **Session pooler** → salin URI-nya, ganti `[YOUR-PASSWORD]` dengan password tadi. Ini `DATABASE_URL`.
   - Jangan pakai "Direct connection" (`db.xxx.supabase.co`): hanya IPv6, tidak bisa dari Render.
3. **Project Settings → API Keys**: salin **Project URL** (`SUPABASE_URL`) dan kunci **service_role / secret** (`SUPABASE_SERVICE_ROLE_KEY`). Kunci ini memberi akses penuh: hanya untuk server.
4. Tidak perlu membuat tabel, mengaktifkan PostGIS, atau membuat bucket: API melakukannya otomatis saat pertama jalan (migrasi 001–005 dan bucket private `uploads`).

## Langkah 3. Gmail API (email), boleh dikerjakan setelah langkah 8

Tanpa langkah ini API tetap jalan; email hanya dicatat di log Render, tidak terkirim. Google hanya mengizinkan **Publish app** setelah halaman Branding lengkap, dan kalau Google meminta home page/kebijakan privasi, itu butuh URL Vercel yang sudah online. Jadi urutan yang praktis: langkah 4–8 dulu, lalu kembali ke sini. Setelah mendapat nilainya, tambahkan `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, dan `MAIL_FROM` di Render → service → **Environment** → **Save**.


Sekali saja, ±15 menit, di [console.cloud.google.com](https://console.cloud.google.com) dengan akun Gmail pengirim:

1. Buat project baru, mis. "BengkelGo". (Project yang sama nanti dipakai untuk Login Google, PBI-106.)
2. **APIs & Services → Library** → cari **Gmail API** → **Enable**.
3. **OAuth consent screen** (Google Auth Platform): nama aplikasi "BengkelGo", email dukungan & kontak = email Anda, Audience **External**.
4. Di **Audience**, klik **Publish app** (status *In production*). Penting: kalau tetap *Testing*, token berhenti berlaku setelah 7 hari dan email berhenti terkirim. Aplikasi tidak perlu diverifikasi Google karena hanya dipakai akun Anda sendiri.
5. **Clients → Create client** → tipe **Web application**, nama "BengkelGo mailer". Authorized redirect URI: `https://developers.google.com/oauthplayground`. Simpan **Client ID** (`GMAIL_CLIENT_ID`) dan **Client secret** (`GMAIL_CLIENT_SECRET`).
6. Buka [OAuth Playground](https://developers.google.com/oauthplayground):
   - ikon ⚙️ kanan atas → centang **Use your own OAuth credentials** → isi Client ID & secret tadi;
   - di kotak "Input your own scopes" isi `https://www.googleapis.com/auth/gmail.send` → **Authorize APIs**;
   - login dengan Gmail pengirim. Muncul peringatan "Google hasn't verified this app" → **Advanced → Go to BengkelGo (unsafe)** (aman: aplikasi Anda sendiri) → izinkan;
   - **Exchange authorization code for tokens** → salin **Refresh token** (`GMAIL_REFRESH_TOKEN`).
7. `MAIL_FROM` = `BengkelGo <emailpengirim@gmail.com>` (alamat yang sama dengan akun di langkah 6).

Mencabut akses kapan saja: [myaccount.google.com/permissions](https://myaccount.google.com/permissions) → BengkelGo → hapus akses (lalu ulangi langkah 6).

## Langkah 4. Render (API)

1. [render.com](https://render.com) → daftar dengan GitHub → **New → Blueprint** → pilih repo `bengkelgo`. Render membaca `render.yaml` di folder utama.
2. Isi nilai yang diminta:

   | Variabel | Isi |
   |---|---|
   | `DATABASE_URL` | Session pooler URI dari langkah 2 |
   | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | dari langkah 2 |
   | `CORS_ORIGINS`, `APP_URL` | sementara `https://bengkelgo.vercel.app`; diganti di langkah 6 |

   `JWT_ACCESS_SECRET` dibuat otomatis oleh Render.
3. **Apply**. Build pertama ±5–10 menit. Selesai bila log menampilkan `API listening on :4000/api/v1`.
4. Catat URL layanan, mis. `https://bengkelgo-api.onrender.com`. Cek di browser: `https://bengkelgo-api.onrender.com/health` harus menampilkan `{"status":"ok"}`.
5. **Kalau URL-nya berbeda** (nama sudah dipakai orang), ubah alamat di `frontend/vercel.json` (baris `"destination": "https://bengkelgo-api.onrender.com/api/:path*"`), commit, lalu lanjut.

## Langkah 5. Akun admin pertama

Database Supabase masih kosong. Dari laptop, di folder `backend` (pakai Git Bash), jalankan dengan nilai Anda sendiri:

```bash
DATABASE_URL="<session pooler URI>" DATABASE_SSL=true SEED_ADMIN_EMAIL="admin@contoh.com" SEED_ADMIN_PASSWORD="<minimal 12 karakter>" npm run seed
```

Output `Admin account ready: ...` berarti berhasil. Akun bengkel & pelanggan dibuat lewat halaman daftar di web seperti biasa.

## Langkah 6. Vercel (frontend)

1. [vercel.com](https://vercel.com) → daftar dengan GitHub → **Add New → Project** → pilih repo `bengkelgo`.
2. **Root Directory**: `frontend`. Framework terdeteksi Vite.
3. Environment variables: `VITE_API_URL` = `/api/v1`. (`VITE_GOOGLE_CLIENT_ID` dikosongkan dulu: tombol Google tersembunyi.)
4. **Deploy**. Catat URL-nya, mis. `https://bengkelgo.vercel.app`.
5. Kembali ke Render → service → **Environment**: isi `CORS_ORIGINS` dan `APP_URL` dengan URL Vercel itu → **Save** (Render deploy ulang otomatis).

## Langkah 7. Jaga server tetap bangun

[cron-job.org](https://cron-job.org) → daftar → **Create cronjob**:
- URL: `https://bengkelgo-api.onrender.com/health`
- Jadwal: setiap **10 menit**
- Simpan. Riwayat eksekusi harus menunjukkan status 200.

## Langkah 8. Uji setelah deploy

1. Buka URL Vercel → daftar sebagai pelanggan dengan email asli → login → refresh halaman: harus tetap login.
2. Login admin → **Kesehatan sistem** (`/admin/health`):
   - Database, PostGIS: hijau; Migrasi: 001–005; Penjadwal: aktif.
   - **IP Anda menurut server** harus sama dengan IP internet Anda (cek di [whatismyip.com](https://www.whatismyip.com)). Kalau yang tampil IP lain, lihat baris `x-forwarded-for` di kartu yang sama: hitung berapa alamat (termasuk `remote_address`) yang ada di sebelah kanan IP Anda, lalu isi angka itu di `TRUST_PROXY` di Render. Hasil pengukuran 20 Okt 2026 (Vercel → Cloudflare → Render): `TRUST_PROXY=4`. Ini penting: kalau salah, semua pengguna berbagi satu batas percobaan login.
3. Daftarkan bengkel → setujui di admin → owner unggah QRIS & foto → buka halaman bengkel: gambar tampil (tersimpan di Supabase Storage).
4. Buat booking dengan akun pelanggan → email **"Booking terkonfirmasi"** masuk dalam ±1 menit (cek juga Spam). Kalau tidak masuk: Render → **Logs**, cari `Booking email failed`.
5. Unggah bukti bayar → owner memverifikasi → selesai.

## Setelah ini

- **Login Google (PBI-106):** di project Google Cloud yang sama, buat OAuth client baru untuk login, redirect URI `https://<proyek>.vercel.app/auth/google/callback`; isi `GOOGLE_*` di Render dan `VITE_GOOGLE_CLIENT_ID` di Vercel.
- **Domain sendiri** (opsional): tambahkan di Vercel; perbarui `CORS_ORIGINS` dan `APP_URL`.
- **Kalau pengguna bertambah:** Render berbayar (±$7/bulan) menghapus tidur & blokir SMTP; Redis baru diperlukan kalau API dijalankan lebih dari 1 instance.

## Menjalankan di laptop (tidak berubah)

Docker lokal tetap memakai disk (`STORAGE_DRIVER=local`, default) dan SMTP Gmail + App Password dari `backend/.env`. Gmail API hanya aktif bila `GMAIL_REFRESH_TOKEN` diisi.
