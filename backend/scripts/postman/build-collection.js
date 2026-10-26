/* eslint-disable */
/**
 * Generates the Postman collection (v2.1) + environment for the Bengkel API.
 *
 *   node scripts/postman/build-collection.js            -> docs/postman/*.json
 *   node scripts/postman/build-collection.js --examples  -> also embeds real responses captured by
 *                                                           `npm run docs:postman:verify` (newman run)
 *
 * Requests are ordered as a runnable end-to-end flow: running the whole collection
 * (Postman Runner / Newman) registers users, approves a workshop, books, dispatches an emergency,
 * pays, verifies and reviews — each step saving tokens/IDs into collection variables.
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', '..', 'docs', 'postman');
const RUN_REPORT = path.join(OUT_DIR, '.newman-report.json');

// ---------------------------------------------------------------- helpers
const bearer = (tokenVar) =>
  tokenVar ? { type: 'bearer', bearer: [{ key: 'token', value: `{{${tokenVar}}}`, type: 'string' }] } : { type: 'noauth' };

/** Test script: assert status and optionally save fields from the response into collection variables. */
function tests(status, saves = {}, extra = '') {
  const expected = Array.isArray(status) ? status : [status];
  const lines = [
    `pm.test('status is ${expected.join(' or ')}', () => pm.expect(pm.response.code).to.be.oneOf(${JSON.stringify(expected)}));`,
    `let json = {}; try { json = pm.response.json(); } catch (e) {}`,
  ];
  for (const [variable, jsonPath] of Object.entries(saves)) {
    lines.push(
      `{ const v = ${jsonPath.split('.').reduce((acc, k) => `${acc}?.[${JSON.stringify(k)}]`, 'json')}; if (v !== undefined && v !== null) pm.collectionVariables.set('${variable}', v); }`,
    );
  }
  if (extra) lines.push(extra);
  return { listen: 'test', script: { type: 'text/javascript', exec: lines } };
}

const prerequest = (exec) => ({ listen: 'prerequest', script: { type: 'text/javascript', exec: [].concat(exec) } });

function url(raw, query = []) {
  const [pathPart] = raw.split('?');
  const host = raw === '/health' ? '{{server_url}}' : '{{base_url}}';
  return {
    raw: `${host}${raw}${query.length ? '?' + query.filter((q) => !q.disabled).map((q) => `${q.key}=${q.value}`).join('&') : ''}`,
    host: [host],
    path: pathPart.split('/').filter(Boolean),
    ...(query.length ? { query } : {}),
  };
}

/**
 * req({ name, method, path, token, body, form, query, desc, status, saves, extraTest, pre })
 */
function req(o) {
  const item = {
    name: o.name,
    event: [tests(o.status ?? 200, o.saves, o.extraTest)],
    request: {
      method: o.method,
      auth: bearer(o.token),
      header: [],
      url: url(o.path, o.query),
      description: o.desc,
    },
    response: [],
  };
  if (o.pre) item.event.unshift(prerequest(o.pre));
  if (o.body !== undefined) {
    item.request.header.push({ key: 'Content-Type', value: 'application/json' });
    item.request.body = { mode: 'raw', raw: JSON.stringify(o.body, null, 2).replace(/"{{(ws_lat|ws_lng)}}"/g, '{{$1}}'), options: { raw: { language: 'json' } } };
  }
  if (o.form) {
    item.request.body = {
      mode: 'formdata',
      formdata: o.form.map((f) => (f.file ? { key: f.key, type: 'file', src: f.file, description: f.desc } : { key: f.key, type: 'text', value: f.value, description: f.desc })),
    };
  }
  return item;
}

const folder = (name, description, item) => ({ name, description, item });

const ERR = `**Error response** (all endpoints):
\`\`\`json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Validation failed", "details": { "location": "body", "issues": [{ "path": "email", "message": "Invalid email address" }] } } }
\`\`\``;

const TOMORROW = [
  "// Booking date = tomorrow in Asia/Jakarta (UTC+7)",
  "const d = new Date(Date.now() + 7 * 3600e3 + 864e5).toISOString().slice(0, 10);",
  "pm.collectionVariables.set('booking_date', d);",
];

