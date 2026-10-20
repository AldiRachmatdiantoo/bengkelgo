import { describe, expect, it } from 'vitest';
import { canReturnTo, homeFor } from './AuthProvider';

describe('homeFor', () => {
  it('sends each role to its own home', () => {
    expect(homeFor('ADMIN')).toBe('/admin');
    expect(homeFor('WORKSHOP_OWNER')).toBe('/owner');
    expect(homeFor('CUSTOMER')).toBe('/orders');
    expect(homeFor('GUEST')).toBe('/orders');
    expect(homeFor(undefined)).toBe('/');
  });
});

describe('canReturnTo', () => {
  it('lets every party go back to an order detail link', () => {
    for (const role of ['CUSTOMER', 'GUEST', 'WORKSHOP_OWNER', 'ADMIN'] as const) {
      expect(canReturnTo(role, '/orders/7b1c0a8e-1111-4c4c-9999-123456789abc')).toBe(true);
    }
  });

  it('keeps portals to their own role', () => {
    expect(canReturnTo('WORKSHOP_OWNER', '/owner/payments')).toBe(true);
    expect(canReturnTo('CUSTOMER', '/owner/payments')).toBe(false);
    expect(canReturnTo('ADMIN', '/admin/reports')).toBe(true);
    expect(canReturnTo('WORKSHOP_OWNER', '/admin')).toBe(false);
  });

  it('sends customers back to the booking they started, but not staff', () => {
    expect(canReturnTo('CUSTOMER', '/workshops/abc')).toBe(true);
    expect(canReturnTo('WORKSHOP_OWNER', '/workshops/abc')).toBe(false);
    expect(canReturnTo('CUSTOMER', '/orders')).toBe(true);
    expect(canReturnTo('CUSTOMER', '/orders/abc/pay')).toBe(true);
    expect(canReturnTo('ADMIN', '/orders/abc/pay')).toBe(false);
  });

  it('rejects auth pages and off-site targets', () => {
    expect(canReturnTo('CUSTOMER', '/login')).toBe(false);
    expect(canReturnTo('CUSTOMER', '//evil.example')).toBe(false);
    expect(canReturnTo('CUSTOMER', 'https://evil.example')).toBe(false);
  });
});
