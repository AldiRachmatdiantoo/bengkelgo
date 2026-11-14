import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { apiAsset, statsApi, workshopApi } from '@/services/api/endpoints';
import { useAuth } from '@/services/auth/AuthProvider';
import type { Workshop } from '@/services/api/types';
import { StarRow } from '@/components/workshop/WorkshopComponents';
import { Icon, SectionHeading, Segmented, cx, SkeletonList } from '@/components/ui';
import { WorkshopArt } from '@/components/ui/screen';
import { ScrollRadar, type ScrollRadarSection } from '@/components/ui/landing-page';
import { Reveal, RevealGroup, RevealItem } from '@/components/ui/motion';

const ADVANTAGES = [
  { icon: 'hourglass_disabled', tone: 'bg-primary', title: 'Jadwal Anti-Bentrok', text: 'Setiap jam punya batas jumlah pelanggan. Begitu Anda konfirmasi, jam itu langsung jadi milik Anda dan tidak bisa diambil orang lain.', foot: 'Diuji 100 pemesan sekaligus, tidak ada yang bentrok', footIcon: 'check_circle', footTone: 'text-primary' },
  { icon: 'location_on', tone: 'bg-emergency', title: 'Pencarian Darurat 5 KM', text: 'Bengkel aktif terdekat dengan mekanik terbaik dihubungi lebih dulu. Jika tidak merespons dalam 2 menit, dialihkan otomatis.', foot: 'Pengalihan otomatis 2 menit', footIcon: 'bolt', footTone: 'text-emergency-ink' },
  { icon: 'qr_code_2', tone: 'bg-success', title: 'Pembayaran QRIS Bengkel', text: 'Bayar langsung ke QRIS milik bengkel, lalu unggah bukti. Bengkel memverifikasi dan status langsung terlihat di aplikasi.', foot: 'Transparan & tercatat', footIcon: 'check_circle', footTone: 'text-success' },
  { icon: 'shield', tone: 'bg-navy', title: 'Rating Mekanik Dinamis', text: 'Setiap ulasan pelanggan memperbarui rating mekanik. Rating ini ikut menentukan prioritas penugasan panggilan darurat.', foot: 'Berdasarkan ulasan asli', footIcon: 'verified', footTone: 'text-ink' },
];

