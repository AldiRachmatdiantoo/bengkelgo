# ERD Database BengkelGo

Dibuat otomatis dari skema database yang berjalan (`backend/scripts/erd/build-erd.py`). 17 tabel, 27 relasi. Migrasi: `001_init` s/d `005_reminder_2h`.

Versi teks untuk **QuickDBD** (app.quickdatabasediagrams.com): [erd-quickdbd.txt](erd-quickdbd.txt), dibuat dengan `backend/scripts/erd/build-quickdbd.py` dari ekspor kolom (dengan `column_default`), relasi, dan enum database lokal.

Cara baca garis: `||` tepat satu, `|o` nol atau satu, `o{` nol atau banyak. Label garis = kolom foreign key.

## Gambaran relasi

```mermaid
erDiagram
    users |o--o{ audit_logs : "actor_id"
    orders ||--o| booking_details : "order_id"
    services ||--o{ booking_details : "service_id"
    orders ||--o| emergency_details : "order_id"
    workshops ||--o{ mechanics : "workshop_id"
    users ||--o{ notifications : "user_id"
    users |o--o{ order_status_history : "actor_id"
    orders ||--o{ order_status_history : "order_id"
    users ||--o{ orders : "customer_id"
    mechanics |o--o{ orders : "mechanic_id"
    vehicles |o--o{ orders : "vehicle_id"
    workshops |o--o{ orders : "workshop_id"
    refresh_tokens |o--o{ refresh_tokens : "replaced_by"
    users ||--o{ refresh_tokens : "user_id"
    users ||--o{ reviews : "customer_id"
    mechanics |o--o{ reviews : "mechanic_id"
    orders ||--o| reviews : "order_id"
    workshops ||--o{ reviews : "workshop_id"
    workshops ||--o{ services : "workshop_id"
    orders ||--o| transactions : "order_id"
    users |o--o{ transactions : "refunded_by"
    users |o--o{ transactions : "verified_by"
    users ||--o{ vehicles : "user_id"
    workshops ||--o{ workshop_holidays : "workshop_id"
    workshops ||--o{ workshop_photos : "workshop_id"
    workshops ||--o{ workshop_quotas : "workshop_id"
    users ||--o| workshops : "owner_id"
```

## Akun & pelanggan

Pengguna semua peran, sesi login, notifikasi, dan kendaraan tersimpan.

```mermaid
erDiagram
    users {
        uuid id PK
        varchar name
        varchar email UK
        varchar phone
        text password_hash
        enum_user_role role
        varchar google_sub UK
        geography_point last_location
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }
    refresh_tokens {
        uuid id PK
        uuid user_id FK
        char token_hash UK
        uuid family_id
        timestamptz expires_at
        timestamptz revoked_at
        uuid replaced_by FK
        varchar user_agent
        timestamptz created_at
    }
    notifications {
        uuid id PK
        uuid user_id FK
        varchar type
        varchar title
        text body
        varchar link
        timestamptz read_at
        timestamptz created_at
    }
    vehicles {
        uuid id PK
        uuid user_id FK
        enum_vehicle_type vehicle_type
        varchar brand
        varchar model
        smallint year
        varchar color
        varchar plate
        timestamptz deleted_at
        timestamptz created_at
        timestamptz updated_at
    }
    users ||--o{ notifications : "user_id"
    refresh_tokens |o--o{ refresh_tokens : "replaced_by"
    users ||--o{ refresh_tokens : "user_id"
    users ||--o{ vehicles : "user_id"
```

| Tabel | Isi |
|---|---|
| `users` | Semua peran: CUSTOMER, GUEST, WORKSHOP_OWNER, ADMIN. |
| `refresh_tokens` | Hanya hash SHA-256 yang disimpan; satu family dicabut bila token dipakai ulang. |
| `notifications` | Notifikasi di dalam aplikasi per pengguna. *(baru, migrasi 004)* |
| `vehicles` | Kendaraan tersimpan pelanggan (soft delete). *(baru, migrasi 004)* |

## Bengkel

Profil bengkel mitra beserta layanan, mekanik, kuota per jam, hari libur, dan foto.

