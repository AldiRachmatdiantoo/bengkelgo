import { describe, expect, it } from 'vitest';
import { deviceLabel } from './device';

describe('deviceLabel', () => {
  it('names common browsers and systems', () => {
    expect(deviceLabel('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36')).toEqual({ name: 'Chrome · Windows', icon: 'computer' });
    expect(deviceLabel('Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36')).toEqual({ name: 'Chrome · Android', icon: 'smartphone' });
    expect(deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')).toEqual({ name: 'Safari · iPhone', icon: 'smartphone' });
    expect(deviceLabel('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 Edg/141.0')).toEqual({ name: 'Edge · Mac', icon: 'computer' });
    expect(deviceLabel('Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0 Mobile Safari/537.36').name).toBe('Samsung Internet · Android');
  });

  it('falls back gracefully', () => {
    expect(deviceLabel(null)).toEqual({ name: 'Perangkat tidak dikenal', icon: 'devices' });
    expect(deviceLabel('PostmanRuntime/7.39.0').name).toBe('Aplikasi lain');
  });
});