// ---------------------------------------------------------------- collection
const items = [
  folder('0. Health', 'Liveness / readiness check (outside the `/api/v1` prefix).', [
    req({
      name: 'Health Check',
      method: 'GET',
      path: '/health',
      desc: 'Returns `{"status":"ok"}` when the API can reach PostgreSQL, otherwise **503** `degraded`. Used by Docker HEALTHCHECK and NGINX.',
      pre: [
        "// Unique suffix so the collection can be re-run without email conflicts",
        "if (!pm.collectionVariables.get('run_id')) pm.collectionVariables.set('run_id', Date.now().toString(36));",
        "// Random workshop/customer location around Jakarta per run, so re-runs don't route emergencies to workshops from earlier runs",
        "if (!pm.collectionVariables.get('ws_lat')) {",
        "  pm.collectionVariables.set('ws_lat', (-6.2 + (Math.random() - 0.5) * 0.8).toFixed(6));",
        "  pm.collectionVariables.set('ws_lng', (106.8 + (Math.random() - 0.5) * 0.8).toFixed(6));",
        "}",
      ],
    }),
  ]),

  folder(
    '1. Auth',
    `JWT access token (15 menit) + refresh token (7 hari) dengan **rotation**.

- Access token dikirim via header \`Authorization: Bearer <token>\`.
- Refresh token dikirim sebagai cookie **httpOnly** \`bengkel_rt\` (path \`/api/v1/auth\`) **dan** di body (\`refresh_token\`) untuk client non-browser.
- Setiap refresh token hanya bisa dipakai **sekali**. Memakai ulang token lama = indikasi pencurian → seluruh sesi (family) dicabut (\`TOKEN_REUSED\`).
- Rate limit: **15 request / 15 menit / IP** untuk register, login, google, guest.`,
    [
      req({
        name: 'Register Customer',
        method: 'POST',
        path: '/auth/register/customer',
        status: 201,
        body: { name: 'Budi Santoso', email: 'budi+{{run_id}}@example.com', phone: '081234567890', password: 'Rahasia123' },
        saves: { customer_token: 'data.access_token', customer_refresh_token: 'data.refresh_token', customer_id: 'data.user.id' },
        extraTest: "pm.collectionVariables.set('customer_email', JSON.parse(pm.request.body.raw).email);",
        desc: `Daftar akun pelanggan via form.

| Field | Aturan |
|---|---|
| name | 2–100 karakter |
| email | email valid, unik |
| phone | nomor WhatsApp Indonesia (\`08…\`, \`62…\`, \`+62…\`) |
| password | 8–72 karakter, wajib huruf kecil, huruf besar, dan angka |

**201** → \`{ user, access_token, token_type, refresh_token, refresh_expires_at }\`; \`user.email_verified\` = \`false\` dan kode 6 angka dikirim ke email (berlaku 15 menit). Booking baru bisa dibuat setelah email diverifikasi. **409** \`EMAIL_TAKEN\`.

${ERR}`,
      }),
      req({
        name: 'Verify Email (code from inbox)',
        method: 'POST',
        path: '/auth/email/verify',
        token: 'customer_token',
        status: 422,
        body: { code: '000000' },
        desc: `Masukkan kode 6 angka dari email pendaftaran. **200** → \`{ user }\` dengan \`email_verified: true\`.

Saat dijalankan otomatis request ini **sengaja gagal** (kode contoh): **422** \`VERIFICATION_CODE_INVALID\`. Error lain: \`VERIFICATION_CODE_EXPIRED\` (lewat 15 menit), \`VERIFICATION_TOO_MANY_ATTEMPTS\` (5× salah, minta kode baru). Dibatasi 20 request/jam per akun (bersama Resend).`,
      }),
      req({
        name: 'Resend Verification Code',
        method: 'POST',
        path: '/auth/email/resend',
        token: 'customer_token',
        status: 429,
        desc: `Mengirim kode baru (kode lama tidak berlaku lagi). **200** → \`{ sent, already_verified }\`.

Paling cepat 1 menit setelah kode terakhir, jadi tepat setelah daftar request ini **sengaja gagal**: **429** \`VERIFICATION_RESEND_TOO_SOON\`.`,
      }),
      req({
        name: 'Forgot Password',
        method: 'POST',
        path: '/auth/password/forgot',
        body: { email: '{{customer_email}}' },
        desc: `Mengirim tautan "Buat password baru" ke email (sekali pakai, berlaku 30 menit; tautan lama hangus). **200** \`{ sent: true }\` **selalu**, juga untuk email yang tidak terdaftar, agar tidak bisa dipakai mengecek email mana yang punya akun. Permintaan berulang dalam 1 menit diabaikan diam-diam. Batas: 15/15 menit per IP dan 5/jam per email (**429**).`,
      }),
      req({
        name: 'Reset Password (token from email)',
        method: 'POST',
        path: '/auth/password/reset',
        status: 422,
        body: { token: 'contoh-token-dari-email-yang-tidak-berlaku', password: 'PasswordBaru123' },
        desc: `Menyimpan password baru dari tautan email. **200** \`{ reset: true }\`: semua sesi lama dicabut, email dianggap terverifikasi, dan pemberitahuan "Password sudah diganti" dikirim. Saat dijalankan otomatis request ini **sengaja gagal** (token contoh): **422** \`RESET_TOKEN_INVALID\` (tidak dikenal, kedaluwarsa, atau sudah dipakai). Password mengikuti aturan pendaftaran (**400** bila lemah).`,
      }),
      req({
        name: 'Login (Customer)',
        method: 'POST',
        path: '/auth/login',
        body: { email: '{{customer_email}}', password: 'Rahasia123' },
        saves: { customer_token: 'data.access_token', customer_refresh_token: 'data.refresh_token' },
        desc: 'Login email/password untuk semua role (customer, owner, admin). Pesan error sama untuk email tidak terdaftar & password salah (anti user-enumeration): **401** `INVALID_CREDENTIALS`.',
      }),
      req({
        name: 'Me',
        method: 'GET',
        path: '/auth/me',
        token: 'customer_token',
        desc: 'Profil user yang sedang login: `{ id, name, email, phone, role, created_at, email_verified, photo_url, has_password, google_linked }`. Ubah profil: folder **12. Akun Saya**.',
      }),
      req({
        name: 'Refresh Token (rotation)',
        method: 'POST',
        path: '/auth/refresh',
        body: { refresh_token: '{{customer_refresh_token}}' },
        saves: { customer_token: 'data.access_token', customer_refresh_token: 'data.refresh_token' },
        desc: `Tukar refresh token dengan pasangan token baru. Token lama otomatis dicabut.

Di browser cukup kirim body kosong \`{}\` — cookie \`bengkel_rt\` dipakai otomatis (gunakan \`credentials: 'include'\`).

Error: **401** \`TOKEN_INVALID\`, \`TOKEN_EXPIRED\`, \`TOKEN_REUSED\` (semua sesi dicabut), \`TOKEN_MISSING\`.`,
      }),
      req({
        name: 'Register Workshop (Owner)',
        method: 'POST',
        path: '/auth/register/workshop',
        status: 201,
        body: {
          owner: { name: 'Pak Joko', email: 'joko+{{run_id}}@example.com', phone: '081298765432', password: 'Bengkel123' },
          workshop: {
            name: 'Bengkel Jaya Motor',
            description: 'Servis motor & mobil, tambal ban, ganti oli',
            address: 'Jl. Medan Merdeka Barat No. 1, Jakarta Pusat',
            phone: '081298765432',
            latitude: '{{ws_lat}}',
            longitude: '{{ws_lng}}',
            vehicle_types: ['MOTOR', 'MOBIL'],
            open_time: '08:00',
            close_time: '17:00',
            max_slot_per_hour: 3,
          },
        },
        saves: { owner_token: 'data.access_token', workshop_id: 'data.workshop.id' },
        extraTest: "pm.collectionVariables.set('owner_email', JSON.parse(pm.request.body.raw).owner.email);",
        desc: `Membuat akun **WORKSHOP_OWNER** + data bengkel dalam **satu transaksi** (gagal sebagian → rollback semua).

Bengkel berstatus **PENDING** dan tidak tampil di publik/emergency sampai disetujui Admin.

| Field workshop | Aturan |
|---|---|
| latitude / longitude | koordinat GPS (map picker) |
| vehicle_types | \`MOTOR\` dan/atau \`MOBIL\` (default keduanya) |
| open_time / close_time | \`HH:mm\`, open < close (default 08:00–17:00) |
| max_slot_per_hour | 1–100, kuota booking default per jam (default 3) |`,
      }),
      req({
        name: 'Login (Owner)',
        method: 'POST',
        path: '/auth/login',
        body: { email: '{{owner_email}}', password: 'Bengkel123' },
        saves: { owner_token: 'data.access_token' },
        desc: 'Login pemilik bengkel. Disimpan ke variabel `owner_token`.',
      }),
      req({
        name: 'Guest Session (Emergency)',
        method: 'POST',
        path: '/auth/guest',
        status: 201,
        body: { name: 'Andi (Tamu)', whatsapp: '081311112222', latitude: '{{ws_lat}}', longitude: '{{ws_lng}}' },
        saves: { guest_token: 'data.access_token' },
        desc: `Registrasi cepat tanpa password untuk kondisi darurat: **nama + WhatsApp + GPS**. Menghasilkan user role **GUEST** yang bisa membuat emergency request, upload bukti bayar, dan memberi review.

Guest **tidak bisa** membuat booking servis terjadwal (khusus CUSTOMER).`,
      }),
      req({
        name: 'Google OAuth 2.0 (PKCE)',
        method: 'POST',
        path: '/auth/google',
        status: [200, 201, 401, 503],
        body: { code: 'PASTE_AUTHORIZATION_CODE_FROM_GOOGLE_REDIRECT', code_verifier: 'PASTE_PKCE_CODE_VERIFIER_43_TO_128_CHARS_aaaaaaaaaaaaaaa' },
        desc: `**Authorization Code Flow + PKCE**.

1. Frontend membuat \`code_verifier\` acak (43–128 char) dan \`code_challenge = BASE64URL(SHA256(code_verifier))\`.
2. Redirect user ke Google dengan \`response_type=code\`, \`code_challenge\`, \`code_challenge_method=S256\`, \`redirect_uri = GOOGLE_REDIRECT_URI\`.
3. Google redirect balik dengan \`?code=...\` → kirim \`code\` + \`code_verifier\` ke endpoint ini.

Email yang belum terdaftar otomatis dibuat sebagai **CUSTOMER** (**201**, \`is_new_user: true\`); yang sudah ada → **200** dan akun di-link ke Google.

Error: **401** \`GOOGLE_AUTH_FAILED\` / \`GOOGLE_EMAIL_UNVERIFIED\`, **503** \`GOOGLE_DISABLED\` jika \`GOOGLE_CLIENT_ID/SECRET\` belum diisi.

> Request contoh ini memakai code palsu sehingga akan gagal (401/503) — itu normal.`,
      }),
    ],
  ),

  folder('2. Admin', 'Khusus role **ADMIN** (akun dibuat via `npm run seed`, kredensial dari `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`).', [
    req({
      name: 'Login (Admin)',
      method: 'POST',
      path: '/auth/login',
      body: { email: '{{admin_email}}', password: '{{admin_password}}' },
      saves: { admin_token: 'data.access_token' },
      desc: 'Login admin; isi variabel environment `admin_email` dan `admin_password` sesuai `.env`.',
    }),
    req({
      name: 'List Workshops (filter status)',
      method: 'GET',
      path: '/admin/workshops',
      token: 'admin_token',
      query: [
        { key: 'status', value: 'PENDING', description: 'PENDING | APPROVED | REJECTED | SUSPENDED (opsional)' },
        { key: 'page', value: '1' },
        { key: 'limit', value: '20', description: 'maks 100' },
      ],
      desc: 'Daftar semua bengkel beserta data pemilik (`owner_name`, `owner_email`, `owner_phone`) untuk proses verifikasi.',
    }),
    req({
      name: 'Approve / Reject / Suspend Workshop',
      method: 'PATCH',
      path: '/admin/workshops/{{workshop_id}}/approval',
      token: 'admin_token',
      body: { action: 'APPROVE' },
      desc: `| action | Dari status | Ke status | reason |
|---|---|---|---|
| \`APPROVE\` | PENDING, REJECTED, SUSPENDED | APPROVED | opsional |
| \`REJECT\` | PENDING | REJECTED | **wajib** |
| \`SUSPEND\` | APPROVED | SUSPENDED | **wajib** |

Contoh reject: \`{ "action": "REJECT", "reason": "Foto & alamat tidak sesuai" }\`. Transisi tidak valid → **409** \`INVALID_TRANSITION\`.`,
    }),
  ]),

  folder(
    '3. Workshop Owner Portal',
    'Semua endpoint di folder ini wajib token role **WORKSHOP_OWNER** dan otomatis hanya mengakses bengkel milik owner tersebut.',
    [
      req({ name: 'My Workshop', method: 'GET', path: '/workshops/me', token: 'owner_token', desc: 'Detail bengkel milik owner termasuk `status`, `status_reason`, dan `has_qris`.' }),
      req({
        name: 'Update Profile / Location / Hours / Capacity',
        method: 'PUT',
        path: '/workshops/profile',
        token: 'owner_token',
        body: { description: 'Spesialis motor matic & injeksi', latitude: '{{ws_lat}}', longitude: '{{ws_lng}}', open_time: '08:00', close_time: '20:00', max_slot_per_hour: 3, is_open: true, accepts_emergency: true },
        desc: `Update sebagian (partial). Semua field opsional, tetapi:
- \`latitude\` + \`longitude\` harus dikirim berpasangan (hasil map picker),
- \`open_time\` + \`close_time\` harus berpasangan dan open < close.

\`is_open=false\` → bengkel tidak menerima booking baru & tidak muncul di emergency scan. \`accepts_emergency=false\` → hanya menonaktifkan emergency.

Catatan: mengubah \`max_slot_per_hour\` berlaku untuk slot yang **belum pernah dibooking**; override slot tertentu pakai **Set Slot Capacity**.`,
      }),
      req({
        name: 'Upload Static QRIS Image',
        method: 'PUT',
        path: '/workshops/qris',
        token: 'owner_token',
        form: [{ key: 'qris', file: 'sample-image.png', desc: 'JPEG/PNG/WEBP, maks 2MB' }],
        desc: 'Upload gambar QRIS statis bengkel (multipart field `qris`). Tipe file diverifikasi dari **isi file (magic bytes)**, bukan ekstensi. Gambar ini yang ditampilkan ke pelanggan saat membayar.',
      }),
      req({
        name: 'Create Service',
        method: 'POST',
        path: '/workshops/services',
        token: 'owner_token',
        status: 201,
        body: { name: 'Servis Rutin + Ganti Oli', description: 'Termasuk cek rem & busi', price: 75000, duration_minutes: 60, vehicle_type: 'MOTOR' },
        saves: { service_id: 'data.id' },
        desc: 'Tambah layanan servis. `vehicle_type` harus termasuk dalam `vehicle_types` bengkel (**422** `VEHICLE_TYPE_NOT_SUPPORTED`). `price` dalam Rupiah.',
      }),
      req({ name: 'List Services', method: 'GET', path: '/workshops/services', token: 'owner_token', desc: 'Semua layanan (aktif & nonaktif).' }),
      req({
        name: 'Update Service',
        method: 'PATCH',
        path: '/workshops/services/{{service_id}}',
        token: 'owner_token',
        body: { price: 80000, is_active: true },
        desc: 'Partial update: field yang tidak dikirim **tidak berubah** (termasuk `duration_minutes`). Set `is_active: false` untuk menyembunyikan layanan dari pelanggan.',
      }),
      req({
        name: 'Create Service (to delete)',
        method: 'POST',
        path: '/workshops/services',
        token: 'owner_token',
        status: 201,
        body: { name: 'Layanan Percobaan', price: 10000, vehicle_type: 'MOTOR' },
        saves: { temp_service_id: 'data.id' },
        desc: 'Layanan sementara untuk contoh hapus (layanan utama `service_id` tetap dipakai untuk booking).',
      }),
      req({
        name: 'Delete Service (soft)',
        method: 'DELETE',
        path: '/workshops/services/{{temp_service_id}}',
        token: 'owner_token',
        desc: 'Soft delete: layanan hilang dari daftar owner & publik dan tidak bisa dibooking lagi; booking lama tetap menyimpan referensinya. **404** bila bukan milik Anda atau sudah dihapus.',
      }),
      req({
        name: 'Add Mechanic',
        method: 'POST',
        path: '/workshops/mechanics',
        token: 'owner_token',
        status: 201,
        body: { name: 'Rudi Hartono', phone: '081355556666', specializations: ['matic', 'injeksi', 'kelistrikan'] },
        saves: { mechanic_id: 'data.id' },
        desc: 'Tambah mekanik. `specializations` = tag bebas (maks 10, otomatis lowercase & unik). `avg_rating` dihitung otomatis dari review.',
      }),
      req({
        name: 'Add Mechanic (second)',
        method: 'POST',
        path: '/workshops/mechanics',
        token: 'owner_token',
        status: 201,
        body: { name: 'Sari Wulandari', specializations: ['tambal ban'] },
        saves: { mechanic_id_2: 'data.id' },
        desc: 'Mekanik kedua (dipakai untuk contoh nonaktifkan mekanik).',
      }),
      req({ name: 'List Mechanics', method: 'GET', path: '/workshops/mechanics', token: 'owner_token', desc: 'Semua mekanik diurutkan rating tertinggi.' }),
      req({
        name: 'Update Mechanic',
        method: 'PATCH',
        path: '/workshops/mechanics/{{mechanic_id}}',
        token: 'owner_token',
        body: { specializations: ['matic', 'injeksi', 'kelistrikan', 'cvt'] },
        desc: 'Partial update (`name`, `phone`, `specializations`, `is_active`).',
      }),
      req({
        name: 'Deactivate Mechanic',
        method: 'DELETE',
        path: '/workshops/mechanics/{{mechanic_id_2}}',
        token: 'owner_token',
        desc: '**Soft delete** — set `is_active=false`. Riwayat order & review tetap tersimpan; mekanik tidak lagi ditugaskan otomatis.',
      }),
      req({
        name: 'Get Hourly Quotas (by date)',
        method: 'GET',
        path: '/workshops/quotas',
        token: 'owner_token',
        query: [{ key: 'date', value: '{{booking_date}}', description: 'YYYY-MM-DD' }],
        pre: TOMORROW,
        desc: 'Kapasitas per jam untuk tanggal tertentu: `time_slot`, `max_slot_per_hour`, `current_booked`, `remaining`, `waitlisted` (jumlah `IN_QUEUE`), `bookable`.',
      }),
      req({
        name: 'Set Slot Capacity (override)',
        method: 'PUT',
        path: '/workshops/quotas',
        token: 'owner_token',
        body: { date: '{{booking_date}}', time_slot: '10:00', max_slot_per_hour: 4 },
        pre: TOMORROW,
        desc: `Override kapasitas **satu slot** (misal mekanik tambahan hari itu). Dieksekusi dengan row lock (\`FOR UPDATE\`).

- Tidak boleh lebih kecil dari \`current_booked\` → **422** \`CAPACITY_BELOW_BOOKED\`.
- Jika kapasitas naik, booking \`IN_QUEUE\` otomatis dipromosikan menjadi \`CONFIRMED\` (FIFO) → \`promoted_from_queue\`.`,
      }),
    ],
  ),

  folder('4. Workshops (Public)', 'Tanpa autentikasi. Hanya menampilkan bengkel berstatus **APPROVED**.', [
    req({
      name: 'List Workshops',
      method: 'GET',
      path: '/workshops',
      query: [
        { key: 'search', value: 'jaya', description: 'cari nama (opsional)' },
        { key: 'vehicle_type', value: 'MOTOR', description: 'MOTOR | MOBIL (opsional)' },
        { key: 'page', value: '1' },
        { key: 'limit', value: '20' },
        { key: 'sort', value: 'rating', description: 'distance | rating | recommended (opsional)', disabled: true },
      ],
      desc: `Daftar bengkel. Urutan bawaan: terdekat bila \`latitude\`+\`longitude\` dikirim, selain itu rating tertinggi.

Parameter \`sort\` (opsional):
- \`distance\` — terdekat (wajib lokasi)
- \`rating\` — rating tertinggi, lalu jumlah ulasan
- \`recommended\` — skor 0,6 × kedekatan + 0,4 × rating (sama dengan routing SOS; wajib lokasi)

\`sort=distance\`/\`recommended\` tanpa lokasi → **400**.`,
    }),
    req({
      name: 'Nearby Workshops (radius)',
      method: 'GET',
      path: '/workshops',
      query: [
        { key: 'latitude', value: '{{ws_lat}}' },
        { key: 'longitude', value: '{{ws_lng}}' },
        { key: 'radius_km', value: '10', description: '0.5–50, default 20' },
      ],
      desc: 'Jika `latitude`+`longitude` dikirim → difilter dalam radius dan diurutkan jarak terdekat (`distance_meters`). Untuk mencari bengkel booking servis. (Emergency pakai `/emergency/scan`.)',
    }),
    req({
      name: 'Workshop Detail',
      method: 'GET',
      path: '/workshops/{{workshop_id}}',
      desc: 'Detail bengkel + `services` aktif + `mechanics` aktif (tanpa nomor HP mekanik).',
    }),
    req({
      name: 'Slot Availability',
      method: 'GET',
      path: '/workshops/{{workshop_id}}/availability',
      query: [{ key: 'date', value: '{{booking_date}}' }],
      pre: TOMORROW,
      desc: 'Ketersediaan slot per jam untuk tanggal tertentu. `remaining = 0` artinya booking baru akan masuk **waiting list** (`IN_QUEUE`). `bookable=false` untuk slot yang sudah lewat.',
    }),
    req({
      name: 'Workshop Reviews',
      method: 'GET',
      path: '/workshops/{{workshop_id}}/reviews',
      query: [{ key: 'page', value: '1' }, { key: 'limit', value: '20' }],
      desc: 'Review terbaru: `rating`, `comment`, `customer_name`, `mechanic_name`.',
    }),
    req({
      name: 'Search Place (geocoding)',
      method: 'GET',
      path: '/geocode/search',
      query: [
        { key: 'q', value: 'Stasiun Bogor', description: 'daerah, jalan, atau patokan; min. 3 karakter, maks. 100' },
        { key: 'limit', value: '6', description: '1–8, default 6' },
        { key: 'lat', value: '{{ws_lat}}', description: 'opsional, bersama lng: utamakan hasil di dekat titik ini', disabled: true },
        { key: 'lng', value: '{{ws_lng}}', disabled: true },
      ],
      desc: `Cari lokasi di Indonesia dari data OpenStreetMap (Nominatim, cadangan Photon). Respons: daftar \`{ name, detail, lat, lng, source }\`; daftar kosong bila tidak ditemukan.

- Panggil saat pengguna menekan Enter / tombol Cari, **bukan per ketikan** (kebijakan Nominatim).
- Hasil di-cache 15 menit. Pembatas \`geocode\`: 40 request/menit per IP (**429** \`RATE_LIMITED\`).
- Kedua layanan peta mati → **503** \`GEOCODE_UNAVAILABLE\`.`,
    }),
    req({
      name: 'Address of a Point (reverse geocoding)',
      method: 'GET',
      path: '/geocode/reverse',
      query: [
        { key: 'lat', value: '{{ws_lat}}' },
        { key: 'lng', value: '{{ws_lng}}' },
      ],
      desc: `Perkiraan alamat sebuah titik peta (titik SOS, lokasi bengkel): \`{ name, detail, lat, lng, source }\`, atau \`null\` bila titik tidak punya alamat di Indonesia (laut, luar negeri).

Titik yang berjarak ±10 m memakai cache yang sama (15 menit). Pembatas dan error sama dengan Search Place.`,
    }),
  ]),

  folder(
    '5. Emergency',
    `Alur darurat (SOS breakdown):

1. **Scan** bengkel dalam radius **5 km** (PostGIS \`ST_DWithin\`).
2. **Request** → order dibuat atomik (orders + emergency_details + transactions) dan diarahkan ke bengkel dengan skor terbaik: \`0.6 × kedekatan + 0.4 × rating mekanik\`.
3. Bengkel punya **2 menit** untuk **ACCEPT / DECLINE**. Decline atau tidak merespons → otomatis dialihkan ke bengkel berikutnya (maks 5 percobaan). Tidak ada lagi → status \`UNASSIGNED\`.
4. Pelanggan memantau status lewat **Orders → Order Detail** (polling).

Rate limit: **10 request / menit / IP** untuk \`/scan\` dan \`/request\`.`,
    [
      req({
        name: 'Scan Nearby Workshops (5 km)',
        method: 'POST',
        path: '/emergency/scan',
        body: { latitude: '{{ws_lat}}', longitude: '{{ws_lng}}', vehicle_type: 'MOTOR' },
        desc: `Publik (token opsional). Mengembalikan bengkel APPROVED, buka, menerima emergency, dan melayani \`vehicle_type\`, diurutkan berdasarkan \`score\`.

Field per bengkel: \`distance_meters\`, \`top_mechanic_rating\`, \`available_mechanics\` (mekanik yang tidak sedang menangani emergency), \`score\`.`,
      }),
      req({
        name: 'Create Emergency Request (Guest/Customer)',
        method: 'POST',
        path: '/emergency/request',
        token: 'guest_token',
        status: 201,
        body: { latitude: '{{ws_lat}}', longitude: '{{ws_lng}}', vehicle_type: 'MOTOR', vehicle_plate: 'B 1234 XYZ', problem_description: 'Ban belakang bocor, motor tidak bisa jalan', address_note: 'Depan minimarket, dekat halte', price_min: 50000, price_max: 150000 },
        saves: { emergency_order_id: 'data.id' },
        desc: `Role **CUSTOMER** atau **GUEST**. Membuat order \`PENDING\` dan mengembalikan \`assigned_workshop\` + \`response_timeout_seconds\` (120).

\`price_min\` / \`price_max\` (opsional): kisaran biaya dari pelanggan; kosong = "bisa dibicarakan". \`price_min\` > \`price_max\` → **400**. Tampil di \`emergency.price_min/price_max\` pada detail order.

Error:
- **422** \`NO_WORKSHOP_NEARBY\` — tidak ada bengkel tersedia dalam 5 km.
- **409** \`ACTIVE_EMERGENCY_EXISTS\` — masih punya emergency aktif.
- **429** — rate limit.`,
      }),
      req({
        name: 'Respond Emergency — ACCEPT (Owner)',
        method: 'PATCH',
        path: '/emergency/{{emergency_order_id}}/respond',
        token: 'owner_token',
        body: { action: 'ACCEPT', estimated_price: 50000 },
        desc: `Hanya owner bengkel yang **sedang ditugaskan**. ACCEPT → status \`ACCEPTED\`, \`estimated_price\` menjadi nominal tagihan sementara.

Mekanik: kirim \`mechanic_id\` (opsional) untuk memilih sendiri; tanpa itu, mekanik bebas dengan rating tertinggi dipilih otomatis. Mekanik dianggap sibuk bila sedang SOS atau sedang mengerjakan booking.

Error: **404** (bukan order/mekanik bengkel Anda), **409** \`INVALID_ORDER_STATE\`, \`RESPONSE_WINDOW_EXPIRED\`, \`NO_MECHANIC_AVAILABLE\`, \`MECHANIC_BUSY\`.`,
      }),
      req({
        name: 'Update Emergency Price (Owner)',
        method: 'PATCH',
        path: '/emergency/{{emergency_order_id}}/price',
        token: 'owner_token',
        body: { estimated_price: 60000 },
        desc: `Mengubah estimasi biaya SOS yang sudah \`ACCEPTED\`/\`IN_PROGRESS\`. Nominal pembayaran ikut berubah.

Terkunci setelah pelanggan mengirim bukti bayar atau sudah lunas → **409** \`PRICE_LOCKED\`. Status lain → **409** \`INVALID_ORDER_STATE\`.`,
      }),
      req({
        name: 'Respond Emergency — DECLINE (Owner)',
        method: 'PATCH',
        path: '/emergency/{{emergency_order_id}}/respond',
        token: 'owner_token',
        status: [200, 404, 409],
        body: { action: 'DECLINE' },
        desc: `DECLINE → order langsung dialihkan ke bengkel berikutnya (\`rerouted_to\`), atau \`UNASSIGNED\` jika tidak ada.

> Di alur Runner, order ini sudah di-ACCEPT sehingga request ini mengembalikan **409** \`INVALID_ORDER_STATE\` — itu yang diharapkan.`,
      }),
    ],
  ),

  folder(
    '6. Booking',
    `Booking servis terjadwal per jam (role **CUSTOMER**).

Kuota slot dikunci dengan **\`SELECT … FOR UPDATE\`** sehingga request bersamaan tidak bisa overbooking. Slot penuh → booking tetap dibuat dengan status **\`IN_QUEUE\`** (waiting list) dan otomatis naik ke \`CONFIRMED\` saat ada pembatalan / kapasitas ditambah. Setiap booking mendapat **nomor antrean** harian.`,
    [
      req({
        name: 'Admin: Mark Customer Email Verified',
        method: 'PATCH',
        path: '/admin/users/{{customer_id}}/verify-email',
        token: 'admin_token',
        desc: 'Tindakan dukungan (role **ADMIN**): menandai email pengguna terverifikasi bila email kode tidak sampai. Tercatat di audit log \`USER_EMAIL_VERIFIED\`. Di alur Runner ini menggantikan langkah memasukkan kode dari kotak masuk, agar booking berikutnya bisa dibuat.',
      }),
      req({
        name: 'Create Booking',
        method: 'POST',
        path: '/booking',
        token: 'customer_token',
        status: 201,
        pre: TOMORROW,
        body: { workshop_id: '{{workshop_id}}', service_id: '{{service_id}}', booking_date: '{{booking_date}}', time_slot: '10:00', vehicle_plate: 'B 5678 ABC', notes: 'Rem depan bunyi' },
        saves: { booking_order_id: 'data.id' },
        desc: `| Field | Aturan |
|---|---|
| booking_date | \`YYYY-MM-DD\`, hari ini s/d +30 hari |
| time_slot | \`HH:00\`, dalam jam operasional, belum lewat |
| vehicle_plate | opsional, format plat Indonesia |

**201** → \`status\` = \`CONFIRMED\` (mekanik otomatis ditugaskan) atau \`IN_QUEUE\`, plus \`booking.queue_number\` dan \`booking.waitlist_position\`.

Error: **403** \`EMAIL_NOT_VERIFIED\` (email pelanggan belum diverifikasi), **404** bengkel/layanan tidak ditemukan, **422** \`OUTSIDE_OPERATING_HOURS\` / \`SLOT_ALREADY_STARTED\` / \`DATE_TOO_FAR\` / \`WORKSHOP_CLOSED\`, **409** \`DUPLICATE_BOOKING\` (slot yang sama), \`DAILY_WORKSHOP_LIMIT\` (sudah punya booking di bengkel ini pada tanggal itu), \`ACTIVE_BOOKING_LIMIT\` (maks. 3 booking belum selesai), **429** \`BOOKING_RATE_LIMITED\` (maks. 5 percobaan booking per jam per akun).`,
      }),
      req({
        name: 'Cancel Booking (Customer)',
        method: 'PATCH',
        path: '/orders/{{booking_order_id}}/cancel',
        token: 'customer_token',
        body: { reason: 'Ada urusan mendadak' },
        desc: 'Body opsional `{ "reason": "..." }` (maks 300 karakter) → tersimpan sebagai `cancel_reason`, dengan `cancelled_by` = `CUSTOMER` (owner: `cancel_reason` di Update Order Status → `WORKSHOP`). Membatalkan booking `CONFIRMED`/`IN_QUEUE` (juga emergency `PENDING`/`ACCEPTED`). Kuota slot dikembalikan dan antrean pertama otomatis dipromosikan. Order yang pembayarannya sudah `VERIFIED` hanya bisa dibatalkan bengkel (**409** `ORDER_ALREADY_PAID`), dan selama bukti bayar masih diperiksa pelanggan tidak bisa membatalkan (**409** `PAYMENT_PENDING_VERIFICATION`).',
      }),
    ],
  ),

  folder(
    '7. Orders',
    `Order = emergency atau booking. Detail hanya bisa dilihat oleh pelanggan pemilik order, owner bengkel yang ditugaskan, atau admin (lainnya → **404**, anti-BOLA).

**Status lifecycle**
- Emergency: \`PENDING → ACCEPTED → IN_PROGRESS → COMPLETED\` (atau \`UNASSIGNED\` / \`CANCELLED\`)
- Booking: \`CONFIRMED | IN_QUEUE → IN_PROGRESS → COMPLETED\` (atau \`CANCELLED\`)`,
    [
      req({
        name: 'My Orders (Customer/Guest)',
        method: 'GET',
        path: '/orders/me',
        token: 'guest_token',
        query: [
          { key: 'status', value: 'ACCEPTED', disabled: true, description: 'filter status (opsional)' },
          { key: 'type', value: 'EMERGENCY', disabled: true, description: 'EMERGENCY | BOOKING (opsional)' },
          { key: 'page', value: '1' },
          { key: 'limit', value: '20' },
        ],
        desc: 'Riwayat order milik user, terbaru dulu, lengkap dengan `workshop`, `mechanic`, `emergency`/`booking`, `payment`, `reviewed`.',
      }),
      req({
        name: 'Workshop Orders (Owner)',
        method: 'GET',
        path: '/orders/workshop',
        token: 'owner_token',
        query: [
          { key: 'type', value: 'BOOKING', disabled: true },
          { key: 'status', value: 'PENDING', disabled: true },
          { key: 'date', value: '{{booking_date}}', disabled: true, description: 'tanggal booking / tanggal dibuat (emergency)' },
          { key: 'page', value: '1' },
          { key: 'limit', value: '20' },
        ],
        desc: 'Daftar order masuk ke bengkel owner (dashboard antrean). Gunakan `status=PENDING&type=EMERGENCY` untuk polling panggilan darurat yang harus direspons.',
      }),
      req({
        name: 'Order Detail',
        method: 'GET',
        path: '/orders/{{emergency_order_id}}',
        token: 'guest_token',
        desc: 'Detail lengkap satu order. Dipakai pelanggan untuk memantau status emergency (polling tiap beberapa detik).',
      }),
      req({
        name: 'Update Order Status — IN_PROGRESS (Owner)',
        method: 'PATCH',
        path: '/orders/{{emergency_order_id}}/status',
        token: 'owner_token',
        body: { status: 'IN_PROGRESS' },
        desc: `Transisi yang diizinkan untuk owner:

| Tipe | Dari | Ke |
|---|---|---|
| BOOKING | CONFIRMED | IN_PROGRESS, CANCELLED |
| BOOKING | IN_QUEUE | CANCELLED |
| EMERGENCY | ACCEPTED | IN_PROGRESS, CANCELLED |
| semua | IN_PROGRESS | COMPLETED |

Transisi lain → **409** \`INVALID_TRANSITION\`.

**Membatalkan pesanan yang sudah dibayar:**
- Bukti bayar masih \`PENDING_VERIFICATION\` → **409** \`PAYMENT_PENDING_VERIFICATION\` (verifikasi/tolak bukti dulu).
- Pembayaran \`VERIFIED\` → wajib kirim \`refund_confirmed: true\` (bengkel sudah mengembalikan dana ke pelanggan), opsional \`refund_note\` (maks 300 karakter). Tanpa itu → **409** \`REFUND_CONFIRMATION_REQUIRED\`. Pembayaran menjadi \`REFUNDED\` (\`refunded_at\`, \`refund_note\`).`,
      }),
      req({
        name: 'Update Order Status — COMPLETED (Owner)',
        method: 'PATCH',
        path: '/orders/{{emergency_order_id}}/status',
        token: 'owner_token',
        body: { status: 'COMPLETED', final_amount: 65000 },
        desc: '`final_amount` (opsional) menetapkan total tagihan akhir dan menyinkronkan nominal pembayaran. Wajib untuk emergency yang belum punya nominal (**400** `FINAL_AMOUNT_REQUIRED`).',
      }),
    ],
  ),

  folder(
    '8. Payments (QRIS)',
    `Pembayaran via **QRIS statis** bengkel + upload bukti transfer, lalu diverifikasi manual oleh bengkel.

Status: \`UNPAID → PENDING_VERIFICATION → VERIFIED\` (atau \`REJECTED\` → pelanggan bisa upload ulang). Pesanan lunas yang dibatalkan bengkel → \`REFUNDED\`.

File bukti: **JPEG/PNG/WEBP, < 2MB**, divalidasi dari magic bytes. File hanya bisa diakses pihak terkait order (tidak publik).`,
    [
      req({ name: 'Get Payment Info', method: 'GET', path: '/payments/{{emergency_order_id}}', token: 'guest_token', desc: '`{ order_id, order_number, amount, status, has_proof, has_qris, uploaded_at, verified_at, rejection_reason }`.' }),
      req({
        name: 'Get Workshop QRIS Image',
        method: 'GET',
        path: '/payments/{{emergency_order_id}}/qris',
        token: 'guest_token',
        desc: 'Mengembalikan **file gambar** QRIS bengkel yang menangani order (bukan JSON). Di frontend ambil dengan `fetch` + header Authorization lalu tampilkan sebagai blob URL. **404** `QRIS_NOT_AVAILABLE` jika bengkel belum upload.',
      }),
      req({
        name: 'Upload Payment Proof',
        method: 'POST',
        path: '/payments/upload',
        token: 'guest_token',
        form: [
          { key: 'order_id', value: '{{emergency_order_id}}', desc: 'UUID order' },
          { key: 'proof', file: 'sample-image.png', desc: 'JPEG/PNG/WEBP, maks 2MB' },
          { key: 'payer_reference', value: '123456789012', desc: 'opsional: nomor referensi/RRN dari struk transfer' },
          { key: 'payer_name', value: 'Andi', desc: 'opsional: nama pengirim di aplikasi bank/e-wallet' },
        ],
        desc: `**multipart/form-data**: \`order_id\` + \`proof\` (file), opsional \`payer_reference\` dan \`payer_name\` untuk membantu bengkel mencocokkan mutasi. Role CUSTOMER/GUEST pemilik order.

Syarat: order berstatus CONFIRMED/ACCEPTED/IN_PROGRESS/COMPLETED dan nominal > 0.

Error: **400** \`FILE_REQUIRED\`, \`INVALID_FILE_TYPE\`, \`FILE_TOO_LARGE\`; **409** \`ORDER_NOT_PAYABLE\`, \`AMOUNT_NOT_SET\`, \`ALREADY_VERIFIED\`.`,
      }),
      req({
        name: 'Get Payment Proof Image',
        method: 'GET',
        path: '/payments/{{emergency_order_id}}/proof',
        token: 'owner_token',
        desc: 'File gambar bukti bayar (untuk owner saat verifikasi, pelanggan, atau admin).',
      }),
      req({
        name: 'Verify Payment (Owner)',
        method: 'PATCH',
        path: '/payments/{{emergency_order_id}}/verify',
        token: 'owner_token',
        body: { approve: true },
        desc: 'Setujui: `{ "approve": true }` → nomor invoice `INV-YYYYMMDD-000001` diterbitkan sekali (`invoice_number`). Tolak: `{ "approve": false, "reason": "Nominal tidak sesuai" }` (reason wajib). Hanya bisa saat status `PENDING_VERIFICATION` (**409** `INVALID_PAYMENT_STATE`).',
      }),
    ],
  ),

  folder('9. Reviews', 'Rating 1–5 untuk order **COMPLETED**, satu review per order. Rating rata-rata mekanik & bengkel diperbarui otomatis dalam transaksi yang sama.', [
    req({
      name: 'Create Review',
      method: 'POST',
      path: '/reviews',
      token: 'guest_token',
      status: 201,
      body: { order_id: '{{emergency_order_id}}', rating: 5, comment: 'Mekanik datang cepat, ramah, harga jujur!' },
      saves: { review_id: 'data.id' },
      desc: 'Role CUSTOMER/GUEST pemilik order. **409** `ORDER_NOT_COMPLETED` / `ALREADY_REVIEWED`.',
    }),
    req({
      name: 'Reply to Review (Owner)',
      method: 'PUT',
      path: '/workshops/reviews/{{review_id}}/reply',
      token: 'owner_token',
      body: { reply: 'Terima kasih, Kak! Semoga perjalanannya lancar.' },
      desc: 'Balasan publik owner (2–1000 karakter), menggantikan balasan sebelumnya. Tampil sebagai `owner_reply` + `replied_at` di daftar ulasan. Hapus balasan: `DELETE` ke path yang sama. **404** bila ulasan bukan untuk bengkel Anda.',
    }),
    req({
      name: 'My Workshop Reviews (Owner)',
      method: 'GET',
      path: '/workshops/me/reviews',
      token: 'owner_token',
      desc: 'Ulasan untuk bengkel milik owner, terbaru dulu, termasuk balasan.',
    }),
  ]),

  folder('10. Admin Reports', 'Laporan platform (role **ADMIN**).', [
    req({
      name: 'Transaction Summary Report',
      method: 'GET',
      path: '/admin/reports/transactions',
      token: 'admin_token',
      query: [
        { key: 'from', value: '2026-01-01', disabled: true, description: 'YYYY-MM-DD, default 30 hari lalu' },
        { key: 'to', value: '2026-12-31', disabled: true, description: 'YYYY-MM-DD, default hari ini' },
        { key: 'workshop_id', value: '{{workshop_id}}', disabled: true, description: 'filter satu bengkel (opsional)' },
      ],
      desc: `Ringkasan transaksi dalam rentang tanggal (zona waktu Asia/Jakarta):
- \`summary\`: total order, selesai, batal, \`verified_revenue\`, \`pending_verification_amount\`, jumlah pembayaran verified/rejected
- \`by_type\`: EMERGENCY vs BOOKING
- \`by_status\`
- \`top_workshops\`: 10 bengkel pendapatan tertinggi
- \`daily\`: seri harian (untuk grafik)`,
    }),
  ]),

  folder(
    '11. Notifikasi, Kendaraan, Jadwal & Alat Admin',
    'Fitur backlog Paket B (20 Okt 2026). Semua opsional untuk klien lama.',
    [
      req({
        name: 'My Notifications',
        method: 'GET',
        path: '/notifications',
        token: 'owner_token',
        query: [
          { key: 'unread_only', value: 'true', disabled: true, description: 'true = hanya yang belum dibaca' },
          { key: 'page', value: '1' },
          { key: 'limit', value: '20' },
        ],
        desc: `Semua role. \`{ items: [{ id, type, title, body, link, read_at, created_at }], unread }\`, terbaru dulu.

Dibuat otomatis oleh server di setiap kejadian penting, misalnya: \`SOS_INCOMING\`, \`SOS_ACCEPTED\`, \`SOS_REROUTED\`, \`SOS_UNASSIGNED\`, \`BOOKING_NEW\`, \`BOOKING_PROMOTED\`, \`BOOKING_RESCHEDULED\`, \`PRICE_UPDATED\`, \`ORDER_IN_PROGRESS\`, \`ORDER_COMPLETED\`, \`ORDER_CANCELLED\`, \`PAYMENT_PROOF\`, \`PAYMENT_VERIFIED\`, \`PAYMENT_REJECTED\`, \`PAYMENT_REFUNDED\`, \`REVIEW_NEW\`, \`REVIEW_REPLY\`, \`WORKSHOP_REGISTERED\` (admin), \`WORKSHOP_APPROVED/REJECTED/SUSPENDED\`.`,
      }),
      req({
        name: 'Mark Notifications Read',
        method: 'PATCH',
        path: '/notifications/read',
        token: 'owner_token',
        body: {},
        desc: '`{ "ids": ["..."] }` menandai notifikasi tertentu; body kosong `{}` menandai semua. Hanya notifikasi milik pemanggil yang tersentuh.',
      }),
      req({
        name: 'Order Status History',
        method: 'GET',
        path: '/orders/{{emergency_order_id}}/history',
        token: 'guest_token',
        desc: 'Timeline status pesanan (`kind: ORDER`) dan pembayaran (`kind: PAYMENT`) beserta siapa pelakunya (`actor_role`, `actor_name`), dicatat otomatis oleh trigger database. Akses sama dengan detail order.',
      }),
      req({
        name: 'Add Saved Vehicle',
        method: 'POST',
        path: '/vehicles',
        token: 'customer_token',
        status: 201,
        body: { vehicle_type: 'MOTOR', brand: 'Honda', model: 'Vario 125', year: 2021, color: 'Hitam', plate: 'B 5678 ABC' },
        saves: { vehicle_id: 'data.id' },
        desc: 'Role CUSTOMER/GUEST. Maks 10 kendaraan. `vehicle_id` lalu bisa dikirim ke `POST /booking` dan `POST /emergency/request` (jenis kendaraan harus cocok → **422** `VEHICLE_TYPE_MISMATCH`; plat otomatis terisi).',
      }),
      req({ name: 'List Saved Vehicles', method: 'GET', path: '/vehicles', token: 'customer_token', desc: 'Kendaraan milik pemanggil (yang dihapus tidak tampil).' }),
      req({
        name: 'Create Booking (saved vehicle)',
        method: 'POST',
        path: '/booking',
        token: 'customer_token',
        status: 201,
        pre: TOMORROW,
        body: { workshop_id: '{{workshop_id}}', service_id: '{{service_id}}', booking_date: '{{booking_date}}', time_slot: '11:00', vehicle_id: '{{vehicle_id}}' },
        saves: { booking2_order_id: 'data.id' },
        desc: 'Booking dengan kendaraan tersimpan; detail order memuat objek `vehicle`.',
      }),
      req({
        name: 'Reschedule Booking (Customer)',
        method: 'PATCH',
        path: '/orders/{{booking2_order_id}}/reschedule',
        token: 'customer_token',
        body: { booking_date: '{{booking_date}}', time_slot: '14:00' },
        desc: `Pindah ke slot lain di bengkel yang sama (status \`CONFIRMED\`/\`IN_QUEUE\`). Slot lama dilepas dan antrean di sana otomatis naik; slot baru diambil, atau masuk daftar tunggu bila penuh.

Error: **400** \`SAME_SLOT\`, **409** \`TOO_LATE_TO_RESCHEDULE\` (slot lama sudah mulai), \`INVALID_TRANSITION\`, \`DUPLICATE_BOOKING\`, **422** aturan slot (\`OUTSIDE_OPERATING_HOURS\`, \`WORKSHOP_CLOSED_DAY\`, \`DURING_BREAK\`, ...).`,
      }),
      req({
        name: 'Set Weekly Closed Days & Break',
        method: 'PUT',
        path: '/workshops/profile',
        token: 'owner_token',
        body: { closed_weekdays: [], break_start: '12:00', break_end: '13:00' },
        desc: '`closed_weekdays`: 0 = Minggu … 6 = Sabtu (`[]` = buka setiap hari). `break_start`/`break_end` dikirim berpasangan (`null` keduanya = hapus jam istirahat). Slot yang kena tutup/istirahat tampil `bookable: false` dengan `unavailable_reason` di availability.',
      }),
      req({
        name: 'Add Holiday',
        method: 'POST',
        path: '/workshops/holidays',
        token: 'owner_token',
        status: 201,
        pre: ["const d = new Date(Date.now() + 7 * 3600e3 + 5 * 864e5).toISOString().slice(0, 10);", "pm.collectionVariables.set('holiday_date', d);"],
        body: { date: '{{holiday_date}}', note: 'Cuti bersama' },
        saves: { holiday_id: 'data.id' },
        desc: 'Hari libur satu tanggal (tidak bisa tanggal lampau). Tanggal yang sama ditimpa catatannya.',
      }),
      req({ name: 'List Holidays', method: 'GET', path: '/workshops/holidays', token: 'owner_token', desc: 'Opsional `?from=&to=` (YYYY-MM-DD).' }),
      req({ name: 'Delete Holiday', method: 'DELETE', path: '/workshops/holidays/{{holiday_id}}', token: 'owner_token', desc: '**404** bila bukan milik bengkel Anda.' }),
      req({
        name: 'Next Free Slot (Public)',
        method: 'GET',
        path: '/workshops/{{workshop_id}}/next-slot',
        desc: 'Slot terdekat (hari ini s/d +30 hari) yang masih punya kapasitas: `{ booking_date, time_slot, remaining }`, atau `null`. Opsional `?from=YYYY-MM-DD`.',
      }),
      req({
        name: 'Workshops With Room In A Slot (Public)',
        method: 'GET',
        path: '/workshops',
        pre: TOMORROW,
        query: [
          { key: 'date', value: '{{booking_date}}' },
          { key: 'time_slot', value: '15:00' },
        ],
        desc: '`date` + `time_slot` (berpasangan) → hanya bengkel yang buka dan masih punya kapasitas di slot itu (memperhitungkan hari tutup, libur, istirahat). Slot yang sudah lewat → **422** `SLOT_ALREADY_STARTED`.',
      }),
      req({
        name: 'Upload Workshop Photo',
        method: 'POST',
        path: '/workshops/photos',
        token: 'owner_token',
        status: 201,
        form: [{ key: 'photo', file: 'sample-image.png', desc: 'JPEG/PNG/WEBP, maks 2MB' }],
        saves: { photo_id: 'data.id' },
        desc: 'Maks 10 foto per bengkel (**422** `PHOTO_LIMIT`). Foto pertama otomatis jadi sampul. URL publik: `GET /workshops/:id/photos/:photoId` (juga tercantum di `photos[]` pada detail bengkel).',
      }),
      req({ name: 'List Workshop Photos', method: 'GET', path: '/workshops/photos', token: 'owner_token', desc: '`[{ id, is_cover, sort_order, url }]`.' }),
      req({ name: 'Set Cover Photo', method: 'PATCH', path: '/workshops/photos/{{photo_id}}/cover', token: 'owner_token', desc: 'Menjadikan foto ini satu-satunya sampul.' }),
      req({
        name: 'Get Workshop Photo (Public)',
        method: 'GET',
        path: '/workshops/{{workshop_id}}/photos/{{photo_id}}',
        desc: 'Gambar publik (hanya bengkel APPROVED). Header `Cross-Origin-Resource-Policy: cross-origin` agar bisa ditampilkan web app di domain lain.',
      }),
      req({
        name: 'Upload Mechanic Photo',
        method: 'PUT',
        path: '/workshops/mechanics/{{mechanic_id}}/photo',
        token: 'owner_token',
        form: [{ key: 'photo', file: 'sample-image.png', desc: 'JPEG/PNG/WEBP, maks 2MB' }],
        desc: 'Mengganti foto mekanik (file lama dihapus). `DELETE` ke path yang sama menghapus foto. URL publik ada di `mechanics[].photo_url` pada detail bengkel.',
      }),
      req({
        name: 'Get Own Workshop Photo (Owner)',
        method: 'GET',
        path: '/workshops/photos/{{photo_id}}/file',
        query: [{ key: 'size', value: 'sm', desc: 'Opsional: thumbnail' }],
        token: 'owner_token',
        desc: 'Foto milik sendiri untuk portal pemilik, **juga saat bengkel belum disetujui** (URL publik baru aktif setelah APPROVED). `size=sm` = thumbnail 640 px. `Cache-Control: private`.',
      }),
      req({
        name: 'Get Own Mechanic Photo (Owner)',
        method: 'GET',
        path: '/workshops/mechanics/{{mechanic_id}}/photo',
        token: 'owner_token',
        desc: 'Foto mekanik milik sendiri, juga sebelum bengkel disetujui. **404** bila mekanik belum punya foto.',
      }),
      req({ name: 'Delete Workshop Photo', method: 'DELETE', path: '/workshops/photos/{{photo_id}}', token: 'owner_token', desc: 'Bila sampul dihapus, foto tertua berikutnya otomatis jadi sampul. File ikut dihapus.' }),
      req({ name: 'Public Platform Stats', method: 'GET', path: '/stats/public', desc: 'Angka nyata untuk beranda: bengkel aktif, mekanik aktif, pelanggan, pesanan selesai, rating rata-rata, rata-rata waktu respons SOS (menit, 90 hari). Di-cache ±5 menit.' }),
      req({
        name: 'Owner Daily Stats',
        method: 'GET',
        path: '/workshops/me/stats',
        token: 'owner_token',
        desc: 'Satu hari (`?date=`, default hari ini WIB): booking, daftar tunggu, SOS masuk/ditangani, utilisasi kuota, pendapatan terverifikasi hari itu, bukti bayar menunggu, mekanik aktif, rating.',
      }),
      req({ name: 'Admin Stats', method: 'GET', path: '/admin/stats', token: 'admin_token', desc: 'Bengkel per status, pengguna per role, pesanan hari ini, SOS berjalan, bukti bayar menunggu, pendapatan & refund 30 hari.' }),
      req({
        name: 'Admin Search',
        method: 'GET',
        path: '/admin/search',
        token: 'admin_token',
        query: [{ key: 'q', value: 'Jaya', description: 'min 2 karakter' }],
        desc: 'Satu kotak cari: bengkel (nama/telepon), pesanan (nomor), pembayaran (invoice/RRN/nama pengirim), pengguna (nama/email/telepon). Maks 10 per kelompok.',
      }),
      req({
        name: 'Admin Audit Logs',
        method: 'GET',
        path: '/admin/audit-logs',
        token: 'admin_token',
        query: [
          { key: 'entity', value: 'order', disabled: true, description: 'order | workshop | service' },
          { key: 'action', value: 'PAYMENT_VERIFIED', disabled: true },
          { key: 'from', value: '2026-01-01', disabled: true },
        ],
        desc: 'Jejak tindakan penting (append-only, tidak bisa diubah/dihapus di database): `WORKSHOP_APPROVE/REJECT/SUSPEND`, `PAYMENT_VERIFIED/REJECTED/REFUNDED`, `ORDER_CANCELLED`, `EMERGENCY_PRICE_CHANGED`, `QRIS_UPLOADED/REPLACED`, `SERVICE_DELETED`.',
      }),
      req({ name: 'Admin System Health', method: 'GET', path: '/admin/health', token: 'admin_token', desc: 'Status database (latensi), versi PostGIS, migrasi terpasang, Redis, jadwal cron berikutnya, versi API, uptime.' }),
      req({
        name: 'Admin List Users',
        method: 'GET',
        path: '/admin/users',
        token: 'admin_token',
        query: [
          { key: 'role', value: 'CUSTOMER', disabled: true, description: 'CUSTOMER | GUEST | WORKSHOP_OWNER | ADMIN' },
          { key: 'q', value: 'budi', disabled: true, description: 'nama / email / telepon' },
          { key: 'active', value: 'false', disabled: true, description: 'true | false' },
        ],
        desc: 'BE-15. Daftar akun terbaru dulu, termasuk bengkel milik owner dan jumlah pesanan pelanggan.',
      }),
      req({
        name: 'Admin Create Admin',
        method: 'POST',
        path: '/admin/users/admins',
        token: 'admin_token',
        status: 201,
        body: { name: 'Admin Kedua', email: 'admin2+{{run_id}}@example.com', password: 'Rahasia123' },
        saves: { admin2_id: 'data.id' },
        desc: 'Menambah admin (password mengikuti aturan yang sama dengan pendaftaran). **409** `EMAIL_TAKEN`. Tercatat di audit log `ADMIN_CREATED`.',
      }),
      req({
        name: 'Admin Deactivate User',
        method: 'PATCH',
        path: '/admin/users/{{admin2_id}}/active',
        token: 'admin_token',
        body: { active: false, reason: 'Contoh dokumentasi' },
        desc: `\`{ active: false }\` menonaktifkan akun: login ditolak (**403** \`ACCOUNT_DISABLED\`) dan semua refresh token dicabut; access token yang sudah terbit berlaku sampai kedaluwarsa (maks 15 menit). \`{ active: true }\` mengaktifkan kembali.

Tidak bisa menonaktifkan diri sendiri (**422** \`CANNOT_DEACTIVATE_SELF\`) atau admin aktif terakhir (**422** \`LAST_ADMIN\`). Tercatat di audit log \`USER_DEACTIVATED\` / \`USER_ACTIVATED\`.`,
      }),
      req({ name: 'Delete Saved Vehicle', method: 'DELETE', path: '/vehicles/{{vehicle_id}}', token: 'customer_token', desc: 'Soft delete; pesanan lama tetap menyimpan data kendaraannya.' }),
    ],
  ),

  folder(
    '12. Akun Saya (profil)',
    `Profil pengguna yang sedang login, di bawah \`/auth/me\` (agar cookie sesi \`bengkel_rt\` ikut terkirim dan server tahu perangkat mana yang meminta).

- Semua butuh login. Akun **GUEST** hanya boleh ubah nama & nomor dan melihat/keluarkan perangkat (**403** untuk foto, password, email, hapus akun).
- Ganti password, minta ganti email, dan hapus akun dibatasi **10 / 15 menit per akun** (\`RATE_LIMITED\`); konfirmasi kode memakai batas verifikasi (20/jam).
- Folder ini memakai **akun demo sendiri** (didaftarkan di request pertama, dihapus di request terakhir), jadi akun pelanggan utama tidak terpengaruh.
- Semua respons yang mengubah akun mengembalikan \`{ user }\` terbaru: \`{ id, name, email, phone, role, created_at, email_verified, photo_url, has_password, google_linked }\`.`,
    [
      req({
        name: 'Register Customer (akun demo)',
        method: 'POST',
        path: '/auth/register/customer',
        status: 201,
        body: { name: 'Dewi Profil', email: 'akun+{{run_id}}@example.com', phone: '081277778888', password: 'Akun12345' },
        saves: { acct_token: 'data.access_token', acct_refresh_token: 'data.refresh_token' },
        desc: 'Akun pelanggan khusus untuk folder ini (aturan sama dengan Register Customer).',
      }),
      req({
        name: 'Update My Details',
        method: 'PATCH',
        path: '/auth/me',
        token: 'acct_token',
        body: { name: 'Dewi Profil Baru', phone: '085712345678' },
        desc: `Ubah \`name\` (2–100 karakter) dan/atau \`phone\` (nomor WhatsApp Indonesia); minimal salah satu. **200** → \`{ user }\`. **400** \`VALIDATION_ERROR\`.`,
      }),
      req({
        name: 'Upload Profile Photo',
        method: 'PUT',
        path: '/auth/me/photo',
        token: 'acct_token',
        form: [{ key: 'photo', file: 'sample-image.png', desc: 'JPEG/PNG/WEBP, maks 2MB' }],
        desc: 'Foto profil (foto lama dihapus). Disimpan sebagai WebP maks. 256 px tanpa data lokasi kamera. **200** → `{ user }` dengan `photo_url` = `/auth/me/photo?v=…` (nilai `v` berubah setiap foto baru). **400** `INVALID_FILE_TYPE` / `FILE_TOO_LARGE`.',
      }),
      req({
        name: 'Get Profile Photo',
        method: 'GET',
        path: '/auth/me/photo',
        token: 'acct_token',
        desc: 'Gambar foto profil milik sendiri (butuh login; `Cache-Control: private`). **404** bila belum ada foto.',
      }),
      req({
        name: 'Delete Profile Photo',
        method: 'DELETE',
        path: '/auth/me/photo',
        token: 'acct_token',
        desc: 'Menghapus foto profil (avatar kembali ke huruf depan nama). **200** → `{ user }` dengan `photo_url: null`.',
      }),
      req({
        name: 'List Signed-in Devices',
        method: 'GET',
        path: '/auth/me/sessions',
        token: 'acct_token',
        saves: { acct_session_id: 'data.0.id' },
        desc: '`[{ id, user_agent, signed_in_at, last_active_at, current }]`, terakhir aktif dulu. Satu baris = satu perangkat (satu rangkaian refresh token). `current` dikenali dari cookie `bengkel_rt`.',
      }),
      req({
        name: 'Sign Out Other Devices',
        method: 'POST',
        path: '/auth/me/sessions/revoke-others',
        token: 'acct_token',
        body: { refresh_token: '{{acct_refresh_token}}' },
        desc: 'Mengeluarkan semua perangkat lain; perangkat ini (cookie, atau `refresh_token` di body untuk klien non-browser) tetap masuk. **200** → `{ signed_out_devices }`.',
      }),
      req({
        name: 'Change Password',
        method: 'PUT',
        path: '/auth/me/password',
        token: 'acct_token',
        body: { current_password: 'Akun12345', new_password: 'AkunBaru123', refresh_token: '{{acct_refresh_token}}' },
        desc: `\`current_password\` wajib bila akun sudah punya password; akun Google tanpa password cukup \`new_password\` (membuat password pertama). Perangkat lain dikeluarkan, perangkat ini tetap masuk, email pemberitahuan dikirim. **200** → \`{ user, signed_out_devices }\`. **422** \`WRONG_PASSWORD\` / \`PASSWORD_REQUIRED\`; **400** bila password baru lemah.`,
      }),
      req({
        name: 'Request Email Change',
        method: 'POST',
        path: '/auth/me/email-change',
        token: 'acct_token',
        body: { email: 'akun.baru+{{run_id}}@example.com', password: 'AkunBaru123' },
        desc: `Kirim kode 6 angka ke **email baru** (berlaku 15 menit); email akun belum berubah. \`password\` wajib bila akun punya password. **200** → \`{ new_email, expires_in_minutes }\`. **409** \`EMAIL_TAKEN\`, **422** \`SAME_EMAIL\` / \`WRONG_PASSWORD\` / \`PASSWORD_REQUIRED\`, **429** \`VERIFICATION_RESEND_TOO_SOON\` (kirim ulang ke alamat yang sama < 1 menit).`,
      }),
      req({
        name: 'Pending Email Change',
        method: 'GET',
        path: '/auth/me/email-change',
        token: 'acct_token',
        desc: 'Ganti email yang sedang menunggu kode: `{ new_email, sent_at, expires_at }`, atau `null`.',
      }),
      req({
        name: 'Confirm Email Change (code from new inbox)',
        method: 'POST',
        path: '/auth/me/email-change/confirm',
        token: 'acct_token',
        status: 422,
        body: { code: '000000' },
        desc: `Masukkan kode dari email baru. **200** → \`{ user }\` dengan email baru dan \`email_verified: true\`; email lama menerima pemberitahuan; tercatat di audit log (\`USER_EMAIL_CHANGED\`).

Saat dijalankan otomatis request ini **sengaja gagal** (kode contoh): **422** \`VERIFICATION_CODE_INVALID\`. Error lain: \`VERIFICATION_CODE_EXPIRED\`, \`VERIFICATION_TOO_MANY_ATTEMPTS\` (5× salah), **409** \`EMAIL_TAKEN\` (alamat keburu dipakai akun lain).`,
      }),
      req({
        name: 'Cancel Email Change',
        method: 'DELETE',
        path: '/auth/me/email-change',
        token: 'acct_token',
        desc: 'Membatalkan ganti email yang menunggu kode. **200** → `{ cancelled: true }`.',
      }),
      req({
        name: 'Sign Out One Device',
        method: 'DELETE',
        path: '/auth/me/sessions/{{acct_session_id}}',
        token: 'acct_token',
        desc: 'Mengeluarkan satu perangkat (id dari List Signed-in Devices). **200** → `{ id, revoked: true }`; **404** bila perangkat itu sudah keluar.',
      }),
      req({
        name: 'Delete My Account (customer)',
        method: 'POST',
        path: '/auth/me/delete',
        token: 'acct_token',
        body: { password: 'AkunBaru123' },
        desc: `Khusus **CUSTOMER**. Konfirmasi dengan \`password\` (atau \`confirm: "HAPUS"\` untuk akun Google tanpa password). Syarat: tidak ada pesanan yang belum selesai. Data pribadi dianonimkan (nama "Pengguna dihapus", email/WA/password/foto/notifikasi dihapus, plat kendaraan dikosongkan), semua sesi dicabut, email konfirmasi dikirim, tercatat di audit log (\`USER_DELETED\`). Riwayat pesanan & ulasan tetap untuk catatan bengkel; email bisa dipakai daftar lagi. **200** → \`{ deleted: true }\`.

Error: **403** \`ACCOUNT_DELETE_NOT_ALLOWED\` (pemilik bengkel/admin), **409** \`ACCOUNT_HAS_OPEN_ORDERS\`, **422** \`PASSWORD_REQUIRED\` / \`WRONG_PASSWORD\` / \`DELETE_CONFIRMATION_REQUIRED\`.`,
      }),
    ],
  ),

  folder('13. Session End', 'Ditaruh terakhir agar alur Runner tidak terganggu.', [
    req({
      name: 'Logout',
      method: 'POST',
      path: '/auth/logout',
      body: { refresh_token: '{{customer_refresh_token}}' },
      desc: 'Mencabut seluruh sesi (token family) dan menghapus cookie. Access token yang sudah terbit tetap berlaku sampai kedaluwarsa (maks 15 menit) — frontend wajib menghapusnya dari memori.',
    }),
  ]),
];

