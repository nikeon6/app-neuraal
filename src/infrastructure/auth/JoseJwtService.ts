import { SignJWT, jwtVerify } from "jose";
import type {
  AccessTokenPayload,
  JwtServicePort,
} from "@/application/ports/JwtServicePort";

export class JoseJwtService implements JwtServicePort {
  private readonly secret: Uint8Array;

  constructor(secret: string) {
    this.secret = new TextEncoder().encode(secret);
  }

  async sign(payload: AccessTokenPayload, ttlSeconds: number): Promise<string> {
    return new SignJWT({ sub: payload.sub, email: payload.email })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(`${ttlSeconds}s`)
      .sign(this.secret);
  }

  async verify(token: string): Promise<AccessTokenPayload | null> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        algorithms: ["HS256"],
      });

      if (
        typeof payload.sub !== "string" ||
        typeof payload.email !== "string"
      ) {
        return null;
      }

      return { sub: payload.sub, email: payload.email };
    } catch {
      return null;
    }
  }
}
