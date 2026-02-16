import crypto from "crypto";
import type { RefreshTokenServicePort } from "@/application/ports/RefreshTokenServicePort";

export class CryptoRefreshTokenService implements RefreshTokenServicePort {
  generate(): string {
    return crypto.randomBytes(32).toString("base64url");
  }

  hashToken(rawToken: string): string {
    return crypto.createHash("sha256").update(rawToken).digest("hex");
  }
}
