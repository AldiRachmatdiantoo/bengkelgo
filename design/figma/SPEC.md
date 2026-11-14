# Spesifikasi desain BengkelGo (dari Figma)

Sumber: file Figma "Untitled" (`bJbvj8dZjZ9Ljm5YCbo7ov`), diambil 14 Nov 2026 lewat Figma Plugin API (nilai asli, bukan perkiraan).
Ukuran frame: 440 × 950/956 px (mobile). Di Figma tertulis "Bengkelku", tapi namanya tetap **BengkelGo**.

## Frame di file

| ID | Nama | Isi |
|---|---|---|
| 12:2 | Landing Page | Beranda versi **terang** (navy `#00288E`) |
| 33:2 | Landing Page darkk | Beranda versi **gelap** |
| 35:1004 | Group | Pilih bengkel |
| 35:1047 | Group | Detail booking |
| 35:1104 | Group | Pembayaran DP (QRIS) |
| 35:1475 | Group | Live tracking |
| 35:1525 | Group | Nota akhir |

Layar booking (35:xxxx) adalah SVG yang di-flatten, jadi radius diambil dari path vektor.

## Font

**Montserrat**, Regular 400 / Medium 500 / SemiBold 600 / Bold 700 / ExtraBold 800. Line-height `auto`, letter-spacing 0, kecuali di beranda (-0.5px).
(Inter muncul di 3 teks beranda, "Bengkel Terverifikasi" dan label kecil. Kemungkinan tidak disengaja; pakai Montserrat.)

| Peran | Ukuran / ketebalan |
|---|---|
| Judul halaman (H1) | 32 Bold |
| Judul bagian (H2) | 19 Bold |
| Nama brand di header | 19 Bold, aksen |
| Subjudul halaman | 15 Regular, muted |
| Judul kartu/opsi | 15–16 Bold |
| Isi/keterangan | 13–14 Regular, muted |
| Label kecil | 12 Regular/Bold |
| Tombol utama | 15–16 Bold |
| Total di bilah bawah | 20 Bold |
| Nominal besar | 24 / 27 Bold |
| Beranda: sapaan & judul seksi | 20 SemiBold |
| Beranda: MOTOR/MOBIL | 20 ExtraBold |

## Warna (tema gelap, layar booking)

| Token | Hex |
|---|---|
| bg | `#101310` |
| surface (kartu) | `#1C241D` |
| surface-bar (bilah bawah) | `#181E18` |
| surface-selected | `#263528` |
| surface-info | `#202D22` |
| surface-success | `#263C2B` / `#293E2A` |
| surface-estimate | `#253627` |
| tile ikon | `#304132` |
| avatar | `#3B553C` |
| border | `#364438` (1px) |
| accent | `#BAF48F` |
| on-accent | `#142014` |
| text | `#F5F8F3` |
| text-muted | `#BAC5BA` |
| warning bg / border / text | `#382B1B` / `#7D5B32` / `#FFD19B` |
| ilustrasi: latar / garis | `#263D33` / `#3E5847` |
| peta: latar / jalan / label | `#23352D` / `#42564A` / `#14201A` |
| QR: latar / modul | `#F7FAF6` / `#102019` |

Beranda gelap (33:2) memakai palet lain: bg `#101010`, kartu `#171717`, border `#4C8431`, brand `#94C583`, teks `#FFFFFF` / `#E0E0E0` / `#C3C3C3`, placeholder `#A1A1A1`. Ada juga warna yang gagal kontras: alamat `#444653` (2,0:1) dan deskripsi `#FFFFFF@51%`.

Beranda terang (12:2): bg `#F9F8FF`, primer navy `#00288E`, teks `#131B2E`, teks sekunder `#444653`, kartu `#FFFFFF`.

Lainnya: bintang `#FFCB5C`, pin lokasi `#A73A00`, badge notifikasi `#BA1A1A`.

## Radius

| Elemen | Radius |
|---|---|
| Tombol kembali 44×44, tile ikon 46×46 | 12 |
| Tombol utama 52 tinggi | 12 |
| Opsi (radio card) 64 tinggi | 12 |
| Kotak info, estimasi, peringatan, sisa pelunasan | 12 |
| Kartu kendaraan 72 tinggi | 13 |
| Kartu bengkel, kartu QRIS, rincian biaya, kotak QR | 14–16 |
| Chip tanggal/jam 44 tinggi, input keluhan, tombol sekunder | 10 |
| Beranda: kartu MOTOR/MOBIL, promo, daftar bengkel | 20 |
| Beranda: kotak cari 35 tinggi | 17.5 (pill) |

## Tata letak (layar booking)

- Gutter samping 22px (tombol kembali di 20px).
- Header: tombol kembali 44×44 di (20,20), brand di x=78.
- H1 di y=84, subjudul y=129, konten mulai y=172.
- Jarak antarkartu dalam grup 10–12px, jarak antar-bagian ±14–24px.
- Bilah bawah: y=842, tinggi 108, border atas 1px `#364438`. Tombol utama 52px tinggi di y=870; lebar 218 bila ada total di kiri, 396 bila sendirian.
- Radio: 18px, ring 3px; titik dalam 6px bila terpilih.
- Timeline status: titik 16px, garis 3px `#364438`.

## Aset

SVG di [`icons/`](icons/), warna lewat `currentColor` (kecuali `workshop-art.svg`):
`back`, `car-outline`, `search`, `bell`, `pin`, `star`, `motor`, `mobil`, `workshop-art`.
Foto bengkel di beranda adalah foto contoh dari Figma; di aplikasi pakai foto sampul bengkel yang asli.
