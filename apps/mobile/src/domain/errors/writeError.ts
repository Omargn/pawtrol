/**
 * Why a write failed, in terms the UI can act on. The server's RPCs raise
 * these keys (see docs/data-model.md → Errors); anything else is `unknown`.
 */
export type WriteErrorCode =
  | "not_authenticated"
  | "not_allowed"
  | "not_found"
  | "invalid_input"
  | "rate_limited"
  | "offline"
  | "unknown";

const COPY: Record<WriteErrorCode, string> = {
  not_authenticated: "Please sign in and try again.",
  not_allowed: "You can't do that.",
  not_found: "That report isn't available anymore.",
  invalid_input: "Some details aren't valid. Check them and try again.",
  rate_limited: "You've posted a lot in the last hour. Please try again later.",
  offline: "You're offline. Check your connection and try again.",
  unknown: "Something went wrong. Please try again.",
};

/** A failed write: `message` is safe to show, `cause` keeps the original for logs. */
export class WriteError extends Error {
  readonly code: WriteErrorCode;

  constructor(code: WriteErrorCode, cause?: unknown) {
    super(COPY[code], { cause });
    this.name = "WriteError";
    this.code = code;
  }
}

const SERVER_KEYS = new Set<WriteErrorCode>(["not_authenticated", "not_allowed", "not_found", "invalid_input", "rate_limited"]);

/** Whether retrying the same request could succeed. */
export function isRetryable(error: unknown) {
  return error instanceof WriteError && (error.code === "offline" || error.code === "unknown");
}

/**
 * Maps whatever a write rejected with to a WriteError. Server errors carry the
 * key as their message; check-constraint failures (23514) are bad input; a
 * fetch that never reached the server is offline.
 */
export function toWriteError(error: unknown): WriteError {
  if (error instanceof WriteError) return error;
  const record = (error ?? {}) as { message?: unknown; code?: unknown; name?: unknown };
  const message = typeof record.message === "string" ? record.message : "";
  if (SERVER_KEYS.has(message as WriteErrorCode)) return new WriteError(message as WriteErrorCode, error);
  if (record.code === "23514" || record.code === "22023") return new WriteError("invalid_input", error);
  if (record.code === "42501") return new WriteError("not_allowed", error);
  if (/network request failed|failed to fetch|network/i.test(message)) return new WriteError("offline", error);
  return new WriteError("unknown", error);
}
