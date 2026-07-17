import { describe, expect, it } from "vitest";
import { formatErrorReference, getErrorReference } from "./error-info";

describe("getErrorReference", () => {
  it("extracts the digest from a Next.js server error", () => {
    const error = Object.assign(new Error("boom"), { digest: "abc123" });
    expect(getErrorReference(error)).toEqual({ digest: "abc123" });
  });

  it("extracts a backend request ID when present", () => {
    const error = Object.assign(new Error("boom"), {
      requestId: "req-42",
      digest: "abc123",
    });
    expect(getErrorReference(error)).toEqual({
      digest: "abc123",
      requestId: "req-42",
    });
  });

  it("ignores non-string or empty identifiers", () => {
    const error = Object.assign(new Error("boom"), {
      digest: "",
      requestId: 42,
    });
    expect(getErrorReference(error)).toEqual({});
  });

  it("handles non-object errors safely", () => {
    expect(getErrorReference(null)).toEqual({});
    expect(getErrorReference(undefined)).toEqual({});
    expect(getErrorReference("boom")).toEqual({});
  });
});

describe("formatErrorReference", () => {
  it("prefers the request ID over the digest", () => {
    expect(
      formatErrorReference({ requestId: "req-42", digest: "abc123" }),
    ).toBe("Request ID: req-42");
  });

  it("falls back to the digest", () => {
    expect(formatErrorReference({ digest: "abc123" })).toBe(
      "Error reference: abc123",
    );
  });

  it("returns null when nothing is available", () => {
    expect(formatErrorReference({})).toBeNull();
  });
});
