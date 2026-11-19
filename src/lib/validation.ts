/** Shortest password the register and new password screens accept. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * What's wrong with a new password, to show under its field: nothing until something's typed,
 * then "At least 8 characters" until it's long enough.
 */
export function passwordProblem(password: string): string | null {
  return password.length > 0 && password.length < MIN_PASSWORD_LENGTH
    ? `At least ${MIN_PASSWORD_LENGTH} characters`
    : null;
}

/** A loose check, just enough to tell a finished email address from a half-typed one. */
export function isEmail(value: string): boolean {
  return /^\S+@\S+\.\S+$/.test(value.trim());
}
