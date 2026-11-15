import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { apiAsset, statsApi, workshopApi } from '@/services/api/endpoints';
import { useAuth } from '@/services/auth/AuthProvider';
import { WelcomePrompts } from '@/components/layout/WelcomePrompts';
import type { Workshop } from '@/services/api/types';
import { IllustrationTag, StarRow } from '@/components/workshop/WorkshopComponents';
import { Icon, Segmented, cx, SkeletonList } from '@/components/ui';
import { WorkshopArt } from '@/components/ui/screen';
import { ScrollRadar, type ScrollRadarSection } from '@/components/ui/landing-page';
import { Reveal, RevealGroup, RevealItem } from '@/components/ui/motion';

const ADVANTAGES = [
  { icon: 'hourglass_disabled', tone: 'bg-primary', title: 'Jadwal tidak bentrok', text: 'Setiap jam punya batas jumlah pelanggan. Begitu Anda konfirmasi, jam itu langsung jadi milik Anda dan tidak bisa diambil orang lain.', foot: 'Diuji 100 pemesan sekaligus, tidak ada yang bentrok', footIcon: 'check_circle', footTone: 'text-primary' },
  { icon: 'location_on', tone: 'bg-emergency', title: 'Bantuan darurat 5 km', text: 'Bengkel aktif terdekat yang punya mekanik siaga dihubungi lebih dulu. Jika tidak merespons dalam 2 menit, dialihkan otomatis.', foot: 'Pengalihan otomatis 2 menit', footIcon: 'bolt', footTone: 'text-emergency-ink' },
  { icon: 'qr_code_2', tone: 'bg-success', title: 'Bayar ke QRIS bengkel', text: 'Bayar langsung ke QRIS milik bengkel, lalu unggah bukti. Bengkel memverifikasi dan status langsung terlihat di aplikasi.', foot: 'Setiap bukti bayar tercatat', footIcon: 'check_circle', footTone: 'text-success' },
  { icon: 'shield', tone: 'bg-navy', title: 'Rating mekanik dari ulasan', text: 'Setiap ulasan pelanggan memperbarui rating mekanik. Rating ini ikut menentukan prioritas penugasan panggilan darurat.', foot: 'Berdasarkan ulasan asli', footIcon: 'verified', footTone: 'text-ink' },
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
    <div className="mx-auto flex w-full max-w-5xl flex-col">
      {/* ------------------------------------------------ scroll radar hero */}
      <WelcomePrompts />
      <ScrollRadar sections={heroSections(user?.name.split(' ')[0])} />

      {/* Everything below follows the radar sections: lime badge, big left-aligned heading, muted body,
          translucent bordered cards on the canvas. No coloured bands or shadows. */}
      <div className="flex flex-col gap-20 pb-6 sm:gap-28">
        {/* ---------------------------------------------- verified workshops */}
        <section>
          <LandingHeading
            badge="Bengkel terverifikasi"
            title="Pilih dari bengkel yang sudah diperiksa"
            description="Data dan lokasi setiap bengkel dicek admin sebelum tampil di pencarian."
            action={
              <Link to="/workshops?tab=cari" className={cx(LANDING_BUTTON, 'border border-line bg-card text-ink hover:border-primary/60 [&_.material-symbols-outlined]:text-primary')}>
                Lihat semua <Icon name="arrow_forward" className="text-[18px]" />
              </Link>
            }
          />
          <form
            role="search"
            className="flex h-12 max-w-xl items-center gap-2 rounded-full border border-line bg-card/80 pr-1.5 pl-4 backdrop-blur-sm focus-within:border-primary"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(`/workshops?tab=cari${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ''}`);
            }}
          >
            <Icon name="search" className="text-ink-2" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama bengkel" aria-label="Cari bengkel" className="h-full min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-2/70 focus:outline-none" />
            <button type="submit" className="h-9 shrink-0 rounded-full bg-primary px-5 text-sm font-bold text-on-primary hover:bg-primary-dark">
              Cari
            </button>
          </form>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {workshops.isLoading ? (
              <SkeletonList rows={3} label="Memuat bengkel…" />
            ) : (
              (workshops.data ?? []).slice(0, 6).map((w) => <WorkshopRow key={w.id} workshop={w} />)
            )}
          </div>
          <PlatformNumbers />
        </section>

        {/* ---------------------------------------------- how it works */}
        <HowItWorks sectionRef={howRef} />

        {/* ---------------------------------------------- advantages */}
        <section data-testid="advantages">
          <LandingHeading badge="Kenapa BengkelGo" title="Aturan yang berlaku di semua bengkel mitra" description="Empat aturan yang dijalankan sistem di setiap pesanan." />
          <RevealGroup className="grid gap-3 sm:grid-cols-2">
            {ADVANTAGES.map((a) => (
              <RevealItem key={a.title} className={cx(LANDING_CARD, 'flex items-start gap-4')}>
                <span className={cx('grid h-[46px] w-[46px] shrink-0 place-items-center rounded-lg', a.tone === 'bg-emergency' ? 'bg-emergency-soft text-emergency-ink' : 'bg-surface-high text-primary')}>
                  <Icon name={a.icon} />
                </span>
                <span className="min-w-0">
                  <h3 className="text-subtitle font-bold text-ink">{a.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-2">{a.text}</p>
                  <p className={cx('mt-3 flex items-center gap-1.5 text-xs font-bold', a.footTone)}>
                    <Icon name={a.footIcon} className="text-[16px]" /> {a.foot}
                  </p>
                </span>
              </RevealItem>
            ))}
          </RevealGroup>
        </section>

        {/* ---------------------------------------------- real reviews */}
        <ReviewsSection workshops={workshops.data ?? []} />

        {/* ---------------------------------------------- FAQ */}
        <Reveal as="section">
          <LandingHeading badge="FAQ" title="Pertanyaan yang sering diajukan" description="Cara kerja bantuan darurat, antrean, dan pembayaran." />
          <div className="flex max-w-3xl flex-col gap-3">
            {FAQ.map((f) => (
              <details key={f.q} className="group rounded-2xl border border-line bg-card/80 px-5 py-4 backdrop-blur-sm open:border-primary/40">
                <summary className="flex min-h-7 cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-ink sm:text-subtitle [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <Icon name="expand_more" className="shrink-0 text-primary transition group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-ink-2">{f.a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </div>
  );
}

/** Same button and card shapes as the radar sections above (components/ui/landing-page.tsx). */
const LANDING_BUTTON = 'inline-flex h-12 items-center justify-center gap-2 rounded-lg px-6 text-sm font-bold transition';
const LANDING_CARD = 'rounded-2xl border border-line bg-card/80 p-5 backdrop-blur-sm';

/** Section heading in the radar sections' voice: lime badge, large heading, muted line, optional action on the right. */
function LandingHeading({ badge, title, description, action }: { badge: string; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
      <div className="max-w-2xl">
        <p className="text-sm font-bold text-primary">{badge}</p>
        <h2 className="mt-2 text-2xl leading-tight font-bold tracking-tight text-ink sm:text-[34px]">{title}</h2>
        {description && <p className="mt-3 text-sm leading-relaxed text-ink-2 sm:text-subtitle">{description}</p>}
      </div>
      {action}
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
    <Link to={`/workshops/${w.id}`} className="flex min-h-[76px] items-stretch overflow-hidden rounded-2xl border border-line bg-card/80 backdrop-blur-sm transition hover:border-primary/60">
      <span className="relative w-28 shrink-0 overflow-hidden bg-art sm:w-32">
        {w.cover_photo_url ? (
          <>
            <img src={apiAsset(`${w.cover_photo_url}?size=sm`)!} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
            {w.cover_is_illustration && <IllustrationTag />}
          </>
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
    label: 'Booking servis',
    icon: 'calendar_month',
    tone: 'bg-primary text-on-primary',
    intro: 'Untuk servis rutin tanpa antre lama. Pilih jam kedatangan, datang sesuai jadwal.',
    steps: [
      { icon: 'storefront', title: 'Cari bengkel', text: 'Cari nama bengkel atau tekan “Pakai GPS saya” untuk melihat bengkel terdekat. Bandingkan rating, jam buka, dan jenis kendaraan yang dilayani.', note: 'Halaman Pilih bengkel' },
      { icon: 'event_available', title: 'Pilih paket & jadwal', text: 'Pilih paket servis, tanggal, lalu jam kedatangan. Sisa tempat tampil di setiap jam; jika penuh, Anda masuk daftar tunggu otomatis.', note: 'Halaman detail bengkel' },
      { icon: 'qr_code_2', title: 'Konfirmasi & bayar QRIS', text: 'Masuk atau daftar akun, tekan konfirmasi untuk mendapat nomor antrean. Lalu scan QRIS bengkel dan unggah bukti bayar.', note: 'Halaman Pembayaran' },
      { icon: 'confirmation_number', title: 'Datang & servis', text: 'Tunjukkan kode QR atau nomor pesanan ke petugas bengkel. Setelah selesai, beri ulasan untuk mekanik.', note: 'Menu “Pesanan saya”' },
    ],
    cta: { label: 'Mulai booking', to: '/workshops?tab=booking', icon: 'calendar_month' },
  },
  sos: {
    label: 'Bantuan darurat',
    icon: 'e911_emergency',
    tone: 'bg-emergency text-white',
    intro: 'Untuk kendaraan yang mogok di jalan. Bisa dipakai tanpa akun.',
    steps: [
      { icon: 'e911_emergency', title: 'Tekan SOS', text: 'Tekan tombol bulat oranye “SOS” di kanan bawah layar. Belum punya akun? Cukup isi nama dan nomor WhatsApp, Anda masuk sebagai tamu.', note: 'Tombol SOS di kanan bawah' },
      { icon: 'my_location', title: 'Tentukan lokasi & kendala', text: 'Gunakan GPS atau klik titik di peta, lalu pilih masalahnya: aki, ban, mesin mogok, atau kehabisan bensin.', note: 'Halaman Bantuan darurat' },
      { icon: 'radar', title: 'Bengkel terdekat dihubungi', text: 'Kami mencari bengkel aktif dalam radius 5 km. Bengkel punya 2 menit untuk merespons; jika tidak, otomatis dialihkan ke bengkel berikutnya.', note: 'Otomatis, tanpa perlu menelepon' },
      { icon: 'engineering', title: 'Mekanik datang', text: 'Pantau status secara langsung, hubungi mekanik lewat telepon atau WhatsApp. Setelah selesai, bayar via QRIS dan beri ulasan.', note: 'Halaman tracking SOS' },
    ],
    cta: { label: 'Minta bantuan darurat', to: '/emergency', icon: 'e911_emergency' },
  },
  mitra: {
    label: 'Untuk pemilik bengkel',
    icon: 'handshake',
    tone: 'bg-navy text-white',
    intro: 'Untuk UMKM bengkel yang ingin antrean lebih rapi dan dijangkau pelanggan baru.',
    steps: [
      { icon: 'app_registration', title: 'Daftarkan bengkel', text: 'Isi data pemilik dan bengkel, jam buka, kapasitas booking per jam, lalu tandai lokasi bengkel di peta.', note: 'Menu Gabung mitra' },
      { icon: 'verified', title: 'Diverifikasi admin', text: 'Admin memeriksa data bengkel. Setelah disetujui, bengkel tampil di pencarian dan bisa menerima panggilan darurat.', note: 'Status tampil di portal mitra' },
      { icon: 'tune', title: 'Atur layanan & tim', text: 'Tambahkan layanan dan harga, daftarkan mekanik beserta keahliannya, atur kapasitas per jam, dan unggah QRIS bengkel.', note: 'Menu Pengaturan bengkel dan Teknisi' },
      { icon: 'space_dashboard', title: 'Terima pesanan & SOS', text: 'Pantau antrean hari ini, terima panggilan darurat dalam 2 menit, kerjakan pesanan, dan verifikasi bukti bayar pelanggan.', note: 'Ringkasan di portal mitra' },
    ],
    cta: { label: 'Daftarkan bengkel', to: '/register/workshop', icon: 'app_registration' },
  },
};

/** Step-by-step guide for first-time visitors (requested by the team). */
function HowItWorks({ sectionRef }: { sectionRef: React.RefObject<HTMLElement | null> }) {
  const [guide, setGuide] = useState<Guide>('booking');
  const g = GUIDES[guide];
  return (
    <section ref={sectionRef} id="cara-kerja" className="scroll-mt-24">
      <LandingHeading badge="Cara kerja" title="Cara pakai BengkelGo" description="Pilih kebutuhan Anda. Setiap panduan terdiri dari 4 langkah." />
      <div className="no-scrollbar max-w-full overflow-x-auto">
        <Segmented
          nowrap
          label="Panduan"
          value={guide}
          onChange={setGuide}
          options={(Object.keys(GUIDES) as Guide[]).map((k) => ({ value: k, label: GUIDES[k].label, icon: GUIDES[k].icon }))}
        />
      </div>
      <p className="mt-4 mb-5 max-w-2xl text-sm text-ink-2 sm:text-subtitle">{g.intro}</p>
      {/* keyed by guide: switching tabs remounts the list so the new steps animate in (a once-only reveal would leave them hidden) */}
      <RevealGroup key={guide} as="ol" className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {g.steps.map((s, i) => (
          <RevealItem as="li" key={s.title} className={cx(LANDING_CARD, 'flex flex-col')}>
            <div className="flex items-center justify-between gap-3">
              <span className={cx('grid h-[46px] w-[46px] place-items-center rounded-lg', guide === 'sos' ? 'bg-emergency-soft text-emergency-ink' : 'bg-surface-high text-primary')}>
                <Icon name={s.icon} />
              </span>
              <span className="text-xs font-bold text-ink-2">Langkah {i + 1}</span>
            </div>
            <h3 className="mt-4 text-subtitle font-bold text-ink">{s.title}</h3>
            <p className="mt-1.5 flex-1 text-sm leading-relaxed text-ink-2">{s.text}</p>
            <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-primary">
              <Icon name="touch_app" className="text-[16px]" /> {s.note}
            </p>
          </RevealItem>
        ))}
      </RevealGroup>
      <Link
        to={g.cta.to}
        className={cx(
          LANDING_BUTTON,
          'mt-6',
          guide === 'sos' ? 'bg-emergency text-white hover:brightness-110' : guide === 'booking' ? 'bg-primary text-on-primary hover:bg-primary-dark' : 'border border-line bg-card text-ink hover:border-primary/60 [&_.material-symbols-outlined]:text-primary',
        )}
      >
        <Icon name={g.cta.icon} className="text-[20px]" /> {g.cta.label}
      </Link>
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
      <LandingHeading
        badge="Cerita pengendara"
        title="Ulasan dari pelanggan"
        action={
          <span className="flex items-center gap-2">
            <StarRow rating={Math.round(avg)} className="[&_span]:text-[20px]" />
            <span className="text-subtitle font-bold text-ink">{avg.toFixed(1)} / 5</span>
          </span>
        }
      />
      <div className="grid gap-3 md:grid-cols-3">
        {reviews.map((r) => (
          <figure key={r.id} className={cx(LANDING_CARD, 'flex flex-col gap-4')}>
            <StarRow rating={r.rating} />
            <blockquote className="flex-1 text-sm leading-relaxed text-ink">“{r.comment}”</blockquote>
            <figcaption className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-surface-high text-sm font-bold text-primary">
                {r.customer_name
                  .split(' ')
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </span>
              <span>
                <span className="block text-sm font-bold text-ink">{r.customer_name}</span>
                <span className="block text-xs text-ink-2">{r.workshop}</span>
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
    <div role="group" aria-label="BengkelGo dalam angka" className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-line pt-6 sm:grid-cols-3 lg:grid-cols-5" data-testid="platform-numbers">
      {items.map((i) => (
        <div key={i.label}>
          <p className="text-[28px] leading-none font-bold text-ink tabular-nums">{i.value}</p>
          <p className="mt-1.5 text-xs text-ink-2">{i.label}</p>
        </div>
      ))}
    </div>
  );
}
