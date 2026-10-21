/**
 * Shared look of every customer email (booking, payment, cancellation, completion): BengkelGo header, greeting,
 * an optional highlighted box, a details table, one main button, tips and a footer. Email clients ignore
 * <style> blocks and modern CSS, so the HTML is table-based with inline styles; every dynamic value is escaped.
 * A plain-text version is always produced alongside.
 */
export interface EmailContent {
  subject: string;
  /** Small label next to the logo, e.g. "Booking terkonfirmasi". */
  tag: string;
  /** Preview line shown by mail apps next to the subject. */
  preheader: string;
  /** Full name; the greeting uses the first name. */
  name: string;
  intro: string;
  highlight?: { label: string; title: string; subtitle?: string };
  rows: [string, string][];
  button: { text: string; url: string };
  link?: { text: string; url: string };
  tips: string[];
  footer: string;
}

const BRAND = '#4361EE';
const NAVY = '#192557';
const MUTED = '#5F6784';
const LINE = '#E3E7F1';
const SOFT = '#F0F3FF';

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;
/** "Rp125.000" */
export const rupiah = (n: number) => `Rp${Math.round(Number(n)).toLocaleString('id-ID')}`;

export function renderEmail(e: EmailContent) {
  const text = [
    `Halo ${e.name},`,
    '',
    e.intro,
    '',
    ...(e.highlight ? [`${e.highlight.label.padEnd(20)}: ${[e.highlight.title, e.highlight.subtitle].filter(Boolean).join(', ')}`] : []),
    ...e.rows.map(([k, v]) => `${k.padEnd(20)}: ${v}`),
    '',
    ...(e.tips.length ? ['Informasi:', ...e.tips.map((t) => `- ${t}`), ''] : []),
    `${e.button.text}: ${e.button.url}`,
    ...(e.link ? [`${e.link.text}: ${e.link.url}`] : []),
    '',
    'Salam,',
    'Tim BengkelGo',
    '',
    e.footer,
  ].join('\n');

  const detailRows = e.rows
    .map(
      ([k, v], i) => `
      <tr>
        <td style="padding:10px 0;${i ? `border-top:1px solid ${LINE};` : ''}color:${MUTED};font-size:13px;width:38%;vertical-align:top;">${esc(k)}</td>
        <td style="padding:10px 0;${i ? `border-top:1px solid ${LINE};` : ''}color:${NAVY};font-size:14px;font-weight:600;vertical-align:top;">${esc(v)}</td>
      </tr>`,
    )
    .join('');

  const highlight = e.highlight
    ? `
        <tr>
          <td style="padding:16px 28px 4px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SOFT};border-radius:10px;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0;color:${MUTED};font-size:12px;letter-spacing:0.6px;text-transform:uppercase;">${esc(e.highlight.label)}</p>
                  <p style="margin:4px 0 0;color:${NAVY};font-size:20px;font-weight:800;">${esc(e.highlight.title)}</p>
                  ${e.highlight.subtitle ? `<p style="margin:2px 0 0;color:${BRAND};font-size:16px;font-weight:700;">${esc(e.highlight.subtitle)}</p>` : ''}
                </td>
              </tr>
            </table>
          </td>
        </tr>`
    : '';

  const tips = e.tips.length
    ? `
        <tr>
          <td style="padding:20px 28px 8px;">
            <p style="margin:0 0 8px;color:${NAVY};font-size:13px;font-weight:700;">Informasi penting</p>
            <ul style="margin:0;padding-left:18px;color:${MUTED};font-size:13px;line-height:21px;">
              ${e.tips.map((t) => `<li style="margin:0 0 4px;">${esc(t)}</li>`).join('')}
            </ul>
          </td>
        </tr>`
    : '';

  const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(e.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#F4F6FB;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(e.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6FB;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid ${LINE};border-radius:12px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <tr>
          <td style="background:${BRAND};border-radius:12px 12px 0 0;padding:18px 28px;">
            <span style="color:#FFFFFF;font-size:20px;font-weight:800;letter-spacing:-0.3px;">BengkelGo</span>
            <span style="color:#DDE3FF;font-size:12px;padding-left:8px;">${esc(e.tag)}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 28px 8px;">
            <p style="margin:0 0 12px;color:${NAVY};font-size:16px;">Halo ${esc(firstName(e.name))},</p>
            <p style="margin:0;color:${MUTED};font-size:14px;line-height:22px;">${esc(e.intro)}</p>
          </td>
        </tr>${highlight}
        <tr>
          <td style="padding:12px 28px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${detailRows}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px 4px;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:${BRAND};border-radius:8px;">
                  <a href="${esc(e.button.url)}" style="display:inline-block;padding:12px 22px;color:#FFFFFF;font-size:14px;font-weight:700;text-decoration:none;">${esc(e.button.text)}</a>
                </td>
                ${e.link ? `<td style="padding-left:12px;"><a href="${esc(e.link.url)}" style="color:${BRAND};font-size:14px;font-weight:600;text-decoration:none;">${esc(e.link.text)} &rsaquo;</a></td>` : ''}
              </tr>
            </table>
          </td>
        </tr>${tips}
        <tr>
          <td style="padding:20px 28px 28px;">
            <p style="margin:0;color:${NAVY};font-size:14px;">Salam,<br><strong>Tim BengkelGo</strong></p>
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid ${LINE};padding:16px 28px;color:${MUTED};font-size:12px;line-height:18px;">${esc(e.footer)}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  return { subject: e.subject, text, html };
}
