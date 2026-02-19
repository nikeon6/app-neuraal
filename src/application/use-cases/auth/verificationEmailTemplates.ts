export function buildVerificationEmailHtml(
  verifyUrl: string,
  ttlHours: number,
  appBaseUrl: string,
): string {
  const logoUrl = `${appBaseUrl}/branding/lockups/Neuraal_Negro_Logotipo.svg`;

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <img src="${logoUrl}" alt="Neuraal" width="160" height="auto" style="display: inline-block; max-width: 160px; height: auto;" />
      </div>
      <h2 style="color: #1a1a2e; margin-bottom: 16px;">Verify your email</h2>
      <p style="color: #555; line-height: 1.6;">
        Thanks for signing up! Click the button below to verify your email address.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${verifyUrl}"
           style="display: inline-block; background: #6366f1; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">
          Verify email
        </a>
      </div>
      <p style="color: #888; font-size: 13px; line-height: 1.5;">
        This link expires in ${ttlHours} hours. If you didn&rsquo;t create an account, you can safely ignore this email.
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
      <p style="color: #aaa; font-size: 12px;">Neuraal</p>
    </div>
  `.trim();
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
