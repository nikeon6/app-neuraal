import { buildEmailDocument, emailBody, LOGO_CID } from "./emailLayout";

export function buildVerificationEmailHtml(
  verifyUrl: string,
  ttlHours: number,
): string {
  const body = emailBody({
    logoSrc: `cid:${LOGO_CID}`,
    heading: "Verify your email",
    paragraph:
      "Thanks for signing up! Click the button below to verify your email address.",
    buttonUrl: verifyUrl,
    buttonLabel: "Verify email",
    footnote: `This link expires in ${ttlHours} hours. If you didn&#8217;t create an account, you can safely ignore this email.`,
  });

  return buildEmailDocument("Verify your email", body);
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
