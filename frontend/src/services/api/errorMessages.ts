// Indonesian text for the API's error codes. The backend answers in English; users see these instead.
// Codes not listed here fall back to the backend message.

export const ERROR_MESSAGES: Record<string, string> = {
  // Auth & session
  INVALID_CREDENTIALS: 'Email atau password salah.',
  EMAIL_TAKEN: 'Email ini sudah terdaftar. Silakan masuk.',
  ACCOUNT_DISABLED: 'Akun ini dinonaktifkan. Hubungi admin BengkelGo.',
  UNAUTHORIZED: 'Sesi Anda berakhir. Silakan masuk lagi.',
  TOKEN_INVALID: 'Sesi Anda berakhir. Silakan masuk lagi.',
  TOKEN_EXPIRED: 'Sesi Anda berakhir. Silakan masuk lagi.',
  TOKEN_MISSING: 'Sesi Anda berakhir. Silakan masuk lagi.',
  TOKEN_REUSED: 'Demi keamanan, semua sesi akun ini telah dikeluarkan. Silakan masuk lagi.',
  FORBIDDEN: 'Anda tidak punya akses untuk tindakan ini.',
  GOOGLE_DISABLED: 'Login Google belum diaktifkan.',
  GOOGLE_AUTH_FAILED: 'Login Google gagal. Silakan coba lagi.',
  GOOGLE_EMAIL_UNVERIFIED: 'Email Google Anda belum terverifikasi.',
  RATE_LIMITED: 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.',
  GEOCODE_UNAVAILABLE: 'Pencarian lokasi sedang tidak tersedia. Tandai lokasi langsung di peta.',

  // Uploads
  INVALID_FILE_TYPE: 'File harus berupa foto JPG, PNG, atau WEBP. Video dan PDF tidak bisa diunggah.',
  FILE_TOO_LARGE: 'Ukuran foto melebihi 2 MB. Pilih foto yang lebih kecil.',
  FILE_REQUIRED: 'Pilih foto terlebih dahulu.',
  UPLOAD_ERROR: 'Unggahan gagal. Pastikan hanya satu foto yang dipilih.',
  PAYLOAD_TOO_LARGE: 'Data yang dikirim terlalu besar.',

  // Booking & slots
  WORKSHOP_CLOSED: 'Bengkel sedang tutup dan belum menerima booking.',
  DUPLICATE_BOOKING: 'Anda sudah punya booking di jam ini.',
  DAILY_WORKSHOP_LIMIT: 'Anda sudah punya booking di bengkel ini pada tanggal tersebut. Pilih tanggal lain atau ganti jadwal booking yang ada.',
  ACTIVE_BOOKING_LIMIT: 'Anda sudah mencapai batas booking yang belum selesai. Selesaikan atau batalkan salah satu booking dulu untuk booking lagi.',
  BOOKING_RATE_LIMITED: 'Anda sudah beberapa kali membuat booking dalam satu jam terakhir. Coba lagi nanti.',
  INVALID_DATE: 'Tanggal booking tidak valid.',
  DATE_IN_PAST: 'Tanggal booking sudah lewat.',
  DATE_TOO_FAR: 'Booking hanya bisa dibuat maksimal 30 hari ke depan.',
  SLOT_NOT_ON_HOUR: 'Jam booking harus tepat di awal jam (mis. 09:00).',
  OUTSIDE_OPERATING_HOURS: 'Jam tersebut di luar jam operasional bengkel.',
  SLOT_ALREADY_STARTED: 'Slot jam ini sudah dimulai. Pilih jam berikutnya.',
  CAPACITY_BELOW_BOOKED: 'Kapasitas tidak boleh lebih kecil dari jumlah booking yang sudah terkonfirmasi.',
  VEHICLE_TYPE_NOT_SUPPORTED: 'Bengkel tidak melayani jenis kendaraan ini. Ubah jenis kendaraan di profil bengkel.',

  // Emergency
  NO_WORKSHOP_NEARBY: 'Belum ada bengkel siaga dalam radius 5 km dari lokasi Anda.',
  ACTIVE_EMERGENCY_EXISTS: 'Anda masih punya permintaan darurat yang aktif.',
  NO_MECHANIC_AVAILABLE: 'Tidak ada teknisi yang tersedia. Tolak/alihkan panggilan ini atau aktifkan teknisi.',
  RESPONSE_WINDOW_EXPIRED: 'Batas waktu respons habis; permintaan sudah dialihkan ke bengkel lain.',

  // Orders, payments, reviews
  INVALID_TRANSITION: 'Status pesanan tidak bisa diubah ke tahap tersebut.',
  INVALID_ORDER_STATE: 'Pesanan ini sudah diproses sebelumnya. Muat ulang halaman.',
  FINAL_AMOUNT_REQUIRED: 'Isi total biaya akhir sebelum menandai selesai.',
  ORDER_ALREADY_PAID: 'Pesanan yang sudah lunas hanya bisa dibatalkan oleh bengkel. Hubungi bengkel untuk pengembalian dana.',
  PAYMENT_PENDING_VERIFICATION: 'Bukti bayar masih menunggu pemeriksaan. Verifikasi atau tolak bukti bayar dulu sebelum membatalkan (pelanggan: hubungi bengkel).',
  REFUND_CONFIRMATION_REQUIRED: 'Pesanan ini sudah lunas. Kembalikan dananya ke pelanggan lalu centang konfirmasi pengembalian dana untuk membatalkan.',
  ORDER_NOT_PAYABLE: 'Pesanan ini belum bisa dibayar.',
  AMOUNT_NOT_SET: 'Bengkel belum menetapkan biaya pesanan ini.',
  ALREADY_VERIFIED: 'Pembayaran ini sudah diverifikasi.',
  INVALID_PAYMENT_STATE: 'Tidak ada bukti bayar yang menunggu verifikasi. Muat ulang halaman.',
  PROOF_NOT_FOUND: 'Belum ada bukti pembayaran yang diunggah.',
  QRIS_NOT_AVAILABLE: 'Bengkel belum mengunggah QRIS.',
  REASON_REQUIRED: 'Alasan wajib diisi.',
  ORDER_NOT_COMPLETED: 'Ulasan hanya bisa diberikan setelah pesanan selesai.',
  ALREADY_REVIEWED: 'Pesanan ini sudah Anda ulas.',
  WORKSHOP_NOT_FOUND: 'Akun ini belum punya bengkel terdaftar.',

  // Generic
  NOT_FOUND: 'Data tidak ditemukan atau Anda tidak punya akses.',
  DUPLICATE: 'Data yang sama sudah ada.',
  INVALID_REFERENCE: 'Data yang dirujuk tidak ditemukan.',
  CONSTRAINT_VIOLATION: 'Permintaan melanggar aturan sistem. Periksa kembali isian Anda.',
  CONCURRENCY_CONFLICT: 'Ada perubahan bersamaan dari pengguna lain. Silakan coba lagi.',
  INVALID_INPUT: 'Format isian tidak valid.',
  INVALID_JSON: 'Format data tidak valid.',
  INTERNAL_ERROR: 'Terjadi gangguan di server. Coba lagi beberapa saat lagi.',
};