```mermaid
erDiagram
    workshops {
        uuid id PK
        uuid owner_id FK,UK
        varchar name
        text description
        text address
        varchar phone
        geography_point location
        vehicle_type_array vehicle_types
        enum_workshop_status status
        text status_reason
        boolean is_open
        boolean accepts_emergency
        time open_time
        time close_time
        smallint max_slot_per_hour
        text qris_image_path
        numeric avg_rating
        int total_reviews
        timestamptz approved_at
        timestamptz created_at
        timestamptz updated_at
        smallint_array closed_weekdays
        time break_start
        time break_end
    }
    services {
        uuid id PK
        uuid workshop_id FK
        varchar name
        text description
        numeric price
        smallint duration_minutes
        enum_vehicle_type vehicle_type
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at
    }
    mechanics {
        uuid id PK
        uuid workshop_id FK
        varchar name
        varchar phone
        text_array specializations
        boolean is_active
        numeric avg_rating
        int total_reviews
        timestamptz created_at
        timestamptz updated_at
        text photo_path
    }
    workshop_quotas {
        uuid id PK
        uuid workshop_id FK
        date slot_date
        time slot_time
        smallint max_slot_per_hour
        smallint current_booked
        timestamptz updated_at
    }
    workshop_holidays {
        uuid id PK
        uuid workshop_id FK
        date holiday_date
        varchar note
        timestamptz created_at
    }
    workshop_photos {
        uuid id PK
        uuid workshop_id FK
        text path
        boolean is_cover
        smallint sort_order
        timestamptz created_at
    }
    users {
        uuid id PK
    }
    workshops ||--o{ mechanics : "workshop_id"
    workshops ||--o{ services : "workshop_id"
    workshops ||--o{ workshop_holidays : "workshop_id"
    workshops ||--o{ workshop_photos : "workshop_id"
    workshops ||--o{ workshop_quotas : "workshop_id"
    users ||--o| workshops : "owner_id"
```

| Tabel | Isi |
|---|---|
| `workshops` | Satu bengkel per pemilik; lokasi PostGIS untuk radius 5 km. |
| `services` | Layanan dengan harga dan durasi (soft delete). |
| `mechanics` | Mekanik dengan rating dan tag keahlian. |
| `workshop_quotas` | Kapasitas per jam, dikunci FOR UPDATE saat booking. |
| `workshop_holidays` | Tanggal libur bengkel. *(baru, migrasi 004)* |
| `workshop_photos` | Galeri foto; satu foto sampul per bengkel. *(baru, migrasi 004)* |

## Pesanan & pembayaran

Satu pesanan (booking atau SOS) dengan detailnya, pembayaran QRIS, ulasan, dan riwayat status.

```mermaid
erDiagram
    orders {
        uuid id PK
        varchar order_number UK
        enum_order_type type
        enum_order_status status
        uuid customer_id FK
        uuid workshop_id FK
        uuid mechanic_id FK
        enum_vehicle_type vehicle_type
        varchar vehicle_plate
        text notes
        numeric total_amount
        timestamptz completed_at
        timestamptz cancelled_at
        timestamptz created_at
        timestamptz updated_at
        text cancel_reason
        varchar cancelled_by
        uuid vehicle_id FK
    }
    booking_details {
        uuid order_id PK,FK
        uuid service_id FK
        date booking_date
        time time_slot
        int queue_number
        boolean reminder_sent
        boolean reminder_2h_sent
    }
    emergency_details {
        uuid order_id PK,FK
        geography_point location
        text address_note
        text problem_description
        numeric distance_meters
        timestamptz response_deadline
        smallint routing_attempts
        uuid_array attempted_workshop_ids
        timestamptz responded_at
        numeric price_min
        numeric price_max
        varchar problem_category
    }
    transactions {
        uuid id PK
        uuid order_id FK,UK
        numeric amount
        enum_payment_status status
        text proof_path
        varchar proof_mime
        timestamptz uploaded_at
        uuid verified_by FK
        timestamptz verified_at
        text rejection_reason
        timestamptz created_at
        timestamptz updated_at
        timestamptz refunded_at
        uuid refunded_by FK
        text refund_note
        varchar invoice_number UK
        varchar payer_reference
        varchar payer_name
    }
    reviews {
        uuid id PK
        uuid order_id FK,UK
        uuid customer_id FK
        uuid workshop_id FK
        uuid mechanic_id FK
        smallint rating
        text comment
        timestamptz created_at
        text owner_reply
        timestamptz replied_at
    }
    order_status_history {
        bigint id PK
        uuid order_id FK
        varchar kind
        varchar from_status
        varchar to_status
        uuid actor_id FK
        varchar actor_role
        timestamptz created_at
    }
    mechanics {
        uuid id PK
    }
    services {
        uuid id PK
    }
    users {
        uuid id PK
    }
    vehicles {
        uuid id PK
    }
    workshops {
        uuid id PK
    }
    orders ||--o| booking_details : "order_id"
    services ||--o{ booking_details : "service_id"
    orders ||--o| emergency_details : "order_id"
    users |o--o{ order_status_history : "actor_id"
    orders ||--o{ order_status_history : "order_id"
    users ||--o{ orders : "customer_id"
    mechanics |o--o{ orders : "mechanic_id"
    vehicles |o--o{ orders : "vehicle_id"
    workshops |o--o{ orders : "workshop_id"
    users ||--o{ reviews : "customer_id"
    mechanics |o--o{ reviews : "mechanic_id"
    orders ||--o| reviews : "order_id"
    workshops ||--o{ reviews : "workshop_id"
    orders ||--o| transactions : "order_id"
    users |o--o{ transactions : "refunded_by"
    users |o--o{ transactions : "verified_by"
```

