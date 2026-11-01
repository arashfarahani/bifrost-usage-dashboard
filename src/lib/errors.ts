const messages = {
  INVALID_TOKEN:
    "This access link is invalid. Please request a new personal link.",
  EXPIRED_TOKEN: "This access link has expired. Please request a new one.",
  INVALID_SESSION:
    "Your session has expired or is invalid. Please reopen your personal access link.",
  KEY_NOT_FOUND:
    "Your key was not found in the LLM Gateway. Contact your infrastructure team.",
  KEY_INACTIVE: "Your key is inactive. Dashboard access is unavailable.",
  KEY_EXPIRED: "Your LLM Gateway key has expired.",
  BIFROST_AUTH:
    "The LLM Gateway rejected the management credentials. Contact your infrastructure team.",
  BIFROST_REDIRECT:
    "The LLM Gateway address redirects to a sign-in page. Ask your administrator to configure a direct private API connection.",
  BIFROST_UNAVAILABLE:
    "Unable to connect to the LLM Gateway. Please try again shortly.",
  BIFROST_TIMEOUT:
    "The LLM Gateway took too long to respond. Please try again.",
  UPSTREAM_SCHEMA: "The LLM Gateway returned an unsupported response format.",
  ANALYTICS_UNAVAILABLE:
    "A complete usage report is unavailable for this period. Please try a shorter date range.",
  ANALYTICS_LIMIT:
    "This report exceeds the processing limit. Please select a shorter date range.",
  RATE_LIMITED: "Too many requests. Please try again in one minute.",
  INVALID_INPUT: "The supplied information or date range is invalid.",
  FORBIDDEN:
    "This request is not allowed. Please open the application at its primary address.",
  CONFIGURATION:
    "The service configuration is incomplete. Contact your infrastructure team.",
  INTERNAL: "Something went wrong. Please try again shortly.",
} as const;
export type ErrorCode = keyof typeof messages;
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public status = 400,
  ) {
    super(messages[code]);
    this.name = "AppError";
  }
}
export function safeError(error: unknown): AppError {
  return error instanceof AppError ? error : new AppError("INTERNAL", 500);
}
