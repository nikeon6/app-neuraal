export interface EmailAttachment {
  filename: string;
  content?: Buffer | string;
  path?: string;
  cid?: string;
  contentType?: string;
  contentDisposition?: "inline" | "attachment";
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}

export interface EmailServicePort {
  send(message: EmailMessage): Promise<void>;
}