| Tabel | Isi |
|---|---|
| `orders` | Pesanan booking atau SOS. |
| `booking_details` | Tanggal, jam, dan nomor antrean booking. |
| `emergency_details` | Lokasi, keluhan, dan routing SOS. |
| `transactions` | Pembayaran QRIS satu pesanan: bukti, verifikasi, invoice, refund. |
| `reviews` | Satu ulasan per pesanan selesai, dengan balasan bengkel. |
| `order_status_history` | Diisi otomatis oleh trigger setiap status pesanan atau pembayaran berubah. *(baru, migrasi 004)* |

## Audit

Jejak tindakan penting yang tidak bisa diubah atau dihapus.

```mermaid
erDiagram
    audit_logs {
        bigint id PK
        uuid actor_id FK
        varchar actor_role
        varchar action
        varchar entity
        uuid entity_id
        jsonb details
        timestamptz created_at
    }
    users {
        uuid id PK
    }
    users |o--o{ audit_logs : "actor_id"
```

| Tabel | Isi |
|---|---|
| `audit_logs` | Append-only: trigger menolak UPDATE dan DELETE. *(baru, migrasi 004)* |

## Aturan hapus (ON DELETE)

| Tabel.kolom | Mengacu ke | Saat induk dihapus |
|---|---|---|
| `audit_logs.actor_id` | `users.id` | SET NULL |
| `booking_details.order_id` | `orders.id` | CASCADE |
| `booking_details.service_id` | `services.id` | RESTRICT |
| `emergency_details.order_id` | `orders.id` | CASCADE |
| `mechanics.workshop_id` | `workshops.id` | CASCADE |
| `notifications.user_id` | `users.id` | CASCADE |
| `order_status_history.actor_id` | `users.id` | SET NULL |
| `order_status_history.order_id` | `orders.id` | CASCADE |
| `orders.customer_id` | `users.id` | RESTRICT |
| `orders.mechanic_id` | `mechanics.id` | SET NULL |
| `orders.vehicle_id` | `vehicles.id` | SET NULL |
| `orders.workshop_id` | `workshops.id` | RESTRICT |
| `refresh_tokens.replaced_by` | `refresh_tokens.id` | SET NULL |
| `refresh_tokens.user_id` | `users.id` | CASCADE |
| `reviews.customer_id` | `users.id` | CASCADE |
| `reviews.mechanic_id` | `mechanics.id` | SET NULL |
| `reviews.order_id` | `orders.id` | CASCADE |
| `reviews.workshop_id` | `workshops.id` | CASCADE |
| `services.workshop_id` | `workshops.id` | CASCADE |
| `transactions.order_id` | `orders.id` | CASCADE |
| `transactions.refunded_by` | `users.id` | SET NULL |
| `transactions.verified_by` | `users.id` | SET NULL |
| `vehicles.user_id` | `users.id` | CASCADE |
| `workshop_holidays.workshop_id` | `workshops.id` | CASCADE |
| `workshop_photos.workshop_id` | `workshops.id` | CASCADE |
| `workshop_quotas.workshop_id` | `workshops.id` | CASCADE |
| `workshops.owner_id` | `users.id` | RESTRICT |
