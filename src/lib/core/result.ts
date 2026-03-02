// =============================
// Result type fort avec value / error
// =============================

export type Ok<T> = {
  readonly success: true;
  readonly value: T;
};

export type Err<E> = {
  readonly success: false;
  readonly error: E;
};

export type Result<T, E> = Ok<T> | Err<E>;

// =============================
// Factories
// =============================

export function ok<T>(value: T): Ok<T> {
  return { success: true, value };
}

export function err<E>(error: E): Err<E> {
  return { success: false, error };
}

// =============================
// Type Guards
// =============================

export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.success === true;
}

export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return result.success === false;