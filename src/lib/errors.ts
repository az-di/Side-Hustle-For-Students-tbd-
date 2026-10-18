/**
 * One error type for everything a user can be told about.
 *
 * Server actions catch AppError and hand `message` to the UI; anything else is
 * logged and becomes a generic apology, so an internal detail never ends up on
 * screen.
 */
export class AppError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_FOUND"
      | "NOT_ALLOWED"
      | "INVALID"
      | "CONFLICT" // someone else changed it first (or a double-click)
      | "PAUSED",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = (what: string) => new AppError(`${what} not found.`, "NOT_FOUND");
export const notAllowed = (message = "You are not allowed to do that.") => new AppError(message, "NOT_ALLOWED");
export const invalid = (message: string) => new AppError(message, "INVALID");

/**
 * Raised when an optimistic `WHERE status = ?` update affects zero rows: the
 * row moved under us. On a demo stage this is almost always a double-click.
 */
export const conflict = (message = "That already changed — reload and try again.") =>
  new AppError(message, "CONFLICT");

export function toUserMessage(err: unknown, fallback = "Something went wrong. Try again."): string {
  if (err instanceof AppError) return err.message;
  console.error(err);
  return fallback;
}
