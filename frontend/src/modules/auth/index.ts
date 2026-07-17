export { AuthProvider, useAuth } from "./AuthProvider";
export { AuthGate } from "./AuthGate";
export { Can } from "./Can";
export { AuthCard } from "./components/AuthCard";
export { FormError } from "./components/FormError";
export { PasswordField } from "./components/PasswordField";
export * from "./auth.types";
export * as authService from "./auth.service";
export { hasPermission, permissionsForRole, ROLE_PERMISSION_MAP } from "./permissions";
export {
  normalizeEmail,
  passwordsMatch,
  validatePasswordStrength,
  validateRegisterForm,
  validateResetPasswordForm,
} from "./validation";
