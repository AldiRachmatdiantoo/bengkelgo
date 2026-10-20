import { describe, expect, it } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { errorMessage } from './client';
import { translateApiError } from './errorMessages';

const apiError = (status: number, error: object) =>
  new AxiosError('fail', 'ERR', undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { success: false, error },
  });

describe('API error messages', () => {
  it('shows upload errors in Indonesian', () => {
    expect(errorMessage(apiError(400, { code: 'INVALID_FILE_TYPE', message: 'Only JPEG, PNG or WEBP images are allowed' }))).toMatch(/Video dan PDF tidak bisa/);
    expect(errorMessage(apiError(400, { code: 'FILE_TOO_LARGE', message: 'File exceeds 2MB limit' }))).toMatch(/2 MB/);
    expect(errorMessage(apiError(429, { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' }))).toMatch(/Terlalu banyak/);
  });

  it('turns validation issues into readable field messages', () => {
    const msg = translateApiError('VALIDATION_ERROR', [
      { path: 'owner.phone', message: 'Must be a valid Indonesian WhatsApp number' },
      { path: 'vehicle_plate', message: 'Invalid license plate' },
    ]);
    expect(msg).toBe('Nomor WhatsApp tidak valid (contoh: 081234567890) · Plat nomor tidak valid (contoh: B 1234 ABC).');
  });

  it('falls back to the backend message for unknown codes', () => {
    expect(errorMessage(apiError(400, { code: 'SOMETHING_NEW', message: 'New thing' }))).toBe('New thing');
  });

  it('explains network failures', () => {
    expect(errorMessage(new AxiosError('Network Error', 'ERR_NETWORK'))).toBe('Tidak dapat terhubung ke server.');
  });
});
