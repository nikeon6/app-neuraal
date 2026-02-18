export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailServicePort {
  send(message: EmailMessage): Promise<void>;
}
