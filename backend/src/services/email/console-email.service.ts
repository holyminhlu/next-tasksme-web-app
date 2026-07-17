import { logger } from "../../config/logger.js";
import type { EmailMessage, EmailService } from "./email.types.js";

export class ConsoleEmailService implements EmailService {
  async send(message: EmailMessage): Promise<void> {
    logger.info(
      {
        to: message.to,
        subject: message.subject,
        text: message.text,
      },
      "Email sent via console transport",
    );
  }
}
