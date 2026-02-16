export interface RefreshTokenServicePort {
  generate(): string;
  hashToken(rawToken: string): string;
}
