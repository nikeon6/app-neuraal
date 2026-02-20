import type { EmailMessage, EmailServicePort } from "../ports/EmailServicePort";

export class FakeEmailService implements EmailServicePort {
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }
}
