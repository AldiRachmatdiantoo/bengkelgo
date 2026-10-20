# 📄 Product Requirement Document (PRD) & Product Backlog

**Project Title:** Web Platform Services & Emergency Roadside Assistance Bengkel  
**Version:** 4.0 (Full-Stack Unified Specification with Design System & Testing Suite)  
**Target Environment:** Web (Responsive Desktop & Mobile Web)  
**Deployment Infrastructure:** Vercel (Frontend), Supabase & Docker, NGINX Load Balancer, Redis Rate Limiter  

---

## 🔒 NON-NEGOTIABLE CORE PRINCIPLES

> **1. SECURITY FIRST OVER FEATURES**  
> Keamanan sistem, data privasi pengguna, dan ketahanan infrastruktur adalah prioritas utama yang tidak boleh dikompromikan demi mengejar penyelesaian fitur. Seluruh pengembangan API, autentikasi, serta interaksi basis data wajib menerapkan prinsip *Least Privilege*, *Input Validation/Sanitization*, *Rate Limiting*, *Data Encryption*, dan kepatuhan terhadap OWASP Top 10 sebelum fitur dianggap selesai (*Definition of Done*).
>
> **2. MANDATORY DATABASE TRANSACTIONS & CONCURRENCY LOCKING**  
> Setiap operasi mutasi data yang melibatkan lebih dari satu tabel (seperti `orders` + `emergency_details` / `booking_details` / `transactions`) **WAJIB** dibungkus dalam **Database Transaction (`BEGIN...COMMIT / ROLLBACK`)**. Khusus alur alokasi kuota booking jam (`max_slot_per_hour`), transaksi **WAJIB** menerapkan **Pessimistic Locking (`SELECT ... FOR UPDATE`)** guna mencegah *race condition* dan data korup (*partial insert/update*).

---

## 1. Latar Belakang & Visi Produk (Background & Vision)

### 1.1. Latar Belakang Masalah
Di Indonesia, sektor UMKM bengkel kendaraan (baik motor maupun mobil) menghadapi dua tantangan utama:
1. **Kurang Terlihat (Low Digital Visibility):** Banyak bengkel lokal berkualitas tinggi namun sulit ditemukan oleh pemilik kendaraan yang mengalami kendala darurat (*breakdown*) di jalan atau pengguna baru di area sekitar.
2. **Operasional & Pencatatan Manual:** Sebagian besar bengkel masih mengandalkan pencatatan antrean, stok, dan laporan keuangan secara manual menggunakan kertas atau ingatan. Hal ini memicu risiko penumpukan antrean, inefisiensi alokasi mekanik, dan kebocoran transaksi.

### 1.2. Harapan & Solusi Produk
Aplikasi ini hadir sebagai solusi terpadu full-stack (Backend API & Frontend Web UI) untuk:
* **Meningkatkan Visibilitas Digital:** Membantu bengkel terdaftar dijangkau secara presisi melalui peta digital dan *spatial radius scan* saat pelanggan membutuhkan layanan darurat (*emergency assistance*) maupun *service* berkala.
* **Digitalisasi Operasional & Digital Record-keeping:** Menggantikan sistem manual dengan manajemen kuota berbasis jam, penomoran antrean otomatis, penugasan mekanik, serta rekapitulasi transaksi otomatis yang transparan.

---

## 2. Tech Stack & Infrastructure Architecture

* **Frontend:** React with TypeScript (Client-Side Rendering, Tailwind CSS / UI Components, Deployed on Vercel)
* **Backend:** Express.js with TypeScript (Monolithic Layered & Feature-Based Architecture)
* **Database & BaaS:** Supabase (PostgreSQL with PostGIS extension for spatial queries)
* **Caching & Rate Limiting:** Redis Store
* **Load Balancer & Reverse Proxy:** NGINX / Cloudflare
* **Authentication:** JWT with Refresh Token Rotation, Guest Session, and OAuth 2.0 (Google OAuth)
* **Scheduling:** Node-Cron (for automated email reminders and booking window processing)
* **Containerization:** Docker & Docker Compose

---

