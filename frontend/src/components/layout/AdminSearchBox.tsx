import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@/components/ui';

/** Search box for the admin top bar. */
export function AdminSearchBox() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  return (
    <form
      role="search"
      className="hidden h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-surface-low px-3 md:flex md:max-w-sm"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        if (q.trim().length >= 2) navigate(`/admin/search?q=${encodeURIComponent(q.trim())}`);
      }}
    >
      <Icon name="search" className="text-ink-3" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Cari bengkel, pesanan, invoice, pengguna"
        aria-label="Cari"
        className="min-w-0 flex-1 bg-transparent text-sm text-navy placeholder:text-ink-3 focus:outline-none"
        data-testid="admin-search-input"
      />
    </form>
  );
}
