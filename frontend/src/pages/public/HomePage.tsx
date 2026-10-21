import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { statsApi, workshopApi } from '@/services/api/endpoints';
import type { Workshop } from '@/services/api/types';
import { StarRow } from '@/components/workshop/WorkshopComponents';
import { Icon, SectionHeading, Segmented, cx } from '@/components/ui';
import { Reveal, RevealGroup, RevealItem } from '@/components/ui/motion';
import { m } from 'framer-motion';
import heroWorkshop from '@/assets/hero-workshop.webp';

const ADVANTAGES = [
  { icon: 'hourglass_disabled', tone: 'bg-primary', title: 'Jadwal Anti-Bentrok', text: 'Setiap jam punya batas jumlah pelanggan. Begitu Anda konfirmasi, jam itu langsung jadi milik Anda dan tidak bisa diambil orang lain.', foot: 'Diuji 100 pemesan sekaligus, tidak ada yang bentrok', footIcon: 'check_circle', footTone: 'text-primary' },
  { icon: 'location_on', tone: 'bg-emergency', title: 'Pencarian Darurat 5 KM', text: 'Bengkel aktif terdekat dengan mekanik terbaik dihubungi lebih dulu. Jika tidak merespons dalam 2 menit, dialihkan otomatis.', foot: 'Pengalihan otomatis 2 menit', footIcon: 'bolt', footTone: 'text-emergency-ink' },
  { icon: 'qr_code_2', tone: 'bg-success', title: 'Pembayaran QRIS Bengkel', text: 'Bayar langsung ke QRIS milik bengkel, lalu unggah bukti. Bengkel memverifikasi dan status langsung terlihat di aplikasi.', foot: 'Transparan & tercatat', footIcon: 'check_circle', footTone: 'text-success' },
  { icon: 'shield', tone: 'bg-navy', title: 'Rating Mekanik Dinamis', text: 'Setiap ulasan pelanggan memperbarui rating mekanik. Rating ini ikut menentukan prioritas penugasan panggilan darurat.', foot: 'Berdasarkan ulasan asli', footIcon: 'verified', footTone: 'text-navy' },
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

/** What visitors can do here: three clear entry points (the tools themselves live on /workshops). */
const SERVICES: { icon: string; tone: string; title: string; text: string; cta: string; to: string; sos?: boolean }[] = [
  {
    icon: 'calendar_month',
    tone: 'bg-primary',
    title: 'Booking Servis Terjadwal',
    text: 'Pilih bengkel, paket servis, dan jam kedatangan. Jumlah pelanggan tiap jam dibatasi sehingga Anda tidak perlu antre lama.',
    cta: 'Booking servis',
    to: '/workshops?tab=booking',
  },
  {
    icon: 'e911_emergency',
    tone: 'bg-emergency',
    title: 'Bantuan Darurat SOS',
    text: 'Kendaraan mogok di jalan? Kirim lokasi, bengkel terdekat dalam radius 5 km akan dihubungi otomatis. Tanpa akun pun bisa.',
    cta: 'Panggil SOS',
    to: '/emergency',
    sos: true,
  },
  {
    icon: 'storefront',
    tone: 'bg-navy',
    title: 'Cari Bengkel Terdekat',
    text: 'Temukan bengkel terverifikasi di sekitar Anda. Bandingkan rating, jam buka, dan jenis kendaraan yang dilayani.',
    cta: 'Cari bengkel',
    to: '/workshops?tab=cari',
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { hash } = useLocation();
  const howRef = useRef<HTMLElement>(null);
  // Only used to pick real reviews for the testimonials section.
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
    <div className="flex flex-col gap-20">
      {/* ------------------------------------------------ hero: what BengkelGo is */}
      <section className="relative -mx-5 -mt-8 overflow-hidden px-5 pt-12 pb-4 sm:-mx-8 sm:-mt-12 sm:px-8 sm:pt-16 lg:-mx-20 lg:px-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_85%_0%,#f0f3ff_0%,rgba(248,250,251,0)_70%)]" />
        <div className="relative grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
          <Reveal>
            <p className="inline-flex items-center gap-2 font-label text-xs font-bold text-primary" data-testid="hero-location-chip">
              <Icon name="location_on" className="text-[20px]" />
              Temukan bengkel terdekat, di mana pun Anda berada
            </p>
            <h1 className="mt-5 text-display-mobile text-navy sm:text-display">Solusi Lengkap Servis Kendaraan &amp; <span className="text-primary">Bantuan Darurat 24 Jam</span></h1>
            <p className="mt-4 max-w-xl text-subtitle leading-relaxed text-ink-2 sm:text-[15px]">
              BengkelGo menghubungkan pemilik motor dan mobil dengan bengkel UMKM terverifikasi di sekitar Anda. Pesan jadwal servis tanpa antre lama, atau panggil mekanik saat kendaraan mogok di jalan.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/workshops?tab=booking" className="inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-6 font-label text-sm font-bold text-white shadow-sm hover:bg-primary-dark" data-testid="hero-booking">
                <Icon name="calendar_month" /> Cari &amp; Booking Bengkel
              </Link>
              <Link to="/emergency" className="inline-flex h-12 items-center gap-2 rounded-lg border-[1.5px] border-emergency bg-transparent px-6 font-label text-sm font-bold text-emergency-ink transition hover:bg-emergency-soft">
                <Icon name="e911_emergency" filled /> Bantuan Darurat SOS
              </Link>
            </div>
            <Link to="/#cara-kerja" className="mt-4 inline-flex items-center gap-1.5 font-label text-sm font-bold text-primary hover:underline">
              <Icon name="help" className="text-[18px]" /> Baru pertama kali? Lihat cara kerjanya
            </Link>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 font-label text-xs font-semibold text-ink-2">
              {[
                ['verified', 'Bengkel diverifikasi admin'],
                ['lock', 'Jadwal per jam, tidak bentrok'],
                ['qr_code_2', 'Bayar via QRIS bengkel'],
              ].map(([icon, t]) => (
                <li key={t} className="inline-flex items-center gap-1.5">
                  <Icon name={icon} className="text-[18px] text-success" /> {t}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.12} className="hidden lg:block">
            <HeroVisual />
          </Reveal>
        </div>
      </section>

      <PlatformNumbers />

      {/* ------------------------------------------------ what you can do */}
      <Reveal as="section">
        <SectionHeading eyebrow="Layanan BengkelGo" title="Apa yang Bisa Anda Lakukan?" subtitle="Tiga kebutuhan utama pemilik kendaraan, dalam satu tempat." />
        <RevealGroup className="grid gap-5 md:grid-cols-3">
          {SERVICES.map((s) => (
            <RevealItem key={s.title} className="flex">
            <Link to={s.to} className="group flex flex-1 flex-col gap-4 rounded-xl border border-line bg-card p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lift">
              <span className={cx('grid h-12 w-12 place-items-center rounded-lg text-white', s.tone)}>
                <Icon name={s.icon} />
              </span>
              <h3 className="text-headline-sm text-navy">{s.title}</h3>
              <p className="flex-1 text-sm leading-relaxed text-ink-2">{s.text}</p>
              {s.sos ? (
                <span data-a11y-exception="sos-brand-orange" className="inline-flex h-10 items-center gap-1.5 self-start rounded-lg bg-emergency px-5 font-label text-sm font-bold text-white shadow-sm transition group-hover:bg-emergency-dark">
                  <Icon name="e911_emergency" filled className="text-[18px]" /> {s.cta}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-label text-sm font-bold text-primary group-hover:underline">
                  {s.cta} <Icon name="arrow_forward" className="text-[18px]" />
                </span>
              )}
            </Link>
            </RevealItem>
          ))}
        </RevealGroup>
      </Reveal>

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
              <RevealItem key={a.title} className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm transition-shadow hover:shadow-lift">
                <span className={cx('grid h-12 w-12 place-items-center rounded-xl text-white shadow-soft', a.tone)}>
                  <Icon name={a.icon} className="text-[24px]" />
                </span>
                <h3 className="text-headline-sm font-bold text-navy">{a.title}</h3>
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

      {/* ------------------------------------------------ partner banner */}
      <Reveal as="section" className="relative overflow-hidden rounded-xl bg-gradient-to-r from-navy via-[#273C9B] to-primary p-8 text-white shadow-lift sm:p-12">
        <div className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
        <div className="relative grid gap-8 lg:grid-cols-[1.6fr_1fr] lg:items-center">
          <div>
            <span className="inline-flex rounded-full bg-white/15 px-3 py-1 font-label text-[11px] font-bold tracking-[0.04em] uppercase">Portal Pemilik Bengkel UMKM</span>
            <h2 className="mt-4 text-[20px] leading-tight font-bold tracking-[-0.015em] sm:text-headline-lg">Kelola Antrean Bengkel Anda Lebih Rapi bersama BengkelGo</h2>
            <p className="mt-3 max-w-xl text-subtitle text-white/80">Tinggalkan catatan antrean kertas. Atur kapasitas per jam, mekanik, panggilan darurat dalam radius 5 km, dan verifikasi pembayaran QRIS dari satu dashboard.</p>
            <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 font-label text-xs font-semibold">
              {['Pendaftaran online', 'Kelola antrean & kapasitas per jam', 'Terima panggilan darurat sekitar'].map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5">
                  <Icon name="check_circle" className="text-[16px] text-success" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-3 lg:items-end">
            <Link to="/register/workshop" className="inline-flex h-12 items-center justify-center rounded-lg bg-white px-7 font-label text-sm font-bold text-navy hover:bg-sky">
              Daftarkan Bengkel Sekarang
            </Link>
            <Link to="/login" className="inline-flex h-12 items-center justify-center rounded-lg bg-white/15 px-7 font-label text-sm font-bold text-white hover:bg-white/25">
              Masuk Portal Mitra
            </Link>
          </div>
        </div>
      </Reveal>

      {/* ------------------------------------------------ FAQ */}
      <Reveal as="section">
        <SectionHeading eyebrow="Pusat informasi & panduan" title="Pertanyaan yang Sering Diajukan (FAQ)" subtitle="Cara kerja bantuan darurat, antrean, dan pembayaran." />
        <div className="flex max-w-3xl flex-col gap-3">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-xl bg-surface-low px-5 py-4 open:bg-white open:shadow-sm open:ring-1 open:ring-line">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold text-navy [&::-webkit-details-marker]:hidden">
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

/** Hero illustration (isometric workshop, from the Stitch project) with the three feature labels floating around it. */
function HeroVisual() {
  const chips = [
    { icon: 'event_available', text: 'Jadwal terjamin', tone: 'text-primary', pos: '-left-6 top-[38%]' },
    { icon: 'two_wheeler', text: 'Mekanik menuju lokasi', tone: 'text-emergency-ink', pos: '-right-4 top-[60%]' },
    { icon: 'qr_code_2', text: 'Bayar via QRIS', tone: 'text-success', pos: 'left-[14%] bottom-[20%]' },
  ];
  return (
    <div className="relative mx-auto w-full max-w-lg" aria-hidden>
      {/* soft brand glow behind the tile */}
      <div className="absolute inset-[8%] rounded-full bg-[radial-gradient(circle,#d3dbfd_0%,rgba(211,219,253,0)_70%)] blur-2xl" />
      <m.img
        src={heroWorkshop}
        alt=""
        width={1536}
        height={1536}
        draggable={false}
        className="relative aspect-square w-full mix-blend-multiply select-none [mask-image:radial-gradient(closest-side,#000_78%,transparent)]"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />
      {chips.map((c, i) => (
        <m.span
          key={c.text}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 + i * 0.12, ease: 'easeOut' }}
          className={cx('absolute flex items-center gap-2 rounded-xl bg-white/95 px-4 py-3 font-label text-sm font-bold text-navy shadow-lift ring-1 ring-line/60 backdrop-blur', c.pos)}
        >
          <Icon name={c.icon} className={c.tone} /> {c.text}
        </m.span>
      ))}
    </div>
  );
}

type Guide = 'booking' | 'sos' | 'mitra';
type Step = { icon: string; title: string; text: string; note: string };

const GUIDES: Record<Guide, { label: string; icon: string; tone: string; intro: string; steps: Step[]; cta: { label: string; to: string; icon: string } }> = {
  booking: {
    label: 'Booking Servis Terjadwal',
    icon: 'calendar_month',
    tone: 'bg-primary',
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
    tone: 'bg-emergency',
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
    tone: 'bg-navy',
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
              <span className={cx('relative z-10 grid h-14 w-14 place-items-center rounded-full text-white shadow-lift ring-8 ring-canvas', g.tone)}>
                <Icon name={s.icon} className="text-[20px]" />
                <span className="absolute -top-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-white font-label text-xs font-bold text-navy shadow-sm">{i + 1}</span>
              </span>
              <div className="mt-4 flex w-full flex-1 flex-col rounded-xl border border-line bg-card p-5 shadow-sm">
                <p className="font-label text-[11px] font-bold tracking-[0.04em] text-ink-3 uppercase">Langkah {i + 1}</p>
                <h3 className="mt-1 text-headline-sm text-navy">{s.title}</h3>
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
          className={cx('inline-flex h-12 items-center gap-2 rounded-lg px-6 font-label text-sm font-bold text-white shadow-sm transition hover:brightness-110', g.tone)}
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
            <span className="text-headline-sm text-navy">{avg.toFixed(1)} / 5.0</span>
          </span>
        }
      />
      <div className="grid gap-5 md:grid-cols-3">
        {reviews.map((r) => (
          <figure key={r.id} className="flex flex-col gap-4 rounded-xl border border-line bg-card p-6 shadow-sm">
            <StarRow rating={r.rating} />
            <blockquote className="flex-1 text-sm leading-relaxed text-navy italic">“{r.comment}”</blockquote>
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
                <span className="block text-sm font-bold text-navy">{r.customer_name}</span>
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
          <p className="text-headline-md font-extrabold text-navy tabular-nums">{i.value}</p>
          <p className="font-label text-xs text-ink-2">{i.label}</p>
        </div>
      ))}
    </section>
  );
}