## 3. UI/UX Design System & Color Palette (Traveloka Theme)

Frontend didesain bersih, modern, dan tepercaya menggunakan inspirasi palet warna khas **Traveloka** (Dominasi Biru dan Putih) untuk membangun kepercayaan pengguna saat terjadi situasi darurat maupun saat melakukan transaksi layanan.

### 3.1. Color Tokens (Tailwind CSS Configuration)
* **Primary Brand Blue:** `#0194DA` (Traveloka Azure Blue - Utama: Header, Primary Buttons, Active States)
* **Dark Navy / Deep Blue:** `#002D62` (Aksen & Teks Utama, Navbar Dark Elements)
* **Secondary Sky Blue:** `#E8F5FC` (Background Cards, Hover States, Highlight Badges)
* **Pure Neutral White:** `#FFFFFF` (Surface Background, Modal Window, Form Input Fill)
* **Background Canvas:** `#F7F9FA` (Soft Light Gray/Blueish Background untuk kontras kartu)
* **Emergency Alert Red:** `#D9383A` (Indikator Tombol Darurat / SOS Breakdown)
  > **Catatan implementasi (19 Okt 2026):** atas permintaan tim, frontend memakai **Warm Safety Orange `#F05A28`** (hover `#EA580C`) untuk semua elemen SOS/darurat, dan primer `#4361EE` (lihat `frontend/README.md`). Nilai PRD di atas belum diubah sampai disetujui tim.
* **Success Green:** `#00A651` (Indikator Status Booking Diterima & Pembayaran Terverifikasi)

---

## 4. User Roles & Permission Matrix

| Role | Access & Rights |
| --- | --- |
| **Customer / Guest** | Quick-register/login via Form or Google OAuth 2.0, request emergency dispatch via GPS, book service slots, upload QRIS payment proofs, leave ratings/reviews. |
| **Workshop Owner** | Manage workshop profile, set GPS coordinates, manage mechanics/services, configure hourly quotas, accept/decline emergency calls, verify payments. |
| **Website Admin** | Verify & approve new workshop registrations, suspend workshops, view platform-wide reports & analytics. |

---

## 5. Feature Directory & Project Structure

```
project-root/
├── frontend/                     # 🎨 REACT TYPESCRIPT FRONTEND (Vercel)
│   ├── src/
│   │   ├── assets/               # Images, Icons, Branding Assets
│   │   ├── components/           # Reusable UI (Buttons, Modals, MapPicker, Navbar)
│   │   ├── pages/                # Customer, Owner Dashboard & Admin Views
│   │   ├── services/             # Axios API Client & State Stores
│   │   ├── theme/                # Traveloka Blue Palette & Tailwind Setup
│   │   └── App.tsx
├── backend/                      # ⚙️ EXPRESS TYPESCRIPT BACKEND (Docker)
│   ├── src/
│   │   ├── config/               # Global config (Env, Supabase, Redis, OAuth)
│   │   ├── common/               # Middlewares (Transactions, Rate Limiters, Auth, Security)
│   │   ├── features/             # Feature-Based Modules
│   │   │   ├── auth/             # JWT, Refresh Tokens, Google OAuth, Guest
│   │   │   ├── emergency/        # PostGIS 5km Radius & Auto-Routing Transaction
│   │   │   ├── booking/          # Service Booking & Row-Locking Quota Engine
│   │   │   ├── workshop/         # Profile, Services, Mechanics CRUD
│   │   │   ├── payment/          # QRIS Proof Upload & Verification
│   │   │   ├── review/           # Rating System
│   │   │   └── admin/            # Approvals & Financial Reports
│   │   ├── routes/               # Central Routing
│   │   └── server.ts
│   ├── nginx/                    # Load Balancer Config
│   └── docker-compose.yml
```

---

## 6. Security, Load Balancing & Concurrency Control

