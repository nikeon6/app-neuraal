import { Result, ok, err } from "../core/Result";

const VALID_ACTIONS = [
  "SUMMARY",
  "TRANSCRIPT_YOUTUBE",
  "OCR_IMAGE",
  "REMINDER_WHATSAPP",
] as const;
export type AiActionType = (typeof VALID_ACTIONS)[number];

/**
 * AI action type value object.
 */
export class AiAction {
  private readonly value: AiActionType;

  private constructor(value: AiActionType) {
    this.value = value;
  }

  static create(value: string): Result<AiAction, string> {
    if (!value || value.trim().length === 0) {
      return err("Action cannot be empty");
    }
    const normalized = value.trim().toUpperCase();
    if (!VALID_ACTIONS.includes(normalized as AiActionType)) {
      return err(`Unknown AI action: ${value}`);
    }
    return ok(new AiAction(normalized as AiActionType));
  }

  static summary(): AiAction {
    return new AiAction("SUMMARY");
  }

  static transcriptYoutube(): AiAction {
    return new AiAction("TRANSCRIPT_YOUTUBE");
  }

  static ocrImage(): AiAction {
    return new AiAction("OCR_IMAGE");
  }

  static reminderWhatsapp(): AiAction {
    return new AiAction("REMINDER_WHATSAPP");
  }

  toString(): string {
    return this.value;
  }

  equals(other: AiAction): boolean {
    return this.value === other.value;
  }
}
