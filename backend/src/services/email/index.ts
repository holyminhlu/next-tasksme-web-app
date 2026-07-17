import { getEnv } from "../../config/env.js";
import { ConsoleEmailService } from "./console-email.service.js";
import { ResendEmailService } from "./resend-email.service.js";
import type { EmailService } from "./email.types.js";

let emailService: EmailService | null = null;

export function getEmailService(): EmailService {
  if (emailService) {
    return emailService;
  }

  const env = getEnv();

  if (env.isTest || !env.RESEND_API_KEY) {
    emailService = new ConsoleEmailService();
  } else {
    emailService = new ResendEmailService(env.RESEND_API_KEY);
  }

  return emailService;
}

export function setEmailService(service: EmailService): void {
  emailService = service;
}

export function resetEmailService(): void {
  emailService = null;
}

export type { EmailMessage, EmailService } from "./email.types.js";