### 6.1. Mandatory Security Architecture (Security First)
* **Input Validation & Sanitization:** All payload inputs MUST be validated via Zod/Joi schema before entering controllers.
* **SQL Injection Protection:** STRICT use of parameterized queries / ORM repositories; zero raw string concatenation in SQL queries.
* **Data at Rest & Motion:** Strict HTTPS/TLS enforcement, bcrypt/argon2 hashing for sensitive fields, and token hashing for refresh token rotation.
* **Security Headers:** Express app MUST enforce Helmet middleware (CSP, HSTS, X-Frame-Options, X-Content-Type-Options).

### 6.2. Strict Database Transaction & Concurrency Enforcement
```sql
-- Transactional Pattern Enforcement for Order Creation & Slot Booking
BEGIN;
  -- 1. Lock quota row for pessimistic concurrency check
  SELECT current_booked, max_slot_per_hour 
  FROM workshop_quotas 
  WHERE workshop_id = $1 AND slot_time = $2 
  FOR UPDATE;

  -- 2. Execute insert order and sub-table details
  INSERT INTO orders (...) VALUES (...);
  INSERT INTO booking_details (...) VALUES (...);

  -- 3. Update slot quota count
  UPDATE workshop_quotas SET current_booked = current_booked + 1 WHERE ...;
COMMIT;
```

### 6.3. Database Indexing Strategy
```sql
-- Spatial Index for 5 KM Emergency Radius Scanning
CREATE INDEX idx_workshops_location_gist ON workshops USING GIST (location);

-- B-Tree Indexes for Frequent Lookups & Foreign Keys
CREATE INDEX idx_workshops_status ON workshops(status);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_workshop_id ON orders(workshop_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_booking_details_date_slot ON booking_details(booking_date, time_slot);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_mechanics_workshop_id_rating ON mechanics(workshop_id, avg_rating DESC);
```

### 6.4. OAuth 2.0 Integration & Load Balancing
* **OAuth 2.0:** Google Authorization Code Flow with PKCE. Auto-creates account with `CUSTOMER` role if email isn't registered.
* **Load Balancer:** NGINX Layer 7 `least_conn` upstream configuration for distributing load across backend nodes.
* **Rate Limiting:** Redis sliding window (10 requests/min for Emergency API, 15 requests/15 mins for Auth).

---

## 7. Functional Requirements (FR)

* **FR-AUT-01:** System MUST generate short-lived JWT access tokens and rotated refresh tokens stored securely.
* **FR-AUT-02:** System MUST support Google OAuth 2.0 and Guest Mode (Name, WhatsApp, GPS) registration.
* **FR-EME-01:** System MUST perform PostGIS `ST_DWithin` spatial query to discover workshops within 5 KM radius.
* **FR-EME-02:** System MUST execute emergency order creation inside an atomic Database Transaction (`BEGIN...COMMIT`).
* **FR-BOO-01:** System MUST enforce row-level pessimistic locking (`FOR UPDATE`) when booking service slots to prevent overbooking.
* **FR-PAY-01:** System MUST validate image type and file size (<2MB) for QRIS payment receipts.
* **FR-CRN-01:** Node-Cron daily job MUST send email reminders for upcoming bookings scheduled for `CURRENT_DATE + 1`.

---

## 8. Multi-Method Comprehensive Testing Strategy

Sistem ini wajib diuji menggunakan seluruh metode pengujian standar industri untuk menjamin keandalan data, keamanan, performa tinggi, dan pengalaman pengguna (*user experience*) yang bebas kendala:

### 8.1. Backend Testing Methods

