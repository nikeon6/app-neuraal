import path from "node:path";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type {
  EmailAttachment,
  EmailMessage,
  EmailServicePort,
} from "@/application/ports/EmailServicePort";
import type { EmailConfig } from "./EmailConfig";

const LOGO_CID = "logo@neuraal.app";

export class SmtpEmailService implements EmailServicePort {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: EmailConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.password,
      },
    });

    this.from = `"${config.fromName}" <${config.fromAddress}>`;
  }

  async send(message: EmailMessage): Promise<void> {
    const attachments = this.buildAttachments(message);

    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      attachments,
    });
  }

  private buildAttachments(message: EmailMessage): EmailAttachment[] {
    const attachments: EmailAttachment[] = [...(message.attachments ?? [])];

    if (
      message.html.includes(`cid:${LOGO_CID}`) &&
      !attachments.some((a) => a.cid === LOGO_CID)
    ) {
      attachments.push({
        filename: "logo.png",
        path: path.join(
          process.cwd(),
          "public/branding/lockups/Neuraal_Negro_Logotipo.png",
        ),
        cid: LOGO_CID,
        contentDisposition: "inline",
      });
    }

    return attachments;
  }
}