const FAQ = [
  {
    q: 'Bagaimana cara memesan mekanik darurat saat kendaraan mogok di jalan?',
    a: 'Tekan tombol Bantuan Darurat, tentukan lokasi lewat GPS atau klik peta, lalu ceritakan kendalanya. Tanpa akun pun bisa: cukup isi nama dan nomor WhatsApp. Kami menghubungi bengkel aktif dalam radius 5 km; jika bengkel tidak merespons dalam 2 menit, permintaan dialihkan otomatis ke bengkel berikutnya.',
  },
  {
    q: 'Bagaimana jika jam yang saya pilih sudah penuh?',
    a: 'Setiap bengkel menentukan berapa pelanggan yang bisa dilayani per jam, jadi jadwal tidak akan bentrok. Jika jam pilihan Anda penuh, Anda masuk daftar tunggu dan otomatis terkonfirmasi begitu ada tempat kosong.',
  },
  {
    q: 'Bagaimana cara membayar servis?',
    a: 'Setelah pesanan dikonfirmasi dan harga ditetapkan, scan QRIS milik bengkel dari aplikasi m-banking atau e-wallet, lalu unggah foto atau screenshot bukti bayar. Bengkel memverifikasi bukti tersebut dan status pembayaran berubah menjadi Lunas.',
  },
  {
    q: 'Apakah pesanan bisa dibatalkan?',
    a: 'Bisa, dari halaman detail pesanan selama pesanan belum mulai dikerjakan dan pembayaran belum diverifikasi bengkel.',
  },
  {
    q: 'Apakah saya harus punya akun?',
    a: 'Booking servis terjadwal memerlukan akun pelanggan agar tiket dan riwayat tersimpan. Bantuan darurat bisa digunakan sebagai tamu.',
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { hash } = useLocation();
  const howRef = useRef<HTMLElement>(null);
  const { user } = useAuth();
  const [q, setQ] = useState('');
  // Verified list on the page, and real reviews for the testimonials section.
  const workshops = useQuery({ queryKey: ['workshops', {}], queryFn: () => workshopApi.list({}) });

  useEffect(() => {
    if (hash === '#cara-kerja') {
      // Let the page lay out first, otherwise the smooth scroll stops short.
      const t = setTimeout(() => howRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
      return () => clearTimeout(t);
    }
    // Old links (/#booking, /#cari, /#sos) now live on the search page.
    const legacy = hash === '#booking' ? 'booking' : hash === '#cari' ? 'cari' : hash === '#sos' ? 'sos' : null;
    if (legacy) navigate(`/workshops?tab=${legacy}`, { replace: true });
  }, [hash, navigate]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-14">
      {/* ------------------------------------------------ scroll radar hero */}
      <ScrollRadar sections={heroSections(user?.name.split(' ')[0])} />

      {/* ------------------------------------------------ verified workshops (Figma "Bengkel Terverifikasi") */}
      <section>
        <h2 className="text-2xl font-semibold text-ink">Bengkel terverifikasi</h2>
        <p className="mt-1 text-sm text-ink-2">Cek profil bengkel yang sudah diverifikasi admin.</p>
        <form
          role="search"
          className="mt-4 flex h-11 items-center gap-2 rounded-full border border-line-strong bg-card pr-1.5 pl-4 focus-within:border-primary"
          onSubmit={(e) => {
            e.preventDefault();
            navigate(`/workshops?tab=cari${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ''}`);
          }}
        >
          <Icon name="search" className="text-ink-2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari bengkel" aria-label="Cari bengkel" className="h-full min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-2/70 focus:outline-none" />
          <button type="submit" className="h-8 shrink-0 rounded-full bg-primary px-4 text-xs font-bold text-on-primary hover:bg-primary-dark">
            Cari
          </button>
        </form>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {workshops.isLoading ? (
            <SkeletonList rows={3} label="Memuat bengkel…" />
          ) : (
            (workshops.data ?? []).slice(0, 6).map((w) => <WorkshopRow key={w.id} workshop={w} />)
          )}
        </div>
        <Link to="/workshops?tab=cari" className="mt-4 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-primary hover:underline">
          Lihat semua bengkel <Icon name="arrow_forward" className="text-[18px]" />
        </Link>
      </section>

      <PlatformNumbers />

      {/* ------------------------------------------------ how it works */}
      <HowItWorks sectionRef={howRef} />

      {/* ------------------------------------------------ advantages */}
      <section className="bg-sky py-16 shadow-[0_0_0_100vmax_var(--color-sky)] [clip-path:inset(0_-100vmax)]" data-testid="advantages">
        <div>
          <Reveal>
            <SectionHeading eyebrow="Kenapa BengkelGo berbeda?" title="Teknologi Andal, Servis Transparan Tanpa Tipu-tipu" subtitle="Dirancang untuk melindungi waktu dan uang pemilik kendaraan." />
          </Reveal>
          <RevealGroup className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {ADVANTAGES.map((a) => (
              <RevealItem key={a.title} className="flex flex-col gap-4 rounded-2xl bg-card p-6 shadow-sm transition-shadow hover:shadow-lift">
                <span className={cx('grid h-[46px] w-[46px] place-items-center rounded-lg', a.tone === 'bg-emergency' ? 'bg-emergency-soft text-emergency-ink' : 'bg-surface-high text-primary')}>
                  <Icon name={a.icon} className="text-[24px]" />
                </span>
                <h3 className="text-headline-sm font-bold text-ink">{a.title}</h3>
                <p className="flex-1 text-sm leading-relaxed text-ink-2">{a.text}</p>
                <p className={cx('flex items-center gap-1.5 font-label text-label-sm', a.footTone)}>
                  {a.foot} <Icon name={a.footIcon} className="text-[16px]" />
                </p>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* ------------------------------------------------ real reviews */}
      <ReviewsSection workshops={workshops.data ?? []} />

      {/* ------------------------------------------------ FAQ */}
      <Reveal as="section">
        <SectionHeading eyebrow="Pusat informasi & panduan" title="Pertanyaan yang Sering Diajukan (FAQ)" subtitle="Cara kerja bantuan darurat, antrean, dan pembayaran." />
        <div className="flex max-w-3xl flex-col gap-3">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-xl bg-surface-low px-5 py-4 open:bg-card open:shadow-sm open:ring-1 open:ring-line">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold text-ink [&::-webkit-details-marker]:hidden">
                {f.q}
                <Icon name="expand_more" className="text-primary transition group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink-2">{f.a}</p>
            </details>
          ))}
        </div>
      </Reveal>
    </div>
  );
}

/** The four stops of the landing radar; every claim here is something the app really does. */
function heroSections(firstName?: string): ScrollRadarSection[] {
  return [
    {
      id: 'mulai',
      badge: 'Beranda',
      title: `Halo${firstName ? `, ${firstName}` : ''}!`,
      subtitle: 'Mau servis apa hari ini?',
      description: 'Booking jam servis di bengkel terverifikasi tanpa antre lama, atau minta bantuan saat kendaraan mogok di jalan.',
      actions: [
        { label: 'Servis motor', to: '/workshops?tab=booking&vehicle=MOTOR', variant: 'primary', icon: 'two_wheeler', testId: 'hero-booking' },
        { label: 'Servis mobil', to: '/workshops?tab=booking&vehicle=MOBIL', variant: 'secondary', icon: 'directions_car' },
      ],
    },
    {
      id: 'bengkel',
      badge: 'Bengkel terverifikasi',
      title: 'Bengkel di sekitar Anda',
      description: 'Setiap bengkel diperiksa admin sebelum tampil. Bandingkan rating, jam buka, dan sisa tempat di tiap jam sebelum berangkat.',
      align: 'right',
      actions: [{ label: 'Cari bengkel', to: '/workshops?tab=cari', variant: 'secondary', icon: 'search' }],
    },
    {
      id: 'darurat',
      badge: 'Bantuan darurat',
      title: 'Mogok di jalan?',
      subtitle: 'Bengkel dalam radius 5 km dihubungi otomatis',
      description: 'Tentukan lokasi lewat GPS, pilih masalahnya, lalu kirim.',
      features: [
        { icon: 'person_off', title: 'Tanpa akun pun bisa', description: 'Cukup isi nama dan nomor WhatsApp.' },
        { icon: 'timer', title: 'Dialihkan otomatis', description: 'Bengkel punya 2 menit untuk merespons, kalau tidak permintaan pindah ke bengkel berikutnya.' },
        { icon: 'qr_code_2', title: 'Bayar lewat QRIS bengkel', description: 'Setelah selesai, scan QRIS dan unggah bukti bayar.' },
      ],
      actions: [{ label: 'Kirim SOS', to: '/emergency', variant: 'danger', icon: 'e911_emergency' }],
    },
    {
      id: 'mitra',
      badge: 'Untuk pemilik bengkel',
      title: 'Punya bengkel?',
      subtitle: 'Kelola antrean lebih rapi',
      description: 'Atur kapasitas per jam, mekanik, panggilan darurat dalam radius 5 km, dan verifikasi pembayaran QRIS dari satu dashboard.',
      align: 'center',
      actions: [
        { label: 'Daftarkan bengkel', to: '/register/workshop', variant: 'primary', icon: 'app_registration' },
        { label: 'Masuk portal mitra', to: '/login', variant: 'secondary', icon: 'login' },
      ],
    },
  ];
}

/** Verified workshop row (Figma list): photo on the left, name, one-line description, rating. */
function WorkshopRow({ workshop: w }: { workshop: Workshop }) {
  return (
    <Link to={`/workshops/${w.id}`} className="flex min-h-[72px] items-stretch overflow-hidden rounded-[20px] border border-line bg-card transition hover:border-primary/60">
      <span className="relative w-28 shrink-0 overflow-hidden bg-art sm:w-32">
        {w.cover_photo_url ? (
          <img src={apiAsset(`${w.cover_photo_url}?size=sm`)!} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <WorkshopArt className="absolute inset-0 h-full w-full" />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col justify-center px-3.5 py-2.5">
        <span className="truncate text-subtitle font-bold text-ink">{w.name}</span>
        <span className="truncate text-xs text-ink-2">{w.description || w.address}</span>
        <span className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-ink">
          <Icon name="star" filled className="text-[14px] text-star" />
          {w.avg_rating > 0 ? `${w.avg_rating.toFixed(1)}/5` : 'Belum ada ulasan'}
        </span>
      </span>
    </Link>
  );
}

type Guide = 'booking' | 'sos' | 'mitra';
type Step = { icon: string; title: string; text: string; note: string };

const GUIDES: Record<Guide, { label: string; icon: string; tone: string; intro: string; steps: Step[]; cta: { label: string; to: string; icon: string } }> = {
  booking: {
    label: 'Booking Servis Terjadwal',
    icon: 'calendar_month',
    tone: 'bg-primary text-on-primary',
    intro: 'Untuk servis rutin tanpa antre lama. Pilih jam kedatangan, datang sesuai jadwal.',
    steps: [
      { icon: 'storefront', title: 'Cari bengkel', text: 'Cari nama bengkel atau tekan “Deteksi lokasi GPS” untuk melihat bengkel terdekat. Bandingkan rating, jam buka, dan jenis kendaraan yang dilayani.', note: 'Halaman Cari & Booking Bengkel' },
      { icon: 'event_available', title: 'Pilih paket & jadwal', text: 'Pilih paket servis, tanggal, lalu jam kedatangan. Sisa tempat tampil di setiap jam; jika penuh, Anda masuk daftar tunggu otomatis.', note: 'Halaman detail bengkel' },
      { icon: 'qr_code_2', title: 'Konfirmasi & bayar QRIS', text: 'Masuk atau daftar akun, tekan konfirmasi untuk mendapat nomor antrean. Lalu scan QRIS bengkel dan unggah bukti bayar.', note: 'Langkah 3–4 booking' },
      { icon: 'confirmation_number', title: 'Datang & servis', text: 'Tunjukkan Digital Pass (QR / nomor pesanan) ke petugas bengkel. Setelah selesai, beri ulasan untuk mekanik.', note: 'Menu “Pesanan saya”' },
    ],
    cta: { label: 'Mulai Booking Sekarang', to: '/workshops?tab=booking', icon: 'calendar_month' },
  },
  sos: {
    label: 'Bantuan Darurat SOS',
    icon: 'e911_emergency',
    tone: 'bg-emergency text-white',
    intro: 'Untuk kendaraan yang mogok di jalan. Bisa dipakai tanpa akun.',
    steps: [
      { icon: 'e911_emergency', title: 'Tekan SOS', text: 'Tekan tombol bulat oranye “SOS” di kanan bawah layar. Belum punya akun? Cukup isi nama dan nomor WhatsApp, Anda masuk sebagai tamu.', note: 'Tombol SOS di kanan bawah' },
      { icon: 'my_location', title: 'Tentukan lokasi & kendala', text: 'Gunakan GPS atau klik titik di peta, lalu pilih masalahnya: aki, ban, mesin mogok, atau kehabisan bensin.', note: 'Halaman Bantuan Darurat' },
      { icon: 'radar', title: 'Bengkel terdekat dihubungi', text: 'Kami mencari bengkel aktif dalam radius 5 km. Bengkel punya 2 menit untuk merespons; jika tidak, otomatis dialihkan ke bengkel berikutnya.', note: 'Otomatis, tanpa perlu menelepon' },
      { icon: 'engineering', title: 'Mekanik datang', text: 'Pantau status secara langsung, hubungi mekanik lewat telepon atau WhatsApp. Setelah selesai, bayar via QRIS dan beri ulasan.', note: 'Halaman tracking SOS' },
    ],
    cta: { label: 'Minta Bantuan Darurat', to: '/emergency', icon: 'e911_emergency' },
  },
  mitra: {
    label: 'Untuk Pemilik Bengkel',
    icon: 'handshake',
    tone: 'bg-navy text-white',
    intro: 'Untuk UMKM bengkel yang ingin antrean lebih rapi dan dijangkau pelanggan baru.',
    steps: [
      { icon: 'app_registration', title: 'Daftarkan bengkel', text: 'Isi data pemilik dan bengkel, jam buka, kapasitas booking per jam, lalu tandai lokasi bengkel di peta.', note: 'Menu “Gabung Mitra”' },
      { icon: 'verified', title: 'Diverifikasi admin', text: 'Admin memeriksa data bengkel. Setelah disetujui, bengkel tampil di pencarian dan bisa menerima panggilan darurat.', note: 'Status tampil di portal mitra' },
      { icon: 'tune', title: 'Atur layanan & tim', text: 'Tambahkan layanan dan harga, daftarkan mekanik beserta keahliannya, atur kapasitas per jam, dan unggah QRIS bengkel.', note: 'Tab Pengaturan & Kelola Mekanik' },
      { icon: 'space_dashboard', title: 'Terima pesanan & SOS', text: 'Pantau antrean hari ini, terima panggilan darurat dalam 2 menit, kerjakan pesanan, dan verifikasi bukti bayar pelanggan.', note: 'Dashboard Portal Mitra' },
    ],
    cta: { label: 'Daftarkan Bengkel', to: '/register/workshop', icon: 'app_registration' },
  },
};

/** Step-by-step guide for first-time visitors (not in the Stitch mockup; requested by the team). */
function HowItWorks({ sectionRef }: { sectionRef: React.RefObject<HTMLElement | null> }) {
  const [guide, setGuide] = useState<Guide>('booking');
  const g = GUIDES[guide];
  return (
    <section ref={sectionRef} id="cara-kerja" className="scroll-mt-24">
      <SectionHeading eyebrow="Cara kerja" title="Cara Menggunakan BengkelGo" subtitle="Pilih kebutuhan Anda, lalu ikuti 4 langkah sederhana berikut." />
      <div className="mb-4 flex">
        <div className="no-scrollbar max-w-full overflow-x-auto">
          <Segmented
            nowrap
            label="Panduan"
            value={guide}
            onChange={setGuide}
            options={(Object.keys(GUIDES) as Guide[]).map((k) => ({ value: k, label: GUIDES[k].label, icon: GUIDES[k].icon }))}
          />
        </div>
      </div>
      <p className="mb-8 max-w-2xl text-subtitle text-ink-2">{g.intro}</p>
      <div className="relative">
        {/* connector behind the step numbers (desktop); outside the <ol> so the list only holds <li> */}
        <span className="absolute top-7 right-[12.5%] left-[12.5%] hidden border-t-2 border-dashed border-line-strong lg:block" aria-hidden />
        {/* keyed by guide: switching tabs remounts the list so the new steps animate in (a once-only reveal would leave them hidden) */}
        <RevealGroup key={guide} as="ol" className="relative grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {g.steps.map((s, i) => (
            <RevealItem as="li" key={s.title} className="relative flex flex-col items-center text-center">
              <span className={cx('relative z-10 grid h-14 w-14 place-items-center rounded-full ring-8 ring-canvas', g.tone)}>
                <Icon name={s.icon} className="text-[20px]" />
                <span className="absolute -top-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-card font-label text-xs font-bold text-ink shadow-sm">{i + 1}</span>
              </span>
              <div className="mt-4 flex w-full flex-1 flex-col rounded-xl border border-line bg-card p-5 shadow-sm">
                <p className="font-label text-[11px] font-bold tracking-[0.04em] text-ink-3 uppercase">Langkah {i + 1}</p>
                <h3 className="mt-1 text-headline-sm text-ink">{s.title}</h3>
                <p className="mt-2 flex-1 text-sm text-ink-2">{s.text}</p>
                <p className="mt-4 inline-flex items-center justify-center gap-1 self-center rounded-full bg-surface-low px-3 py-1 font-label text-[11px] font-semibold text-ink-2">
                  <Icon name="touch_app" className="text-[14px] text-primary" /> {s.note}
                </p>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
      <div className="mt-8 flex">
        <Link
          to={g.cta.to}
          className={cx('inline-flex h-12 items-center gap-2 rounded-lg px-6 text-sm font-bold transition hover:brightness-110', g.tone)}
        >
          <Icon name={g.cta.icon} /> {g.cta.label}
        </Link>
      </div>
    </section>
  );
}

/** Testimonials from real customer reviews of the best-rated workshops (nothing invented). */
function ReviewsSection({ workshops }: { workshops: Workshop[] }) {
  const rated = [...workshops].filter((w) => w.total_reviews > 0).sort((a, b) => b.avg_rating - a.avg_rating).slice(0, 3);
  const results = useQueries({ queries: rated.map((w) => ({ queryKey: ['reviews', w.id, 'featured'], queryFn: () => workshopApi.reviews(w.id, { limit: 5 }) })) });
  const reviews = results
    .flatMap((r, i) => (r.data ?? []).map((rv) => ({ ...rv, workshop: rated[i].name })))
    .filter((r) => r.rating >= 4 && r.comment)
    .slice(0, 3);
  if (reviews.length === 0) return null;
  const total = rated.reduce((s, w) => s + w.total_reviews, 0);
  const avg = rated.reduce((s, w) => s + w.avg_rating * w.total_reviews, 0) / Math.max(1, total);
  return (
    <section data-testid="real-reviews">
      <SectionHeading
        eyebrow="Cerita pengendara"
        title="Ulasan Asli dari Pelanggan BengkelGo"
        action={
          <span className="flex items-center gap-2">
            <StarRow rating={Math.round(avg)} className="[&_span]:text-[20px]" />
            <span className="text-headline-sm text-ink">{avg.toFixed(1)} / 5.0</span>
          </span>
        }
      />
      <div className="grid gap-5 md:grid-cols-3">
        {reviews.map((r) => (
          <figure key={r.id} className="flex flex-col gap-4 rounded-xl border border-line bg-card p-6 shadow-sm">
            <StarRow rating={r.rating} />
            <blockquote className="flex-1 text-sm leading-relaxed text-ink italic">“{r.comment}”</blockquote>
            <figcaption className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-sky font-label text-sm font-bold text-primary">
                {r.customer_name
                  .split(' ')
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </span>
              <span>
                <span className="block text-sm font-bold text-ink">{r.customer_name}</span>
                <span className="block font-label text-xs text-ink-3">{r.workshop}</span>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/** Real counts from the API (GET /stats/public); hidden until there is something to show. */
function PlatformNumbers() {
  const { data: s } = useQuery({ queryKey: ['public-stats'], queryFn: statsApi.public, staleTime: 5 * 60_000 });
  if (!s || s.active_workshops === 0) return null;
  const items = [
    { value: s.active_workshops.toLocaleString('id-ID'), label: 'bengkel mitra aktif' },
    { value: s.active_mechanics.toLocaleString('id-ID'), label: 'mekanik siaga' },
    { value: s.completed_orders.toLocaleString('id-ID'), label: 'servis & bantuan selesai' },
    s.avg_platform_rating ? { value: `${Number(s.avg_platform_rating).toFixed(1)}/5`, label: `rating dari ${s.total_reviews.toLocaleString('id-ID')} ulasan` } : null,
    s.avg_emergency_response_minutes != null ? { value: `${Number(s.avg_emergency_response_minutes).toLocaleString('id-ID')} mnt`, label: 'rata-rata bengkel merespons SOS' } : null,
  ].filter((x): x is { value: string; label: string } => !!x);
  return (
    <section aria-label="BengkelGo dalam angka" className="grid grid-cols-2 gap-4 rounded-xl border border-line bg-card p-5 shadow-sm sm:grid-cols-3 lg:grid-cols-5" data-testid="platform-numbers">
      {items.map((i) => (
        <div key={i.label}>
          <p className="text-headline-md font-extrabold text-ink tabular-nums">{i.value}</p>
          <p className="font-label text-xs text-ink-2">{i.label}</p>
        </div>
      ))}
    </section>
  );
}
