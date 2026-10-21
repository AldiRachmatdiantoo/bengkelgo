import { Link, useLocation } from 'react-router-dom';
import { Icon } from '@/components/ui';
import { Reveal } from '@/components/ui/motion';

/** 404: any URL the router does not know. Offers the three main ways forward. */
export default function NotFoundPage() {
  const { pathname } = useLocation();
  return (
    <Reveal className="mx-auto flex max-w-xl flex-col items-center py-10 text-center sm:py-16">
      <span className="relative grid h-24 w-24 place-items-center rounded-full bg-sky text-primary">
        <Icon name="wrong_location" className="text-[44px]" />
        <span className="absolute -right-1 -bottom-1 grid h-9 w-9 place-items-center rounded-full bg-card font-label text-[11px] font-extrabold text-navy shadow-soft">404</span>
      </span>
      <p className="mt-6 font-label text-label-sm text-primary uppercase">Halaman tidak ditemukan</p>
      <h1 className="mt-2 text-headline-lg text-navy">Sepertinya Anda salah belok</h1>
      <p className="mt-3 text-subtitle text-ink-2">
        Alamat <code className="rounded bg-surface-low px-1.5 py-0.5 font-mono text-xs text-navy">{pathname}</code> tidak ada atau sudah dipindahkan. Pilih tujuan di bawah untuk melanjutkan.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/" className="inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-6 font-label text-sm font-bold text-white shadow-sm hover:bg-primary-dark" data-testid="notfound-home">
          <Icon name="home" /> Kembali ke Beranda
        </Link>
        <Link to="/workshops" className="inline-flex h-12 items-center gap-2 rounded-lg border-[1.5px] border-primary px-6 font-label text-sm font-bold text-primary hover:bg-sky">
          <Icon name="storefront" /> Cari Bengkel
        </Link>
      </div>
      <Link to="/emergency" className="mt-6 inline-flex items-center gap-1.5 font-label text-sm font-semibold text-emergency-ink hover:underline">
        <Icon name="e911_emergency" filled className="text-[18px]" /> Kendaraan mogok? Minta bantuan darurat
      </Link>
    </Reveal>
  );
}
