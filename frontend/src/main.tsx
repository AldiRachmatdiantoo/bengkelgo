import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LazyMotion, MotionConfig } from 'framer-motion';
import { AuthProvider } from '@/services/auth/AuthProvider';
import App from './App';
import './theme/index.css';

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