// ---------------------------------------------------------------- examples from a real run
function attachExamples(collection) {
  if (!fs.existsSync(RUN_REPORT)) {
    console.warn(`No ${path.relative(process.cwd(), RUN_REPORT)} found; skipping examples.`);
    return 0;
  }
  const report = JSON.parse(fs.readFileSync(RUN_REPORT, 'utf8'));
  const byName = new Map();
  for (const ex of report.run.executions) {
    if (ex.response && !byName.has(ex.item.name)) byName.set(ex.item.name, ex);
  }
  let n = 0;
  const walk = (list) =>
    list.forEach((it) => {
      if (it.item) return walk(it.item);
      const ex = byName.get(it.name);
      if (!ex) return;
      const ct = (ex.response.header || []).find((h) => h.key.toLowerCase() === 'content-type')?.value || '';
      if (!ct.includes('json')) return; // binary (images) — skip
      let body = Buffer.from(ex.response.stream.data).toString('utf8');
      try {
        body = JSON.stringify(JSON.parse(body), null, 2);
      } catch {}
      // Never ship real tokens in docs
      body = body.replace(/"(access_token|refresh_token)": "[^"]+"/g, '"$1": "<redacted>"');
      it.response = [
        {
          name: `${ex.response.code} ${ex.response.status}`,
          originalRequest: it.request,
          status: ex.response.status,
          code: ex.response.code,
          _postman_previewlanguage: 'json',
          header: [{ key: 'Content-Type', value: 'application/json; charset=utf-8' }],
          body,
        },
      ];
      n++;
    });
  walk(collection.item);
  return n;
}

