import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LazyMotion, MotionConfig } from 'framer-motion';
import { AuthProvider } from '@/services/auth/AuthProvider';
import App from './App';
// Text fonts served with the app (same origin: no extra connections before the first paint). Latin covers Indonesian.
import '@fontsource/plus-jakarta-sans/latin-400.css';
import '@fontsource/plus-jakarta-sans/latin-500.css';
import '@fontsource/plus-jakarta-sans/latin-600.css';
import '@fontsource/plus-jakarta-sans/latin-700.css';
import '@fontsource/plus-jakarta-sans/latin-800.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import './theme/index.css';

// After a new deploy, a tab still running the previous build asks for chunk files that no longer exist.
// Vite reports that as `vite:preloadError`; reload once to pick up the new build instead of showing an error.
// The timestamp guard stops a reload loop if the files are genuinely unreachable (e.g. offline).
window.addEventListener('vite:preloadError', (event) => {
  const KEY = 'bengkelgo:chunk-reload-at';
  let last = 0;
  try {
    last = Number(sessionStorage.getItem(KEY) ?? 0);
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // storage blocked: still reload once
  }
  if (Date.now() - last < 10_000) return;
  event.preventDefault();
  window.location.reload();
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* Animations are skipped for visitors who ask their OS for reduced motion. */}
        <MotionConfig reducedMotion="user">
          {/* `m` components are tiny; the animation engine downloads after the first paint. strict: no full `motion` imports. */}
          <LazyMotion features={() => import('@/components/ui/motion-features').then((r) => r.default)} strict>
            <App />
          </LazyMotion>
        </MotionConfig>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
