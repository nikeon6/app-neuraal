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
 *
 * Uses HTML `align` attributes (not CSS-only centering), `<tbody>` for
 * strict table structure, an outer wrapper table with background for
 * clients that strip body styles, VML conditional for the CTA button
 * in Outlook, and CSS classes for dark-mode overrides.
 */
export function emailBody(p: EmailBodyParams): string {
  return `
<table role="presentation" border="0" width="100%" cellpadding="0" cellspacing="0" class="email-outer-bg" style="background-color:#f4f4f5;font-family:${FONT_STACK};">
  <tbody>
    <tr>
      <td align="center" style="padding:40px 8px;">
        <table role="presentation" border="0" width="480" cellpadding="0" cellspacing="0" class="email-container" style="max-width:480px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;">
          <tbody>
            <tr>
              <td align="center" style="padding:32px 20px 24px 20px;">
                <img src="${p.logoSrc}" alt="Neuraal" width="210" height="180" style="display:block;max-width:210px;border:0;outline:none;text-decoration:none;" />
              </td>
            </tr>
            <tr>
              <td align="left" style="padding:0 20px;">
                <h2 class="email-heading" style="color:#1a1a2e;margin:0 0 16px 0;">${p.heading}</h2>
              </td>
            </tr>
            <tr>
              <td align="left" style="padding:0 20px;">
                <p class="email-text" style="color:#555555;line-height:1.6;margin:0 0 8px 0;">${p.paragraph}</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:32px 20px;">
                <!--[if mso]>
                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${p.buttonUrl}" style="height:44px;v-text-anchor:middle;width:220px" arcsize="14%" fillcolor="#6366f1" stroke="false">
                  <w:anchorlock/>
                  <center style="color:#ffffff;font-family:sans-serif;font-size:16px;font-weight:600">${p.buttonLabel}</center>
                </v:roundrect>
                <![endif]-->
                <!--[if !mso]><!-->
                <a href="${p.buttonUrl}" target="_blank" style="display:inline-block;background-color:#6366f1;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:600;font-size:16px;">
                  <span style="max-width:100%;display:inline-block;line-height:120%;mso-padding-alt:0px;mso-text-raise:9px;">${p.buttonLabel}</span>
                </a>
                <!--<![endif]-->
              </td>
            </tr>
            <tr>
              <td align="left" style="padding:0 20px;">
                <p class="email-footnote" style="color:#888888;font-size:13px;line-height:1.5;margin:0;">${p.footnote}</p>
              </td>
            </tr>
            <tr>
              <td align="left" style="padding:32px 20px;">
                <table role="presentation" border="0" width="100%" cellpadding="0" cellspacing="0">
                  <tbody>
                    <tr>
                      <td class="email-separator" style="border-top:1px solid #eeeeee;padding-top:24px;">
                        <p class="email-footer" style="color:#aaaaaa;font-size:12px;margin:0;">Neuraal</p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  </tbody>
</table>`;
}

/**
 * Wraps email body content in a valid HTML document.
 *
 * Uses XHTML 1.0 Transitional for maximum compatibility with Outlook
 * and other desktop clients that use the Word rendering engine.
 * Includes MSO conditionals, Apple Mail reformatting fix, and
 * dark-mode support via color-scheme + @media prefers-color-scheme.
 */
export function buildEmailDocument(title: string, bodyContent: string): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${title}</title>
  <!--[if mso]>
  <style type="text/css">
    table { border-collapse: collapse; }
    td { font-family: Arial, sans-serif; }
  </style>
  <![endif]-->
  <style>
    :root { color-scheme: light dark; supported-color-schemes: light dark; }
    @media (prefers-color-scheme: dark) {
      .email-outer-bg { background-color: #1a1a1a !important; }
      .email-container { background-color: #2d2d2d !important; }
      .email-heading { color: #e5e7eb !important; }
      .email-text { color: #d1d5db !important; }
      .email-footnote { color: #9ca3af !important; }
      .email-footer { color: #6b7280 !important; }
      .email-separator { border-top-color: #4b5563 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;">
${bodyContent}
</body>
</html>`;
}
