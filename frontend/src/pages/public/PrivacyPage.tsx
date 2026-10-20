import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** Optional public contact address for privacy requests (set VITE_CONTACT_EMAIL in Vercel). */
const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL as string | undefined;

/**
 * Privacy policy (draft, 20 Oct 2026). Lists only what the app actually stores and who processes it;
 * the team still has to review the wording (backlog: content item 10). Google requires a public
 * privacy policy URL to publish the OAuth app used for Gmail and Google sign-in.
 */
export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl py-6 sm:py-10">
      <p className="font-label text-label-sm text-primary uppercase">Kebijakan</p>
      <h1 className="mt-2 text-headline-lg text-balance text-navy">Kebijakan Privasi BengkelGo</h1>
      <p className="mt-3 text-sm text-ink-3">Berlaku sejak 20 Oktober 2026 · Versi draf, akan disempurnakan</p>

      <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-ink-2">
        <p>
          BengkelGo menghubungkan pengendara dengan bengkel UMKM untuk booking servis dan bantuan darurat di jalan. Halaman ini menjelaskan data apa yang kami
          simpan, untuk apa, dengan siapa dibagikan, dan hak Anda atas data tersebut sesuai Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi.
        </p>

        <Section title="1. Data yang kami kumpulkan">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <b>Akun:</b> nama, email, nomor telepon, dan password. Password disimpan dalam bentuk hash (tidak bisa dibaca, termasuk oleh kami). Bila masuk dengan
              Google, kami menerima nama, email, dan ID akun Google Anda.
            </li>
            <li>
              <b>Lokasi:</b> titik GPS saat Anda mengirim permintaan darurat (SOS) atau mencari bengkel terdekat, dan lokasi terakhir yang Anda gunakan.
            </li>
            <li>
              <b>Kendaraan dan pesanan:</b> jenis dan pelat kendaraan, layanan yang dipesan, jadwal booking, catatan, riwayat status pesanan, dan ulasan.
            </li>
            <li>
              <b>Pembayaran:</b> foto bukti transfer/QRIS yang Anda unggah, nomor referensi, dan nama pengirim. Kami tidak menyimpan nomor kartu atau rekening.
            </li>
            <li>
              <b>Data mitra bengkel:</b> nama dan alamat bengkel, lokasi, jam buka, layanan dan harga, foto bengkel, foto mekanik, dan gambar QRIS.
            </li>
            <li>
              <b>Data teknis:</b> alamat IP dan waktu akses, untuk membatasi percobaan login berulang, mencegah penyalahgunaan, dan catatan audit tindakan admin.
            </li>
          </ul>
        </Section>

        <Section title="2. Untuk apa data digunakan">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Menjalankan layanan: membuat booking, menghubungkan permintaan darurat ke bengkel terdekat, dan memproses verifikasi pembayaran.</li>
            <li>Mengirim notifikasi di aplikasi dan email: konfirmasi booking, perubahan jadwal, dan pengingat servis.</li>
            <li>Menjaga keamanan akun dan platform, serta menyelesaikan keluhan atau sengketa pesanan.</li>
          </ul>
          <p className="mt-3">Kami tidak menjual data pribadi dan tidak memakainya untuk iklan.</p>
        </Section>

        <Section title="3. Dengan siapa data dibagikan">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <b>Bengkel yang Anda pesan:</b> nama, nomor telepon, data kendaraan, detail pesanan, bukti pembayaran, dan (untuk darurat) lokasi Anda, agar bengkel bisa
              melayani.
            </li>
            <li>
              <b>Penyedia layanan teknis</b> yang memproses data atas nama kami: Supabase (database dan penyimpanan file, Singapura), Render (server aplikasi,
              Singapura), Vercel (situs web), dan Google (pengiriman email dan masuk dengan Google).
            </li>
            <li>Pihak berwenang, bila diwajibkan oleh hukum.</li>
          </ul>
        </Section>

        <Section title="4. Keamanan dan penyimpanan">
          <p>
            Semua koneksi memakai HTTPS. File seperti bukti pembayaran dan QRIS disimpan secara privat dan hanya bisa dibuka oleh pihak yang berhak. Data disimpan selama
            akun Anda aktif dan selama diperlukan untuk riwayat transaksi; setelah itu dihapus atau dianonimkan.
          </p>
        </Section>

        <Section title="5. Cookie">
          <p>
            Kami hanya memakai cookie yang diperlukan agar Anda tetap masuk (cookie sesi login yang tidak bisa dibaca oleh skrip). Kami tidak memakai cookie iklan atau
            pelacak pihak ketiga.
          </p>
        </Section>

        <Section title="6. Hak Anda">
          <p>
            Anda berhak meminta salinan data, memperbaiki data yang salah, meminta penghapusan akun beserta datanya, dan menarik persetujuan. Sebagian data dapat Anda ubah
            sendiri di aplikasi; untuk permintaan lain, hubungi kami.
          </p>
        </Section>

        <Section title="7. Perubahan kebijakan">
          <p>Bila kebijakan ini berubah, versi terbaru dan tanggal berlakunya akan ditampilkan di halaman ini.</p>
        </Section>

        <Section title="8. Kontak">
          <p>
            Pertanyaan atau permintaan terkait data pribadi:{' '}
            {CONTACT_EMAIL ? (
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-primary hover:underline">
                {CONTACT_EMAIL}
              </a>
            ) : (
              'alamat kontak resmi akan segera dicantumkan di sini.'
            )}
          </p>
        </Section>

        <p className="border-t border-line pt-6">
          <Link to="/" className="font-semibold text-primary hover:underline">
            ← Kembali ke Beranda
          </Link>
        </p>
      </div>
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-headline-sm text-navy">{title}</h2>
      {children}
    </section>
  );
}
