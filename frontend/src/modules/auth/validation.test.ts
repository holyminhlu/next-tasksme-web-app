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
      password: "Password123",
      confirmPassword: "Password124",
      acceptTerms: true,
    });

    expect(error).toBe("Passwords do not match");
  });

  it("requires terms acceptance", () => {
    const error = validateRegisterForm({
      fullName: "Owner User",
      email: "owner@example.com",
      password: "Password123",
      confirmPassword: "Password123",
      acceptTerms: false,
    });

    expect(error).toBe("You must accept the Terms of Service to continue");
  });

  it("rejects short full names", () => {
    const error = validateRegisterForm({
      fullName: "O",
      email: "owner@example.com",
      password: "Password123",
      confirmPassword: "Password123",
      acceptTerms: true,
    });

    expect(error).toBe("Full name must be at least 2 characters");
  });

  it("rejects short passwords on reset", () => {
    const error = validateResetPasswordForm({
      password: "short",
      confirmPassword: "short",
    });

    expect(error).toBe("Password must be at least 8 characters");
  });

  it("accepts a valid minimal register payload", () => {
    const error = validateRegisterForm({
      fullName: "Owner User",
      email: "owner@example.com",
      password: "Password123",
      confirmPassword: "Password123",
      acceptTerms: true,
    });

    expect(error).toBeNull();
  });
});
