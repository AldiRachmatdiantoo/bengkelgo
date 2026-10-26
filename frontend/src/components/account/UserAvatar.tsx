import type { User } from '@/services/api/types';
import { useProtectedImage } from '@/hooks/useProtectedImage';
import { cx } from '@/components/ui';

const SIZES = { sm: 'h-9 w-9 text-sm', md: 'h-10 w-10 text-sm', xl: 'h-20 w-20 text-3xl' } as const;

/** The signed-in user's profile photo (loaded with the login), or the first letter of the name. */
export function UserAvatar({ user, size = 'md', className }: { user: User; size?: keyof typeof SIZES; className?: string }) {
  const img = useProtectedImage(user.photo_url ?? null);
  const box = cx('shrink-0 rounded-full', SIZES[size], className);
  if (user.photo_url && img.url) return <img src={img.url} alt="" className={cx(box, 'object-cover')} data-testid="user-avatar-photo" />;
  return <span className={cx(box, 'grid place-items-center bg-navy font-label font-bold text-white')}>{user.name.trim().charAt(0).toUpperCase() || '?'}</span>;
}
