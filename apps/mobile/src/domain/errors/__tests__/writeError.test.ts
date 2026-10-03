import { isRetryable, toWriteError, WriteError } from "@/domain/errors/writeError";

it.each([
  [{ message: "rate_limited", code: "P0001" }, "rate_limited"],
  [{ message: "not_authenticated", code: "28000" }, "not_authenticated"],
  [{ message: "new row violates check constraint", code: "23514" }, "invalid_input"],
  [{ message: "permission denied for function create_report", code: "42501" }, "not_allowed"],
  [new TypeError("Network request failed"), "offline"],
  [new Error("boom"), "unknown"],
  [null, "unknown"],
])("maps %p to %s", (input, code) => {
  expect(toWriteError(input).code).toBe(code);
});

it("keeps the original as the cause and shows safe copy", () => {
  const original = { message: "rate_limited", code: "P0001" };
  const error = toWriteError(original);

  expect(error.cause).toBe(original);
  expect(error.message).not.toMatch(/rate_limited|P0001/);
});

it("only treats transient failures as retryable", () => {
  expect(isRetryable(new WriteError("offline"))).toBe(true);
  expect(isRetryable(new WriteError("unknown"))).toBe(true);
  expect(isRetryable(new WriteError("rate_limited"))).toBe(false);
  expect(isRetryable(new WriteError("invalid_input"))).toBe(false);
});
