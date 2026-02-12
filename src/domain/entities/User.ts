import { Result, ok, err } from "../core/Result";
import { Email } from "../value-objects/Email";
import { PasswordHash } from "../value-objects/PasswordHash";

export interface UserProps {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export class User {
  readonly id: string;
  readonly email: Email;
  readonly passwordHash: PasswordHash;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(
    id: string,
    email: Email,
    passwordHash: PasswordHash,
    createdAt: Date,
    updatedAt: Date
  ) {
    this.id = id;
    this.email = email;
    this.passwordHash = passwordHash;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static create(props: UserProps): Result<User, string> {
    if (!props.id || props.id.trim().length === 0) {
      return err("User id cannot be empty");
    }

    const emailResult = Email.create(props.email);
    if (emailResult.isErr()) {
      return err(emailResult.error);
    }

    const hashResult = PasswordHash.create(props.passwordHash);
    if (hashResult.isErr()) {
      return err(hashResult.error);
    }

    return ok(
      new User(
        props.id.trim(),
        emailResult.value,
        hashResult.value,
        props.createdAt,
        props.updatedAt
      )
    );
  }

  toJSON(): { id: string; email: string; passwordHash: string; createdAt: Date; updatedAt: Date } {
    return {
      id: this.id,
      email: this.email.toString(),
      passwordHash: this.passwordHash.toString(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
