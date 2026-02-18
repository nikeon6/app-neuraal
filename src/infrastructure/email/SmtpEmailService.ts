import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type {
  EmailMessage,
  EmailServicePort,
} from "@/application/ports/EmailServicePort";
import type { EmailConfig } from "./EmailConfig";

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
    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  }
}
