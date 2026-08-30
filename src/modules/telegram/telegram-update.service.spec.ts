import type { ConfigService } from "@nestjs/config";
import { jest } from "@jest/globals";

import { type Environment } from "../../config/environment";
import type { TelegramApiService } from "./telegram-api.service";
import type { TelegramLinkService } from "./telegram-link.service";
import type { TelegramRepository } from "./telegram.repository";
import { TelegramUpdateService } from "./telegram-update.service";

describe("TelegramUpdateService", () => {
  const consumeLink = jest.fn<TelegramLinkService["consumeLink"]>();
  const claimUpdate = jest.fn<TelegramRepository["claimUpdate"]>();
  const releaseUpdate = jest.fn<TelegramRepository["releaseUpdate"]>();
  const sendMessage = jest.fn<TelegramApiService["sendMessage"]>();
  const linkService = {
    isEnabled: jest.fn(() => true),
    consumeLink,
  } as unknown as TelegramLinkService;
  const repository = {
    claimUpdate,
    releaseUpdate,
  } as unknown as TelegramRepository;
  const telegramApi = { sendMessage } as unknown as TelegramApiService;
  const configService = {
    getOrThrow: jest.fn((key: keyof Environment) => {
      const values: Partial<Environment> = {
        TELEGRAM_WEBHOOK_SECRET:
          "telegram_webhook_secret_with_32_chars",
        TELEGRAM_MINI_APP_URL: "https://dahyun.best/telegram",
        FRONTEND_URL: "https://dahyun.best",
      };
      return values[key];
    }),
  } as unknown as ConfigService<Environment, true>;

  beforeEach(() => {
    jest.clearAllMocks();
    claimUpdate.mockResolvedValue(true);
    releaseUpdate.mockResolvedValue(undefined);
    consumeLink.mockResolvedValue({ enabled: true, connected: true });
    sendMessage.mockResolvedValue(undefined);
  });

  it("rejects a webhook with the wrong secret before claiming the update", async () => {
    const service = createService();

    await expect(service.handle("wrong", { update_id: 1 })).rejects.toMatchObject({
      code: "TELEGRAM_WEBHOOK_UNAUTHORIZED",
    });
    expect(claimUpdate).not.toHaveBeenCalled();
  });

  it("consumes a private-chat account link and sends the Mini App button", async () => {
    const service = createService();

    await service.handle("telegram_webhook_secret_with_32_chars", {
      update_id: 42,
      message: {
        text: "/start link_single_use_token",
        chat: { id: 123456, type: "private" },
        from: {
          id: 123456,
          first_name: "Demo",
          last_name: "Viewer",
          username: "viewer",
        },
      },
    });

    expect(consumeLink).toHaveBeenCalledWith("single_use_token", {
      telegramUserId: "123456",
      privateChatId: "123456",
      telegramUsername: "viewer",
      telegramDisplayName: "Demo Viewer",
    });
    expect(sendMessage).toHaveBeenCalledWith(
      "123456",
      "Telegram is connected to your Drama Watch account.",
      [[{ text: "Open Drama Watch", web_app: { url: "https://dahyun.best/telegram" } }]],
    );
  });

  it("ignores an update that has already been claimed", async () => {
    claimUpdate.mockResolvedValue(false);
    const service = createService();

    await service.handle("telegram_webhook_secret_with_32_chars", {
      update_id: 42,
    });

    expect(sendMessage).not.toHaveBeenCalled();
  });

  function createService(): TelegramUpdateService {
    return new TelegramUpdateService(
      configService,
      linkService,
      repository,
      telegramApi,
    );
  }
});
