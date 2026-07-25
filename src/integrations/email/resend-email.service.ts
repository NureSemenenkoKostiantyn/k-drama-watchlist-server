import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type Resend } from "resend";

import { type Environment } from "../../config/environment";
import { RESEND_CLIENT } from "./email.constants";
import {
  type AuthenticationEmailInput,
  TransactionalEmailService,
} from "./transactional-email.service";

@Injectable()
export class ResendEmailService extends TransactionalEmailService {
  private readonly logger = new Logger(ResendEmailService.name);
  private readonly sender: string;

  constructor(
    @Inject(RESEND_CLIENT) private readonly resend: Resend,
    configService: ConfigService<Environment, true>,
  ) {
    super();
    this.sender = configService.getOrThrow("EMAIL_FROM");
  }

  async sendEmailVerification(
    input: AuthenticationEmailInput,
  ): Promise<void> {
    await this.send({
      ...input,
      buttonLabel: "Verify email",
      heading: "Verify your email",
      introduction:
        "Confirm this email address to finish setting up your Drama Watch account.",
      subject: "Verify your Drama Watch email",
    });
  }

  async sendPasswordReset(
    input: AuthenticationEmailInput,
  ): Promise<void> {
    await this.send({
      ...input,
      buttonLabel: "Reset password",
      heading: "Reset your password",
      introduction:
        "Use this secure link to choose a new password for your Drama Watch account.",
      subject: "Reset your Drama Watch password",
    });
  }

  private async send(
    input: AuthenticationEmailInput & {
      buttonLabel: string;
      heading: string;
      introduction: string;
      subject: string;
    },
  ): Promise<void> {
    const recipientName = input.recipientName.trim() || "there";
    const response = await this.sendThroughProvider({
      from: this.sender,
      to: input.recipientEmail,
      subject: input.subject,
      html: renderHtmlEmail({
        actionUrl: input.actionUrl,
        buttonLabel: input.buttonLabel,
        heading: input.heading,
        introduction: input.introduction,
        recipientName,
      }),
      text: renderTextEmail({
        actionUrl: input.actionUrl,
        introduction: input.introduction,
        recipientName,
      }),
    });

    if (response.error) {
      this.logger.error(
        `Resend rejected an authentication email: ${response.error.name} (${response.error.statusCode ?? "unknown status"})`,
      );
      throw new Error("Transactional email delivery failed.");
    }
  }

  private async sendThroughProvider(
    email: Parameters<Resend["emails"]["send"]>[0],
  ): ReturnType<Resend["emails"]["send"]> {
    try {
      return await this.resend.emails.send(email);
    } catch (error: unknown) {
      this.logger.error(
        `Resend authentication email request failed: ${readErrorName(error)}`,
      );
      throw new Error("Transactional email delivery failed.");
    }
  }
}

interface EmailTemplateInput {
  actionUrl: string;
  buttonLabel?: string;
  heading?: string;
  introduction: string;
  recipientName: string;
}

function renderHtmlEmail(input: Required<EmailTemplateInput>): string {
  const actionUrl = escapeHtml(input.actionUrl);
  const buttonLabel = escapeHtml(input.buttonLabel);
  const heading = escapeHtml(input.heading);
  const introduction = escapeHtml(input.introduction);
  const recipientName = escapeHtml(input.recipientName);

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#100d18;color:#f7f3ff;font-family:Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;padding:48px 24px">
      <p style="margin:0 0 24px;color:#d8a7ff;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase">Drama Watch</p>
      <h1 style="margin:0 0 16px;font-size:30px;line-height:1.2">${heading}</h1>
      <p style="margin:0 0 12px;line-height:1.65">Hi ${recipientName},</p>
      <p style="margin:0 0 28px;color:#d7d0e3;line-height:1.65">${introduction}</p>
      <a href="${actionUrl}" style="display:inline-block;padding:14px 20px;border-radius:10px;background:#d8a7ff;color:#100d18;font-weight:700;text-decoration:none">${buttonLabel}</a>
      <p style="margin:28px 0 0;color:#aaa1b8;font-size:13px;line-height:1.6">This link expires in one hour. If you did not request this email, you can safely ignore it.</p>
    </div>
  </body>
</html>`;
}

function renderTextEmail(input: EmailTemplateInput): string {
  return `Hi ${input.recipientName},

${input.introduction}

${input.actionUrl}

This link expires in one hour. If you did not request this email, you can safely ignore it.`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function readErrorName(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    typeof error.name === "string"
  ) {
    return error.name;
  }

  return "unknown error";
}
