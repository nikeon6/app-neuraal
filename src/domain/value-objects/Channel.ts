import { Result, ok, err } from "../core/Result";

/**
 * Channel value object.
 * Represents a notification channel (e.g., "whatsapp", "email", "push").
 */
export class Channel {
  private readonly value: string;

  // Allowed channels for MVP
  static readonly ALLOWED_CHANNELS = [
    "whatsapp",
    "email",
    "push",
    "sms",
  ] as const;

  private constructor(value: string) {
    this.value = value;
  }

  /**
   * Creates a Channel from a string.
   * Validates that the channel is non-empty and allowed.
   */
  static create(value: string): Result<Channel, string> {
    if (!value || value.trim().length === 0) {
      return err("Channel cannot be empty");
    }

    const normalized = value.trim().toLowerCase();

    if (
      !Channel.ALLOWED_CHANNELS.includes(
        normalized as (typeof Channel.ALLOWED_CHANNELS)[number],
      )
    ) {
      return err(
        `Invalid channel. Allowed: ${Channel.ALLOWED_CHANNELS.join(", ")}`,
      );
    }

    return ok(new Channel(normalized));
  }

  toString(): string {
    return this.value;
  }

  equals(other: Channel): boolean {
    return this.value === other.value;
  }
}
