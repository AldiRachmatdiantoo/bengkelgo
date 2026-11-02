# Deploy BengkelGo ke Azure App Service

Disiapkan 2 November 2026 untuk Praktikum 3 Komputasi Awan (branch `tugas-appservice`).

```
Browser ──► Azure App Service (Web App Node 22, https://web-praktikum-aldi.azurewebsites.net)
               │  satu proses Express: halaman React (frontend/dist) + API /api/v1
               ├─► Azure Database for PostgreSQL Flexible Server (PostGIS, SSL)
               └─► /home/data/uploads (disk permanen App Service): foto bengkel, QRIS, bukti bayar
GitHub (push ke tugas-appservice) ──► GitHub Actions ──► deploy otomatis ke Web App
```

**Kenapa begini:**
- App Service menjalankan **satu proses per Web App**, jadi Express ikut menyajikan hasil build React (`WEB_DIST_DIR`). Halaman dan API satu origin, cookie login aman tanpa proxy.
- `package.json` di root dipakai workflow bawaan Deployment Center: `npm install` → `npm run build` (build frontend + backend) → `npm start`. Di GitHub Actions (`CI=true`) devDependencies backend dibuang dan `frontend/node_modules` dihapus supaya paket deploy kecil (kuota disk F1 1 GB).
- Redis tidak dipakai: `REDIS_URL` kosong, pembatas percobaan login memakai memori (cukup untuk 1 instance).
- Upload disimpan di `/home/data/uploads`, bukan di `wwwroot`, karena isi `wwwroot` diganti setiap deploy.

**Batasan paket Free F1:** 60 menit CPU/hari, RAM 1 GB, tanpa Always On (aplikasi tidur setelah ±20 menit tanpa akses, request pertama butuh ±30–60 detik).

## App Settings (Web App → Settings → Environment variables)

| Nama | Nilai |
|---|---|
| `NODE_ENV` | `production` |
| `WEB_DIST_DIR` | `frontend/dist` |
| `RUN_MIGRATIONS_ON_BOOT` | `true` |
| `DATABASE_URL` | `postgres://<admin>:<password>@<server>.postgres.database.azure.com:5432/bengkel` |
| `DATABASE_SSL` | `true` |
| `DATABASE_POOL_MAX` | `5` |
| `JWT_ACCESS_SECRET` | 96 karakter acak: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `COOKIE_SECURE` | `true` |
| `COOKIE_SAMESITE` | `lax` |
| `TRUST_PROXY` | `1` |
| `CORS_ORIGINS` | `https://<nama-web-app>.azurewebsites.net` |
| `APP_URL` | `https://<nama-web-app>.azurewebsites.net` |
| `UPLOAD_DIR` | `/home/data/uploads` |

> Password database cukup huruf dan angka. Karakter seperti `@ : / # %` di dalam `DATABASE_URL` harus di-URL-encode.
> Nilai rahasia hanya diisi di Portal Azure, jangan di-commit.

## Database

1. Server parameters → `azure.extensions` → centang **POSTGIS** dan **PGCRYPTO** → Save (migrasi pertama menjalankan `CREATE EXTENSION`).
2. Databases → **+ Add** → nama `bengkel`.
3. Networking → centang **Allow public access from any Azure service within Azure to this server**.

## Akun admin dan data demo (Web App → Development Tools → SSH)

```sh
cd /home/site/wwwroot
SEED_ADMIN_EMAIL=<email-admin> SEED_ADMIN_PASSWORD='<min 12 karakter>' node backend/dist/db/seed.js
node backend/dist/db/demo.js --confirm=<server>.postgres.database.azure.com --admin=<email-admin> --out=/home/demo-accounts.md
```

`echo $DATABASE_URL` harus berisi alamat database; kalau kosong, `export DATABASE_URL='...'` dulu di sesi SSH itu.
