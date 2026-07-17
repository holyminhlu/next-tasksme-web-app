import { describe, expect, it } from "vitest";
import {
  normalizeEmail,
  validateRegisterForm,
  validateResetPasswordForm,
} from "./validation";

describe("auth form validation", () => {
  it("normalizes email to lowercase trimmed value", () => {
    expect(normalizeEmail("  Owner@Example.COM ")).toBe("owner@example.com");
  });

  it("rejects mismatched register passwords", () => {
    const error = validateRegisterForm({
      fullName: "Owner User",
      email: "owner@example.com",
      companyName: "Acme",
      password: "Password123",
      confirmPassword: "Password124",
    });

    expect(error).toBe("Passwords do not match");
  });

  it("rejects short passwords on reset", () => {
    const error = validateResetPasswordForm({
      password: "short",
      confirmPassword: "short",
    });

    expect(error).toBe("Password must be at least 8 characters");
  });

  it("accepts a valid register payload", () => {
    const error = validateRegisterForm({
      fullName: "Owner User",
      email: "owner@example.com",
      companyName: "Acme SME",
      password: "Password123",
      confirmPassword: "Password123",
    });

    expect(error).toBeNull();
  });
});
