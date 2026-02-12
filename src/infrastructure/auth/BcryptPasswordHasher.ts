import bcrypt from "bcryptjs";
import type { PasswordHasherPort } from "@/application/ports/PasswordHasherPort";

const SALT_ROUNDS = 12;

export class BcryptPasswordHasher implements PasswordHasherPort {
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
