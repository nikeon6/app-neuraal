import { Result, ok, err } from "@/domain/core/Result";
import { buildEmailDocument } from "./emailLayout";
import { Email } from "@/domain/value-objects/Email";
import type { UserRepository } from "../../ports/UserRepository";
import type { PasswordResetTokenRepository } from "../../ports/PasswordResetTokenRepository";
import type { RefreshTokenServicePort } from "../../ports/RefreshTokenServicePort";
import type { ClockPort } from "../../ports/ClockPort";
import type { EmailServicePort } from "../../ports/EmailServicePort";
import type { UseCaseError } from "../../core/UseCaseError";
import { validationError } from "../../core/UseCaseError";

export interface RequestPasswordResetInput {
  email: string;
}

export class RequestPasswordReset {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordResetTokenRepository: PasswordResetTokenRepository,
    private readonly refreshTokenService: RefreshTokenServicePort,
    private readonly clock: ClockPort,
    private readonly resetTtlMinutes: number,
    private readonly emailService: EmailServicePort | null,
    private readonly appBaseUrl: string,
  ) {}

  async execute(
    input: RequestPasswordResetInput,
  ): Promise<Result<{ ok: true }, UseCaseError>> {
    const emailResult = Email.create(input.email);
    if (emailResult.isErr()) {
      return err(validationError(emailResult.error));
    }

    const user = await this.userRepository.findByEmail(
      emailResult.value.toString(),
    );

    if (user) {
      const rawToken = this.refreshTokenService.generate();
      const tokenHash = this.refreshTokenService.hashToken(rawToken);
      const now = this.clock.now();
      const expiresAt = new Date(
        now.getTime() + this.resetTtlMinutes * 60 * 1000,
      );

      await this.passwordResetTokenRepository.create({
        userId: user.id,
        tokenHash,
        expiresAt,
      });

      if (this.emailService) {
        const resetUrl = `${this.appBaseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
        try {
          await this.emailService.send({
            to: emailResult.value.toString(),
            subject: "Reset your password — Neuraal",
            html: buildResetEmailHtml(
              resetUrl,
              this.resetTtlMinutes,
              this.appBaseUrl,
            ),
            text: buildResetEmailText(resetUrl, this.resetTtlMinutes),
          });
        } catch {
          // Keep recover flow semantics: always return generic success.
        }
      }
    }

    return ok({ ok: true });
  }
}

function buildResetEmailHtml(
  resetUrl: string,
  ttlMinutes: number,
  appBaseUrl: string,
): string {
  const logoUrl = `${appBaseUrl}/branding/lockups/Neuraal_Negro_Logotipo.png`;

  return buildEmailDocument(
    "Reset your password",
    `
      <tr>
        <td align="center" style="padding:32px 0 24px 0;">
          <img src="${logoUrl}" alt="Neuraal" width="160" height="144" style="display:block;max-width:160px;height:auto;border:0;" />
        </td>
      </tr>
      <tr>
        <td style="padding:0 40px;">
          <h2 style="color:#1a1a2e;margin:0 0 16px 0;font-size:22px;">Reset your password</h2>
          <p style="color:#555555;line-height:1.6;margin:0 0 24px 0;font-size:15px;">
            We received a request to reset your password. Click the button below to choose a new one.
          </p>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:8px 40px 32px 40px;">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${resetUrl}" style="height:48px;v-text-anchor:middle;width:220px;" arcsize="25%" fillcolor="#6366f1">
            <w:anchorlock/>
            <center style="color:#ffffff;font-family:sans-serif;font-size:16px;font-weight:bold;">Reset password</center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-->
          <a href="${resetUrl}" style="display:inline-block;background-color:#6366f1;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:600;font-size:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;mso-hide:all;">
            Reset password
          </a>
          <!--<![endif]-->
        </td>
      </tr>
      <tr>
        <td style="padding:0 40px 32px 40px;">
          <p style="color:#888888;font-size:13px;line-height:1.5;margin:0 0 24px 0;">
            This link expires in ${ttlMinutes} minutes. If you didn&#8217;t request this, you can safely ignore this email.
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #eeeeee;padding-top:24px;"><p style="color:#aaaaaa;font-size:12px;margin:0;">Neuraal</p></td></tr></table>
        </td>
      </tr>`,
  );
}

function buildResetEmailText(resetUrl: string, ttlMinutes: number): string {
  return [
    "Reset your password",
    "",
    "We received a request to reset your password.",
    "Visit the following link to choose a new one:",
    "",
    resetUrl,
    "",
    `This link expires in ${ttlMinutes} minutes.`,
    "If you didn't request this, you can safely ignore this email.",
    "",
    "— Neuraal",
  ].join("\n");
}
