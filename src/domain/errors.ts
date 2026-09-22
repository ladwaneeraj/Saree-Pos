/** An expected business-rule violation. The message is safe to show to users. */
export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: string = "RULE_VIOLATION",
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof DomainError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong";
}
