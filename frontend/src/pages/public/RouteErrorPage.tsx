import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { Icon } from '@/components/ui';

/**
 * Shown instead of React Router's developer screen when a page fails to render or load. The common case in
 * production is a tab still running an old build after a deploy (its page files were replaced): reloading fixes it.
 * Rendered outside AppLayout, so it only uses plain markup and must not depend on data or auth.
 */
export default function RouteErrorPage() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error instanceof Error ? error.message : String(error);
  const staleBuild = /dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(message);

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-5 py-10">
      <div className="max-w-md text-center">
        <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-sky text-primary">
          <Icon name={staleBuild ? 'system_update' : 'error'} className="text-[40px]" />
        </span>
        <h1 className="mt-6 text-headline-md text-balance text-navy">{staleBuild ? 'BengkelGo baru saja diperbarui' : 'Halaman gagal dimuat'}</h1>
        <p className="mt-3 text-ink-2">
          {staleBuild
            ? 'Muat ulang halaman untuk memakai versi terbaru. Bila tetap muncul, periksa koneksi internet Anda.'
            : 'Terjadi kesalahan saat menampilkan halaman ini. Coba muat ulang; bila masih terjadi, kembali ke beranda.'}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-6 font-label text-sm font-bold text-white shadow-sm hover:bg-primary-dark"
            data-testid="route-error-reload"
          >
            <Icon name="refresh" /> Muat ulang
          </button>
          <a href="/" className="inline-flex h-12 items-center gap-2 rounded-lg border-[1.5px] border-primary px-6 font-label text-sm font-bold text-primary hover:bg-sky">
            <Icon name="home" /> Ke Beranda
          </a>
        </div>
        {!staleBuild && <p className="mt-6 font-mono text-xs break-all text-ink-3">{message}</p>}
      </div>
    </main>
  );
}
