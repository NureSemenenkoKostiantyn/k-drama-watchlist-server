import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { type Environment } from "../../config/environment";

interface TelegramInlineButton {
  text: string;
  url?: string;
  web_app?: { url: string };
}

@Injectable()
export class TelegramApiService {
  private readonly logger = new Logger(TelegramApiService.name);

  constructor(
    private readonly configService: ConfigService<Environment, true>,
  ) {}

  async sendMessage(
    chatId: string,
    text: string,
    buttons: TelegramInlineButton[][] = [],
  ): Promise<void> {
    const token = this.configService.getOrThrow<string>(
      "TELEGRAM_BOT_TOKEN",
    );

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            ...(buttons.length === 0
              ? {}
              : { reply_markup: { inline_keyboard: buttons } }),
          }),
          signal: AbortSignal.timeout(5_000),
        },
      );

      if (!response.ok) {
        const body = await response.text();

        this.logger.warn(
        {
          statusCode: response.status,
          telegramResponse: body,
        },
          "Telegram rejected a bot message",
      );

      return;
}
    } catch (error: unknown) {
      this.logger.warn(
        { errorName: errorName(error) },
        "Telegram bot message delivery failed",
      );
    }
  }
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}
