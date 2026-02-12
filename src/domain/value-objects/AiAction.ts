import { Result, ok, err } from "../core/Result";

const VALID_ACTIONS = ["SUMMARY"] as const;
export type AiActionType = (typeof VALID_ACTIONS)[number];

/**
 * AI action type value object (SUMMARY, future: TRANSCRIPT, OCR, etc.).
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

  toString(): string {
    return this.value;
  }

  equals(other: AiAction): boolean {
    return this.value === other.value;
  }
}