| Method / Test Type | Scope & Tooling | Objective & Verification Standard |
| --- | --- | --- |
| **Unit Testing** | Jest / Mocha | Testing fungsi terisolasi pada Service Layer, utility JWT, hashing password, dan kalkulasi nomor antrean tanpa koneksi DB. |
| **Integration Testing** | Supertest + Test DB | Testing API Endpoints, memastikan middleware auth, rate limiter, dan ORM/SQL queries berkomunikasi dengan DB secara benar. |
| **Transaction & Rollback Testing** | Jest + PostGIS Test Container | Menyimulasi kegagalan sengaja di tengah transaksi (misal: insert `orders` sukses tetapi insert `emergency_details` error) untuk memverifikasi `ROLLBACK` berjalan 100% sempurna tanpa sisa data yatim (*orphaned data*). |
| **Concurrency & Race Condition Testing** | k6 / Artillery | Menembakkan 50–100 request bersamaan dalam millisecond yang sama ke endpoint booking (`POST /booking`) untuk membuktikan row locking (`FOR UPDATE`) berhasil membatasi slot secara presisi tanpa overbooking. |
| **Spatial Query Testing** | PostGIS Test Scripts | Menguji performa dan akurasi query `ST_DWithin` pada titik koordinat batas (tepat 4.9 km vs 5.1 km) serta efisiensi indeks GIST. |
| **Security & Penetration Testing** | OWASP ZAP / Burp Suite | Menguji ketahanan API terhadap SQL Injection, Cross-Site Scripting (XSS), Rate Limiting Bypass, dan Broken Object Level Authorization (BOLA). |

### 8.2. Frontend Testing Methods

| Method / Test Type | Scope & Tooling | Objective & Verification Standard |
| --- | --- | --- |
| **Component Unit Testing** | React Testing Library + Vitest | Menguji render komponen individual (tombol SOS, kartu bengkel, modal QRIS) dan perubahan state interaktif. |
| **End-to-End (E2E) Testing** | Cypress / Playwright | Testing alur pengguna penuh (*Full User Journeys*):<br>1. Customer Guest Order Emergency $\rightarrow$ Payment Upload $\rightarrow$ Workshop Accept.<br>2. Owner Workshop Register $\rightarrow$ Admin Approval $\rightarrow$ Quota Configuration. |
| **Visual Regression & Design System Testing** | Storybook / Percy | Memastikan kepatuhan palet warna Traveloka (Blue `#0194DA`, Sky Blue `#E8F5FC`, Navy `#002D62`) dan konsistensi tata letak di layar Mobile (375px) vs Desktop (1440px). |
| **Cross-Browser & Responsive Testing** | BrowserStack / Playwright Cross-Browser | Memastikan fungsionalitas dan tampilan berjalan mulus di Google Chrome, Safari Mobile (iOS), Firefox, dan Edge. |
| **Accessibility (a11y) Testing** | Axe-core / Lighthouse | Memastikan kontras warna rasio Traveloka Blue memenuhi standar WCAG AA dan elemen tombol/peta dapat diakses dengan keyboard/screen reader. |

---

## 9. API Contract Summary

**Base URL:** `https://api.bengkelapp.com/api/v1`  
**Authentication Header:** `Authorization: Bearer <JWT_ACCESS_TOKEN>`

| Endpoint | Method | Access | Description |
| --- | --- | --- | --- |
| `/auth/register/workshop` | `POST` | Public | Register new workshop partner |
| `/auth/login` | `POST` | Public | Login with email/password |
| `/auth/google` | `POST` | Public | Authenticate via Google OAuth 2.0 |
| `/auth/guest` | `POST` | Public | Quick guest register for emergency |
| `/emergency/scan` | `POST` | Public/Customer | Get active workshops within 5 km radius (Rate limited) |
| `/emergency/request` | `POST` | Customer/Guest | Create transactional emergency order |
| `/emergency/:order_id/respond` | `PATCH` | Workshop Owner | Accept or Decline emergency call |
| `/booking` | `POST` | Customer | Create service booking with row-locked quota check |
| `/workshops/profile` | `PUT` | Workshop Owner | Update location, operational hours & capacity |
| `/workshops/mechanics` | `POST` | Workshop Owner | Add mechanic to workshop |
| `/payments/upload` | `POST` | Customer/Guest | Upload static QRIS payment receipt |
| `/payments/:order_id/verify` | `PATCH` | Workshop Owner | Approve or reject payment proof |
| `/admin/workshops/:id/approval` | `PATCH` | Admin | Approve or reject registered workshop |
| `/admin/reports/transactions` | `GET` | Admin | Fetch platform-wide transactional summary |

---

## 10. Product Backlog & Sprint Breakdown

