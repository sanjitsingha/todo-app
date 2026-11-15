/** Shortest password the register screen accepts. */
export const MIN_PASSWORD_LENGTH = 8;

/** A loose check, just enough to tell a finished email address from a half-typed one. */
export function isEmail(value: string): boolean {
  return /^\S+@\S+\.\S+$/.test(value.trim());
}
