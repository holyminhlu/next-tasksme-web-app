export type RegisterFormInput = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
};

export type ResetPasswordFormInput = {
  password: string;
  confirmPassword: string;
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function passwordsMatch(password: string, confirmPassword: string): boolean {
  return password === confirmPassword;
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters";
  }

  return null;
}

export function validateRegisterForm(input: RegisterFormInput): string | null {
  if (input.fullName.trim().length < 2) {
    return "Full name must be at least 2 characters";
  }

  if (!input.email.includes("@")) {
    return "Enter a valid email address";
  }

  const passwordError = validatePasswordStrength(input.password);
  if (passwordError) {
    return passwordError;
  }

  if (!passwordsMatch(input.password, input.confirmPassword)) {
    return "Passwords do not match";
  }

  if (!input.acceptTerms) {
    return "You must accept the Terms of Service to continue";
  }

  return null;
}

export function validateResetPasswordForm(
  input: ResetPasswordFormInput,
): string | null {
  const passwordError = validatePasswordStrength(input.password);
  if (passwordError) {
    return passwordError;
  }

  if (!passwordsMatch(input.password, input.confirmPassword)) {
    return "Passwords do not match";
  }

  return null;
}
