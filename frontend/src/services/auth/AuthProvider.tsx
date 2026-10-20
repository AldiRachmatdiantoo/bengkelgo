import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { refreshSession, tokenStore } from '../api/client';
import { authApi } from '../api/endpoints';
import type { Role, User } from '../api/types';

interface AuthState {
  user: User | null;
  /** True until the initial silent refresh (cookie -> session) has finished. */
  loading: boolean;
  hasRole: (...roles: Role[]) => boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = tokenStore.subscribe((s) => setUser(s?.user ?? null));
    // Restore the session after a page reload from the httpOnly refresh cookie.
    refreshSession().finally(() => setLoading(false));
    return () => {
      unsubscribe();
    };
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    // Wipe the previous user's cached data; queries still on screen refetch as anonymous.
    await queryClient.resetQueries();
  }, [queryClient]);

  const value = useMemo<AuthState>(
    () => ({ user, loading, hasRole: (...roles) => !!user && roles.includes(user.role), logout }),
    [user, loading, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Landing page per role after login. */
export function homeFor(role: Role | undefined): string {
  if (role === 'WORKSHOP_OWNER') return '/owner';
  if (role === 'ADMIN') return '/admin';
  if (role === 'CUSTOMER' || role === 'GUEST') return '/orders';
  return '/';
}

/** Whether a page the user was sent away from (login redirect) is one their role may open. */
export function canReturnTo(role: Role, path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//')) return false;
  if (path.startsWith('/owner')) return role === 'WORKSHOP_OWNER';
  if (path.startsWith('/admin')) return role === 'ADMIN';
  if (/^\/orders\/[^/]+\/?(\?.*)?$/.test(path)) return true; // order detail: any party (server checks ownership)
  if (path.startsWith('/orders') || path.startsWith('/notifications')) return role === 'CUSTOMER' || role === 'GUEST';
  if (path.startsWith('/login') || path.startsWith('/register')) return false;
  // Public pages (workshop detail mid-booking, SOS, ...) are meant for customers.
  return role === 'CUSTOMER' || role === 'GUEST';
}
