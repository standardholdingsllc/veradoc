/**
 * Shared email layout — colors and fonts from app/globals.css.
 *
 * Colors:
 *   background: #f6f0e4  foreground: #2b241d  surface: #fbf7ef
 *   primary: #3c2a1d     accent: #a75634      muted: #6d6256
 *   border: #d9c9b4
 *
 * Fonts: Source Sans 3 (body), Source Serif 4 (headings)
 */

const BRAND = {
  background: "#f6f0e4",
  foreground: "#2b241d",
  surface: "#fbf7ef",
  primary: "#3c2a1d",
  accent: "#a75634",
  muted: "#6d6256",
  border: "#d9c9b4",
  white: "#ffffff",
} as const;

const FONT =
  "'Source Sans 3', 'Source Sans Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const HEADING_FONT =
  "'Source Serif 4', 'Source Serif Pro', Georgia, 'Times New Roman', serif";

const LOGO_URL =
  "https://fyfcslzgahfbyezsnpxl.supabase.co/storage/v1/object/public/brand-assets/veradoc-email-logo.png";

export function emailLayout(
  body: string,
  options?: { preheader?: string },
): string {
  const preheader = options?.preheader
    ? `<span style="display:none;font-size:1px;color:${BRAND.background};max-height:0;overflow:hidden;">${options.preheader}</span>`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>VeraDoc</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&family=Source+Serif+4:wght@600;700&display=swap');
    body, table, td { font-family: ${FONT}; }
    h1, h2, h3 { font-family: ${HEADING_FONT}; }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.background};font-family:${FONT};">
  ${preheader}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.background};padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding:0 0 28px;">
              <a href="https://veradoc.pe" target="_blank" style="text-decoration:none;">
                <img src="${LOGO_URL}" alt="VeraDoc.pe" width="120" height="120" style="display:block;width:120px;height:auto;border:0;" />
              </a>
            </td>
          </tr>

          <!-- Content card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.white};border-radius:8px;border:1px solid ${BRAND.border};overflow:hidden;">
                <tr>
                  <td style="padding:36px 32px;">
                    ${body}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:24px 0 0;">
              <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.5;color:${BRAND.muted};">
                VERADOC S.A.C.S. · RUC 20616178548 · Lima, Perú
              </p>
              <p style="margin:4px 0 0;font-family:${FONT};font-size:12px;line-height:1.5;color:${BRAND.muted};">
                <a href="https://veradoc.pe" style="color:${BRAND.primary};text-decoration:none;">veradoc.pe</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function emailButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto 0;">
    <tr>
      <td align="center" style="border-radius:6px;background-color:${BRAND.primary};">
        <a href="${href}" target="_blank"
           style="display:inline-block;padding:13px 28px;font-family:${FONT};font-size:15px;font-weight:600;color:${BRAND.white};text-decoration:none;border-radius:6px;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`;
}

export function emailHeading(text: string): string {
  return `<h1 style="margin:0 0 16px;font-family:${HEADING_FONT};font-size:22px;font-weight:700;color:${BRAND.primary};line-height:1.3;text-align:center;">${text}</h1>`;
}

export function emailDivider(): string {
  return `<hr style="border:none;border-top:1px solid ${BRAND.border};margin:24px 0;">`;
}

export function emailParagraph(html: string): string {
  return `<p style="margin:0 0 14px;font-family:${FONT};font-size:15px;line-height:1.6;color:${BRAND.foreground};text-align:center;">${html}</p>`;
}

export function emailInfoBox(
  html: string,
  variant: "neutral" | "warning" | "error" = "neutral",
): string {
  const styles = {
    neutral: { bg: BRAND.surface, border: BRAND.border, text: BRAND.foreground },
    warning: { bg: "#fffbf0", border: "#c8a94e", text: "#5c3d0e" },
    error: { bg: "#fef2f2", border: "#c27171", text: "#6b2222" },
  };
  const s = styles[variant];
  return `<div style="margin:16px 0;padding:14px 18px;background:${s.bg};border-left:3px solid ${s.border};border-radius:4px;">
    <p style="margin:0;font-family:${FONT};font-size:14px;line-height:1.6;color:${s.text};text-align:left;">${html}</p>
  </div>`;
}

export function emailTable(rows: Array<[string, string]>): string {
  const rowsHtml = rows
    .map(([label, value], i) => {
      const borderBottom =
        i < rows.length - 1 ? `border-bottom:1px solid ${BRAND.border};` : "";
      return `<tr>
      <td style="padding:9px 12px;${borderBottom}font-family:${FONT};font-size:13px;color:${BRAND.muted};white-space:nowrap;">${label}</td>
      <td style="padding:9px 12px;${borderBottom}font-family:${FONT};font-size:14px;color:${BRAND.foreground};font-weight:600;">${value}</td>
    </tr>`;
    })
    .join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid ${BRAND.border};border-radius:6px;border-collapse:separate;overflow:hidden;">
    ${rowsHtml}
  </table>`;
}

export function emailSmall(html: string): string {
  return `<p style="margin:12px 0 0;font-family:${FONT};font-size:13px;line-height:1.5;color:${BRAND.muted};text-align:center;">${html}</p>`;
}
