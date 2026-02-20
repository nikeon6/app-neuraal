export const LOGO_CID = "logo@neuraal.app";

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

interface EmailBodyParams {
  logoSrc: string;
  heading: string;
  paragraph: string;
  buttonUrl: string;
  buttonLabel: string;
  footnote: string;
}

/**
 * Table-based email body that survives Gmail's translator.
 * All alignment uses HTML `align` attributes, not CSS-only centering.
 */
export function emailBody(p: EmailBodyParams): string {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:${FONT_STACK};">
  <tr>
    <td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">
        <tr>
          <td align="center" style="padding:40px 20px 32px 20px;">
            <img src="${p.logoSrc}" alt="Neuraal" width="160" style="display:block;max-width:160px;border:0;" />
          </td>
        </tr>
        <tr>
          <td align="left" style="padding:0 20px;">
            <h2 style="color:#1a1a2e;margin:0 0 16px 0;">${p.heading}</h2>
          </td>
        </tr>
        <tr>
          <td align="left" style="padding:0 20px;">
            <p style="color:#555555;line-height:1.6;margin:0 0 8px 0;">${p.paragraph}</p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:32px 20px;">
            <a href="${p.buttonUrl}" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:600;font-size:16px;">${p.buttonLabel}</a>
          </td>
        </tr>
        <tr>
          <td align="left" style="padding:0 20px;">
            <p style="color:#888888;font-size:13px;line-height:1.5;margin:0;">${p.footnote}</p>
          </td>
        </tr>
        <tr>
          <td align="left" style="padding:32px 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="border-top:1px solid #eeeeee;padding-top:24px;"><p style="color:#aaaaaa;font-size:12px;margin:0;">Neuraal</p></td></tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

/**
 * Wraps email body content in a valid HTML document so email
 * clients (especially Gmail) treat it as well-formed.
 */
export function buildEmailDocument(title: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;">
${bodyContent}
</body>
</html>`;
}