const collection = {
  info: {
    name: 'Bengkel API v1',
    _postman_id: 'b3c1f0a2-6d1e-4c8a-9a51-bengkelapi0001',
    description: `Dokumentasi REST API **Web Platform Services & Emergency Roadside Assistance Bengkel**.

**Base URL**: \`{{base_url}}\` (default \`http://localhost:8080/api/v1\` via NGINX, atau \`http://localhost:4000/api/v1\` langsung).

**Format respons**
\`\`\`json
{ "success": true, "data": { } }
{ "success": false, "error": { "code": "ERROR_CODE", "message": "...", "details": { } } }
\`\`\`

**Autentikasi**: \`Authorization: Bearer <access_token>\`. Collection ini menyimpan token per role di variabel: \`customer_token\`, \`owner_token\`, \`guest_token\`, \`admin_token\`.

**Menjalankan alur lengkap**: buka *Run collection* → jalankan semua request berurutan. Setiap langkah otomatis menyimpan token & ID (\`workshop_id\`, \`service_id\`, \`emergency_order_id\`, \`booking_order_id\`, …) untuk request berikutnya.

**Kode HTTP umum**: 400 validasi · 401 belum login / token invalid · 403 role tidak berhak · 404 tidak ditemukan / bukan milik Anda · 409 konflik state · 422 aturan bisnis · 429 rate limit (lihat header \`Retry-After\`) · 500 error server.`,
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  item: items,
  variable: [
    'run_id', 'customer_email', 'owner_email', 'customer_token', 'customer_refresh_token', 'customer_id',
    'owner_token', 'guest_token', 'admin_token', 'workshop_id', 'service_id', 'mechanic_id', 'mechanic_id_2',
    'emergency_order_id', 'booking_order_id', 'booking_date', 'ws_lat', 'ws_lng',
    'temp_service_id', 'review_id', 'vehicle_id', 'booking2_order_id', 'holiday_date', 'holiday_id', 'photo_id', 'admin2_id', 'acct_token', 'acct_refresh_token', 'acct_session_id',
  ].map((key) => ({ key, value: '', type: 'string' })),
};

const environment = {
  id: 'b3c1f0a2-6d1e-4c8a-9a51-bengkelenv0001',
  name: 'Bengkel API - Local',
  values: [
    { key: 'server_url', value: 'http://localhost:8080', type: 'default', enabled: true },
    { key: 'base_url', value: '{{server_url}}/api/v1', type: 'default', enabled: true },
    { key: 'admin_email', value: 'admin@bengkelapp.com', type: 'default', enabled: true },
    { key: 'admin_password', value: 'ChangeMe!Admin123', type: 'secret', enabled: true },
  ],
  _postman_variable_scope: 'environment',
};

fs.mkdirSync(OUT_DIR, { recursive: true });
const withExamples = process.argv.includes('--examples') ? attachExamples(collection) : 0;
fs.writeFileSync(path.join(OUT_DIR, 'Bengkel-API.postman_collection.json'), JSON.stringify(collection, null, 2) + '\n');
fs.writeFileSync(path.join(OUT_DIR, 'Bengkel-API.local.postman_environment.json'), JSON.stringify(environment, null, 2) + '\n');
// 1x1 PNG used by the upload requests
fs.writeFileSync(
  path.join(OUT_DIR, 'sample-image.png'),
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'),
);

let count = 0;
const countReq = (list) => list.forEach((i) => (i.item ? countReq(i.item) : count++));
countReq(collection.item);
console.log(`Postman collection written: ${count} requests${withExamples ? `, ${withExamples} with response examples` : ''}`);
