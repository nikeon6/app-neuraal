/**
 * Result type for handling success/failure without exceptions.
 * Inspired by Rust's Result type.
 *
 * @example
 * const result = HexColor.create("#3b82f6");
 * if (result.isOk()) {
 *   console.log(result.value.toString());
 * } else {
 *   console.error(result.error);
 * }
 */

export type Result<T, E = string> = Ok<T, E> | Err<T, E>;

export class Ok<T, E = string> {
  readonly value: T;

  constructor(value: T) {
    this.value = value;
  }

  isOk(): this is Ok<T, E> {
    return true;
  }

  isErr(): this is Err<T, E> {
    return false;
  }

  map<U>(fn: (value: T) => U): Result<U, E> {
    return ok(fn(this.value));
  }

  mapErr<F>(_fn: (error: E) => F): Result<T, F> {
    return ok(this.value);
  }

  unwrap(): T {
    return this.value;
  }

  unwrapOr(_defaultValue: T): T {
    return this.value;
  }
}

export class Err<T, E = string> {
  readonly error: E;

  constructor(error: E) {
    this.error = error;
  }

  isOk(): this is Ok<T, E> {
    return false;
  }

  isErr(): this is Err<T, E> {
    return true;
  }

  map<U>(_fn: (value: T) => U): Result<U, E> {
    return err(this.error);
  }

  mapErr<F>(fn: (error: E) => F): Result<T, F> {
    return err(fn(this.error));
  }

  unwrap(): T {
    throw new Error(`Called unwrap on Err: ${this.error}`);
  }

  unwrapOr(defaultValue: T): T {
    return defaultValue;
  }
}

/**
 * Creates a successful Result.
 */
export function ok<T, E = string>(value: T): Result<T, E> {
  return new Ok(value);
}

/**
 * Creates a failed Result.
 */
export function err<T, E = string>(error: E): Result<T, E> {
  return new Err(error);
}
