import type { RefreshTokenServicePort } from "../ports/RefreshTokenServicePort";

export class FakeRefreshTokenService implements RefreshTokenServicePort {
  private counter = 0;

  generate(): string {
    this.counter++;
    return "fake-refresh-token-" + "x".repeat(20) + "-" + this.counter;
  }

  hashToken(rawToken: string): string {
    return `sha256:${rawToken}`;
  }
}