/** Field names in validation errors -> labels the user recognises. */
const FIELD_LABELS: Record<string, string> = {
  name: 'Nama',
  email: 'Email',
  phone: 'Nomor WhatsApp',
  whatsapp: 'Nomor WhatsApp',
  password: 'Password',
  address: 'Alamat',
  description: 'Deskripsi',
  price: 'Harga',
  duration_minutes: 'Durasi',
  vehicle_plate: 'Plat nomor',
  vehicle_type: 'Jenis kendaraan',
  problem_description: 'Keterangan kendala',
  address_note: 'Patokan lokasi',
  notes: 'Catatan',
  open_time: 'Jam buka',
  close_time: 'Jam tutup',
  max_slot_per_hour: 'Kapasitas per jam',
  latitude: 'Lokasi',
  longitude: 'Lokasi',
  specializations: 'Keahlian',
  rating: 'Rating',
  comment: 'Komentar',
  reason: 'Alasan',
  final_amount: 'Total biaya',
  estimated_price: 'Estimasi biaya',
  booking_date: 'Tanggal',
  time_slot: 'Jam',
};

/** Custom messages the API's validators use, in Indonesian. */
const ISSUE_MESSAGES: [RegExp, string][] = [
  [/valid Indonesian WhatsApp/i, 'tidak valid (contoh: 081234567890)'],
  [/license plate/i, 'tidak valid (contoh: B 1234 ABC)'],
  [/lowercase letter/i, 'harus mengandung huruf kecil'],
  [/uppercase letter/i, 'harus mengandung huruf besar'],
  [/contain a digit/i, 'harus mengandung angka'],
  [/HH:mm/i, 'gunakan format jam HH:mm'],
  [/YYYY-MM-DD/i, 'gunakan format tanggal YYYY-MM-DD'],
  [/must be HH:00/i, 'harus tepat di awal jam (HH:00)'],
  [/provided together/i, 'harus diisi berpasangan'],
  [/must be before close_time/i, 'harus lebih awal dari jam tutup'],
  [/email/i, 'format email tidak valid'],
  [/too small|>=|at least/i, 'terlalu pendek atau terlalu kecil'],
  [/too big|<=|at most/i, 'terlalu panjang atau terlalu besar'],
];

function issueText(path: string, message: string): string {
  const field = path.split('.').pop() ?? '';
  const label = FIELD_LABELS[field] ?? (field || 'Isian');
  const text = ISSUE_MESSAGES.find(([re]) => re.test(message))?.[1] ?? 'tidak valid';
  return `${label} ${text}`;
}

/** Indonesian message for an API error body, or null to use the backend's own message. */
export function translateApiError(code: string, issues?: { path: string; message: string }[]): string | null {
  if (code === 'VALIDATION_ERROR') {
    if (!issues?.length) return 'Periksa kembali isian Anda.';
    return [...new Set(issues.map((i) => issueText(i.path, i.message)))].join(' · ') + '.';
  }
  return ERROR_MESSAGES[code] ?? null;
}
