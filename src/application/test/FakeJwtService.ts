import type { AccessTokenPayload, JwtServicePort } from "../ports/JwtServicePort";

export class FakeJwtService implements JwtServicePort {
  async sign(payload: AccessTokenPayload, _ttlSeconds: number): Promise<string> {
    return `fake-header.${btoa(JSON.stringify(payload))}.fake-signature`;
  }

  async verify(token: string): Promise<AccessTokenPayload | null> {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;
      return JSON.parse(atob(parts[1])) as AccessTokenPayload;
    } catch {
      return null;
    }
  }
}
