export interface AccessTokenPayload {
  sub: string; // userId
  email: string;
}

export interface JwtServicePort {
  sign(payload: AccessTokenPayload, ttlSeconds: number): Promise<string>;
  verify(token: string): Promise<AccessTokenPayload | null>;
}
