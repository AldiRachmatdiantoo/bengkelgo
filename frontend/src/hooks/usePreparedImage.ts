import { useCallback, useEffect, useState } from 'react';
import { ImageCheckError, prepareImage, type PreparedImage } from '@/utils/imageUpload';

/** Picks a photo, checks/shrinks it in the browser and keeps a preview URL for it. */
export function usePreparedImage(opts: { maxSide?: number } = {}) {
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { maxSide } = opts;

  useEffect(() => {
    if (!image) return setPreview(null);
    const url = URL.createObjectURL(image.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const choose = useCallback(
    async (file: File | null | undefined) => {
      setError(null);
      if (!file) return setImage(null);
      setBusy(true);
      try {
        setImage(await prepareImage(file, { maxSide }));
      } catch (e) {
        setImage(null);
        setError(e instanceof ImageCheckError ? e.message : 'Foto tidak bisa dibaca. Coba foto lain.');
      } finally {
        setBusy(false);
      }
    },
    [maxSide],
  );

  const reset = useCallback(() => {
    setImage(null);
    setError(null);
  }, []);

  return { file: image?.file ?? null, image, preview, error, busy, choose, reset };
}
