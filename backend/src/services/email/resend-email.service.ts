import { Resend } from "resend";
import { getEnv } from "../../config/env.js";
import type { EmailMessage, EmailService } from "./email.types.js";

export class ResendEmailService implements EmailService {
  private readonly client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async send(message: EmailMessage): Promise<void> {
    const env = getEnv();
    const result = await this.client.emails.send({
      from: env.EMAIL_FROM,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });

    if (result.error) {
      throw new Error(result.error.message);
    }
  }
}
