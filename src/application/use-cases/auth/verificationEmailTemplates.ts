import { buildEmailDocument } from "./emailLayout";

export function buildVerificationEmailHtml(
  verifyUrl: string,
  ttlHours: number,
  appBaseUrl: string,
): string {
  const logoUrl = `${appBaseUrl}/branding/lockups/Neuraal_Negro_Logotipo.png`;

  return buildEmailDocument(
    "Verify your email",
    `
      <tr>
        <td align="center" style="padding:32px 0 24px 0;">
          <img src="${logoUrl}" alt="Neuraal" width="160" height="144" style="display:block;max-width:160px;height:auto;border:0;" />
        </td>
      </tr>
      <tr>
        <td style="padding:0 40px;">
          <h2 style="color:#1a1a2e;margin:0 0 16px 0;font-size:22px;">Verify your email</h2>
          <p style="color:#555555;line-height:1.6;margin:0 0 24px 0;font-size:15px;">
            Thanks for signing up! Click the button below to verify your email address.
          </p>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:8px 40px 32px 40px;">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${verifyUrl}" style="height:48px;v-text-anchor:middle;width:200px;" arcsize="25%" fillcolor="#6366f1">
            <w:anchorlock/>
            <center style="color:#ffffff;font-family:sans-serif;font-size:16px;font-weight:bold;">Verify email</center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-->
          <a href="${verifyUrl}" style="display:inline-block;background-color:#6366f1;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:600;font-size:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;mso-hide:all;">
            Verify email
          </a>
          <!--<![endif]-->
        </td>
      </tr>
      <tr>
        <td style="padding:0 40px 32px 40px;">
          <p style="color:#888888;font-size:13px;line-height:1.5;margin:0 0 24px 0;">
            This link expires in ${ttlHours} hours. If you didn&#8217;t create an account, you can safely ignore this email.
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #eeeeee;padding-top:24px;"><p style="color:#aaaaaa;font-size:12px;margin:0;">Neuraal</p></td></tr></table>
        </td>
      </tr>`,
  );
}

export function buildVerificationEmailText(
  verifyUrl: string,
  ttlHours: number,
): string {
  return [
    "Verify your email",
    "",
    "Thanks for signing up!",
    "Visit the following link to verify your email address:",
    "",
    verifyUrl,
    "",
    `This link expires in ${ttlHours} hours.`,
    "If you didn't create an account, you can safely ignore this email.",
    "",
    "— Neuraal",
  ].join("\n");
}
