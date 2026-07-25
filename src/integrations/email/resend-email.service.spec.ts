import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { jest } from "@jest/globals";
import { type Resend } from "resend";

import { type Environment } from "../../config/environment";
import { ResendEmailService } from "./resend-email.service";

describe("ResendEmailService", () => {
  const send = jest.fn<Resend["emails"]["send"]>();
  const loggerError = jest
    .spyOn(Logger.prototype, "error")
    .mockImplementation(() => undefined);
  const service = new ResendEmailService(
    {
      emails: { send },
    } as unknown as Resend,
    new ConfigService<Environment, true>({
      EMAIL_FROM: "Drama Watch <auth@example.com>",
    } as Environment),
  );

  beforeEach(() => {
    loggerError.mockClear();
    send.mockReset();
    send.mockResolvedValue({
      data: { id: "email-id" },
      error: null,
      headers: {},
    });
  });

  it("sends an escaped verification email with text fallback", async () => {
    await service.sendEmailVerification({
      actionUrl: "https://dahyun.best/api/auth/verify-email?token=a&b=c",
      recipientEmail: "viewer@example.com",
      recipientName: '<Viewer & "Friend">',
    });

    const email = send.mock.calls[0]?.[0];

    expect(email?.from).toBe("Drama Watch <auth@example.com>");
    expect(email?.to).toBe("viewer@example.com");
    expect(email?.subject).toBe("Verify your Drama Watch email");
    expect(email?.html).toContain(
      "https://dahyun.best/api/auth/verify-email?token=a&amp;b=c",
    );
    expect(email?.text).toContain(
      "https://dahyun.best/api/auth/verify-email?token=a&b=c",
    );
    expect(email?.html).toContain(
      "&lt;Viewer &amp; &quot;Friend&quot;&gt;",
    );
  });

  it("sends password-reset content", async () => {
    await service.sendPasswordReset({
      actionUrl: "https://dahyun.best/reset-password?token=secret",
      recipientEmail: "viewer@example.com",
      recipientName: "Viewer",
    });

    const email = send.mock.calls[0]?.[0];

    expect(email?.subject).toBe("Reset your Drama Watch password");
    expect(email?.html).toContain("Reset password");
  });

  it("fails without exposing provider details to the caller", async () => {
    send.mockResolvedValue({
      data: null,
      error: {
        message: "Invalid API key",
        name: "invalid_api_key",
        statusCode: 401,
      },
      headers: {},
    });

    await expect(
      service.sendEmailVerification({
        actionUrl: "https://dahyun.best/verify",
        recipientEmail: "viewer@example.com",
        recipientName: "Viewer",
      }),
    ).rejects.toThrow("Transactional email delivery failed.");
    expect(loggerError).toHaveBeenCalledTimes(1);
  });

  it("turns provider request failures into a generic delivery error", async () => {
    send.mockRejectedValue(new Error("connection failed"));

    await expect(
      service.sendPasswordReset({
        actionUrl: "https://dahyun.best/reset-password?token=secret",
        recipientEmail: "viewer@example.com",
        recipientName: "Viewer",
      }),
    ).rejects.toThrow("Transactional email delivery failed.");
    expect(loggerError).toHaveBeenCalledTimes(1);
  });
});
