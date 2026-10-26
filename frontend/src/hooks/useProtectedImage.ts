import { useEffect, useState } from 'react';
import { errorMessage, fetchImageUrl } from '@/services/api/client';

/** Loads an auth-protected image endpoint into an object URL (revoked on unmount / change). */
export function useProtectedImage(path: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // A new (or no) image: never keep showing the previous one, whose URL is revoked below.
    setUrl(null);
    if (!path) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    setError(null);
    fetchImageUrl(path)
      .then((u) => {
        objectUrl = u;
        if (!cancelled) setUrl(u);
      })
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  return { url, error };
}