### Epic Overview
1. **EPIC 1:** Infrastructure, Security & Auth Matrix (Foundation)
2. **EPIC 2:** Emergency Assistance & PostGIS Geolocation
3. **EPIC 3:** Workshop Management & Scheduled Booking Engine
4. **EPIC 4:** Payments, Ratings, Cron Jobs & Admin Control

---

### Sprint 1: Foundation, Infrastructure & Auth Matrix (Security Focus)

* **PBI-101 (Infra):** Set up Express.js TypeScript template with layered architecture (`controller`, `service`, `repository`).
* **PBI-102 (Infra):** Configure Docker Compose with PostgreSQL + PostGIS, Redis, and NGINX configuration.
* **PBI-103 (Infra):** Setup Database migrations, Indexing, and Transaction Manager Middlewares.
* **PBI-104 (Security):** Implement Redis sliding window Rate Limiting middleware & Helmet security headers.
* **PBI-105 (Auth):** Implement JWT Authentication (Access Token + Refresh Token Rotation mechanism).
* **PBI-106 (Auth):** Integrate Google OAuth 2.0 Authentication endpoint (`POST /auth/google`).
* **PBI-107 (Auth):** Implement Guest Session registration endpoint (`POST /auth/guest`).
* **PBI-108 (Frontend):** Setup React TS project with Traveloka Blue design tokens (`#0194DA`, `#E8F5FC`, `#002D62`) and base layout components.

---

### Sprint 2: Emergency Assistance Engine & Spatial Radius Scanning

* **PBI-201 (Emergency):** Implement PostGIS 5 KM radius scanning query (`ST_DWithin`) filtering active/approved workshops.
* **PBI-202 (Emergency):** Build Smart Auto-Routing logic prioritizing nearest workshops with highest mechanic rating (`avg_rating` DESC).
* **PBI-203 (Emergency):** Create Transactional Emergency Request endpoint (`POST /emergency/request`) wrapped in `BEGIN...COMMIT/ROLLBACK`.
* **PBI-204 (Emergency):** Create Workshop Response endpoint (`PATCH /emergency/:order_id/respond`) for accepting/declining requests.
* **PBI-205 (Emergency):** Implement automated 2-minute fallback re-routing queue logic when workshop fails to respond.
* **PBI-206 (Testing):** Build unit & spatial tests for PostGIS 5km query boundary cases and transaction rollback verification.

---

### Sprint 3: Workshop Portal & Scheduled Booking Engine

* **PBI-301 (Workshop):** Create Workshop Profile & Map Picker Coordinate update endpoint (`PUT /workshops/profile`).
* **PBI-302 (Workshop):** Create Mechanic CRUD management endpoints & specialization tags (`POST /workshops/mechanics`).
* **PBI-303 (Booking):** Implement Hourly Quota validation engine with Pessimistic Locking (`SELECT ... FOR UPDATE`).
* **PBI-304 (Booking):** Build Queue Number calculation logic (`IN_QUEUE` state when slots are saturated).
* **PBI-305 (Booking):** Build Mechanic Auto-Assignment engine for accepted bookings based on mechanic availability.
* **PBI-306 (Testing):** Execute k6 concurrency stress-testing on slot booking endpoint to verify zero overbooking under high traffic.

---

### Sprint 4: Payments, Email Cron, Admin Panel & Go-Live

* **PBI-401 (Payment):** Implement Static QRIS image fetching & payment proof upload endpoint (`POST /payments/upload`).
* **PBI-402 (Payment):** Implement Payment Verification endpoint (`PATCH /payments/:order_id/verify`).
* **PBI-403 (Review):** Implement Review and Rating system updating mechanic's average rating dynamically.
* **PBI-404 (Cron):** Configure Node-Cron daily scheduler for automated booking email reminders (`reminder_sent = true`).
* **PBI-405 (Admin):** Create Workshop Approval / Rejection dashboard endpoints (`PATCH /admin/workshops/:id/approval`).
* **PBI-406 (Admin):** Create Financial Transaction Summary endpoint (`GET /admin/reports/transactions`).
* **PBI-407 (E2E Testing):** Run full Playwright / Cypress E2E testing suite for all user roles and deploy Frontend to Vercel.