/** "Chrome · Android" from a browser's user-agent string, for the list of signed-in devices. */
export function deviceLabel(ua: string | null | undefined): { name: string; icon: string } {
  if (!ua) return { name: 'Perangkat tidak dikenal', icon: 'devices' };
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /SamsungBrowser/.test(ua)
        ? 'Samsung Internet'
        : /FBAN|FBAV|Instagram|Line\/|WhatsApp/.test(ua)
          ? 'Browser di aplikasi'
          : /Firefox\/|FxiOS/.test(ua)
            ? 'Firefox'
            : /Chrome\/|CriOS/.test(ua)
              ? 'Chrome'
              : /Safari\//.test(ua)
                ? 'Safari'
                : /PostmanRuntime|okhttp|curl|axios|node/i.test(ua)
                  ? 'Aplikasi lain'
                  : 'Browser';
  const os = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Mac OS X|Macintosh/.test(ua)
            ? 'Mac'
            : /CrOS/.test(ua)
              ? 'Chromebook'
              : /Linux/.test(ua)
                ? 'Linux'
                : null;
  const phone = /iPhone|Android.*Mobile|Mobile Safari/.test(ua);
  return { name: os ? `${browser} · ${os}` : browser, icon: phone ? 'smartphone' : /iPad|Android(?!.*Mobile)/.test(ua) ? 'tablet' : 'computer' };
}
