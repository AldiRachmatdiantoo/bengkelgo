import { describe, expect, it } from 'vitest';
import { UNBLOCK_STEPS, isInAppBrowser, platformOf } from './useGeolocation';

describe('location permission helpers', () => {
  it('recognises in-app browsers but not regular Chrome/Safari', () => {
    expect(isInAppBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0')).toBe(true);
    expect(isInAppBrowser('Mozilla/5.0 (Linux; Android 14; SM-A546E Build/UP1A; wv) AppleWebKit/537.36 Version/4.0 Chrome/126.0 Mobile Safari/537.36')).toBe(true);
    expect(isInAppBrowser('Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36')).toBe(false);
    expect(isInAppBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')).toBe(false);
  });

  it('picks unblock steps for the device', () => {
    expect(platformOf('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('ios');
    expect(platformOf('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe('ios'); // iPad in desktop mode
    expect(platformOf('Mozilla/5.0 (Linux; Android 14; Pixel 7)')).toBe('android');
    expect(platformOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('desktop');
    for (const steps of Object.values(UNBLOCK_STEPS)) expect(steps.length).toBeGreaterThan(0);
  });
});
