import { createHash, timingSafeEqual } from "node:crypto";

import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { ApiException } from "../../common/errors/api-exception";
import {
  type LibraryEntryResponse,
  WatchStatus,
} from "../../common/types/library.types";
import {
  type MediaSearchResponse,
  type MediaSummary,
  MediaType,
  SearchMediaType,
} from "../../common/types/media.types";
import { type Environment } from "../../config/environment";
import { LibraryService } from "../library/library.service";
import { MediaService } from "../media/media.service";
import { TelegramApiService } from "./telegram-api.service";
import { TelegramLinkService } from "./telegram-link.service";
import { TelegramRepository } from "./telegram.repository";

interface TelegramMessage {
  chatId: string;
  chatType: string;
  text?: string;
  userId: string;
  username?: string;
  displayName: string;
}

interface TelegramUpdate {
  updateId: number;
  message?: TelegramMessage;
  callbackQuery?: TelegramCallbackQuery;
}

interface TelegramCallbackQuery {
  id: string;
  chatId: string;
  chatType: string;
  userId: string;
  data: string;
}

interface TelegramCommand {
  name: string;
  argument?: string;
}

@Injectable()
export class TelegramUpdateService {
  constructor(
    private readonly configService: ConfigService<Environment, true>,
    private readonly linkService: TelegramLinkService,
    private readonly telegramRepository: TelegramRepository,
    private readonly libraryService: LibraryService,
    private readonly mediaService: MediaService,
    private readonly telegramApi: TelegramApiService,
  ) {}

  async handle(secret: string | undefined, input: unknown): Promise<void> {
    if (!this.linkService.isEnabled()) {
      throw telegramWebhookNotFound();
    }

    this.verifySecret(secret);
    const update = parseUpdate(input);
    const claimed = await this.telegramRepository.claimUpdate(
      update.updateId,
      new Date(),
    );

    if (!claimed) {
      return;
    }

    try {
      await this.process(update);
    } catch (error: unknown) {
      await this.telegramRepository.releaseUpdate(update.updateId);
      throw error;
    }
  }

  private async process(update: TelegramUpdate): Promise<void> {
    if (update.callbackQuery) {
      await this.processCallbackQuery(update.callbackQuery);
      return;
    }

    const message = update.message;

    if (!message || message.chatType !== "private") {
      return;
    }

    const command = readCommand(message.text);
    const startParameter = command?.name === "start" ? command.argument : null;

    if (startParameter?.startsWith("link_")) {
      const token = startParameter.slice("link_".length);

      try {
        await this.linkService.consumeLink(token, {
          telegramUserId: message.userId,
          privateChatId: message.chatId,
          telegramDisplayName: message.displayName,
          ...(message.username === undefined
            ? {}
            : { telegramUsername: message.username }),
        });
        await this.telegramApi.sendMessage(
          message.chatId,
          "Telegram is connected to your Drama Watch account.",
          [
            [
              {
                text: "Open Drama Watch",
                web_app: {
                  url: this.configService.getOrThrow<string>(
                    "TELEGRAM_MINI_APP_URL",
                  ),
                },
              },
            ],
          ],
        );
      } catch (error: unknown) {
        if (error instanceof ApiException) {
          await this.telegramApi.sendMessage(
            message.chatId,
            "That connection link has expired or cannot be used. Create a new link in Drama Watch settings.",
            [
              [
                {
                  text: "Open settings",
                  url: `${this.configService.getOrThrow<string>("FRONTEND_URL")}/settings`,
                },
              ],
            ],
          );
          return;
        }

        throw error;
      }

      return;
    }

    if (command?.name === "settings") {
      await this.sendSettingsMessage(message.chatId);
      return;
    }

    const connection =
      await this.telegramRepository.findConnectionByTelegramUserId(
        message.userId,
      );
    const isConnected = Boolean(connection);

    if (command?.name === "watching") {
      if (!connection) {
        await this.sendDisconnectedMessage(message.chatId);
        return;
      }

      const entries = await this.libraryService.list(
        connection.userId.toHexString(),
        WatchStatus.Watching,
      );
      await this.sendMiniAppMessage(
        message.chatId,
        formatWatchingMessage(entries),
      );
      return;
    }

    if (command?.name === "search") {
      if (!connection) {
        await this.sendDisconnectedMessage(message.chatId);
        return;
      }

      const query = command.argument;
      if (!query) {
        await this.sendMiniAppMessage(
          message.chatId,
          "Use /search followed by a title, for example: /search Goblin",
        );
        return;
      }

      if (query.length > 100) {
        await this.sendMiniAppMessage(
          message.chatId,
          "Search text must be 100 characters or fewer.",
        );
        return;
      }

      const results = await this.mediaService.search({
        q: query,
        type: SearchMediaType.All,
        page: 1,
      });
      await this.sendMiniAppMessage(
        message.chatId,
        formatSearchMessage(query, results),
      );
      return;
    }

    if (command?.name === "progress") {
      if (!connection) {
        await this.sendDisconnectedMessage(message.chatId);
        return;
      }

      const entries = await this.libraryService.list(
        connection.userId.toHexString(),
        WatchStatus.Watching,
      );
      const availableEntries = entries
        .filter((entry) => nextEpisodeProgress(entry) !== null)
        .slice(0, 8);

      if (availableEntries.length === 0) {
        await this.sendMiniAppMessage(
          message.chatId,
          "There are no currently watching TV titles with another episode available.",
        );
        return;
      }

      await this.telegramApi.sendMessage(
        message.chatId,
        "Choose a title to mark its next episode watched:",
        [
          ...availableEntries.map((entry) => [
            {
              text: progressButtonLabel(entry),
              callback_data: `progress:${entry.id}`,
            },
          ]),
          ...this.miniAppButtons(),
        ],
      );
      return;
    }

    if (command?.name === "app") {
      if (isConnected) {
        await this.sendMiniAppMessage(
          message.chatId,
          "Open Drama Watch to search titles, update progress and manage your watchlist.",
        );
      } else {
        await this.sendDisconnectedMessage(message.chatId);
      }
      return;
    }

    if (command?.name === "help") {
      await this.telegramApi.sendMessage(
        message.chatId,
        "Drama Watch helps you search for titles, manage your watchlist and track episode progress from Telegram.\n\nAvailable commands:\n/start — Start or reconnect\n/app — Open the Mini App\n/search <title> — Search for a title\n/watching — See what you are watching\n/progress — Mark the next episode watched\n/settings — Manage your connection\n/help — Show this help",
        isConnected ? this.miniAppButtons() : this.settingsButtons(),
      );
      return;
    }

    if (isConnected) {
      await this.sendMiniAppMessage(
        message.chatId,
        "Welcome back to Drama Watch. Open the Mini App to search and track titles.",
      );
      return;
    }

    await this.sendDisconnectedMessage(message.chatId);
  }

  private async processCallbackQuery(
    callbackQuery: TelegramCallbackQuery,
  ): Promise<void> {
    if (callbackQuery.chatType !== "private") {
      await this.telegramApi.answerCallbackQuery(
        callbackQuery.id,
        "Open Drama Watch in a private chat.",
      );
      return;
    }

    const progressMatch = callbackQuery.data.match(
      /^progress:([a-f\d]{24})$/i,
    );
    if (!progressMatch?.[1]) {
      await this.telegramApi.answerCallbackQuery(
        callbackQuery.id,
        "This action is no longer available.",
      );
      return;
    }

    const connection =
      await this.telegramRepository.findConnectionByTelegramUserId(
        callbackQuery.userId,
      );
    if (!connection) {
      await this.telegramApi.answerCallbackQuery(
        callbackQuery.id,
        "Connect your Drama Watch account first.",
      );
      return;
    }

    const userId = connection.userId.toHexString();
    let entry: LibraryEntryResponse;
    try {
      entry = await this.libraryService.get(userId, progressMatch[1]);
    } catch (error: unknown) {
      if (error instanceof ApiException) {
        await this.telegramApi.answerCallbackQuery(
          callbackQuery.id,
          "This title is no longer available.",
        );
        return;
      }
      throw error;
    }

    const nextProgress = nextEpisodeProgress(entry);
    if (!nextProgress) {
      await this.telegramApi.answerCallbackQuery(
        callbackQuery.id,
        "No next episode is available for this title.",
      );
      return;
    }

    const updated = await this.libraryService.updateProgress(
      userId,
      entry.id,
      nextProgress,
    );
    const progress = updated.progress;
    await this.telegramApi.answerCallbackQuery(
      callbackQuery.id,
      progress
        ? `${truncateTitle(updated.media.title, 60)}: S${progress.currentSeason} E${progress.currentEpisode}`
        : `${truncateTitle(updated.media.title, 60)} was updated.`,
    );
  }

  private async sendMiniAppMessage(chatId: string, text: string): Promise<void> {
    await this.telegramApi.sendMessage(chatId, text, this.miniAppButtons());
  }

  private async sendDisconnectedMessage(chatId: string): Promise<void> {
    await this.telegramApi.sendMessage(
      chatId,
      "This Telegram account is not connected to Drama Watch yet. Open Drama Watch Settings to create a secure, one-use connection link.",
      this.settingsButtons(),
    );
  }

  private async sendSettingsMessage(chatId: string): Promise<void> {
    await this.telegramApi.sendMessage(
      chatId,
      "Manage your Telegram connection from Drama Watch Settings.",
      this.settingsButtons(),
    );
  }

  private miniAppButtons() {
    return [
      [
        {
          text: "Open Drama Watch",
          web_app: {
            url: this.configService.getOrThrow<string>("TELEGRAM_MINI_APP_URL"),
          },
        },
      ],
    ];
  }

  private settingsButtons() {
    return [
      [
        {
          text: "Open Settings",
          url: `${this.configService.getOrThrow<string>("FRONTEND_URL")}/settings`,
        },
      ],
    ];
  }

  private verifySecret(value: string | undefined): void {
    const expected = this.configService.getOrThrow<string>(
      "TELEGRAM_WEBHOOK_SECRET",
    );

    if (!value || !safeEqual(value, expected)) {
      throw new ApiException({
        statusCode: HttpStatus.UNAUTHORIZED,
        code: "TELEGRAM_WEBHOOK_UNAUTHORIZED",
        message: "Telegram webhook authentication failed.",
      });
    }
  }
}

function parseUpdate(input: unknown): TelegramUpdate {
  if (!isRecord(input) || !Number.isInteger(input["update_id"])) {
    throw invalidTelegramUpdate();
  }

  const updateId = input["update_id"];
  const rawCallbackQuery = input["callback_query"];

  if (isRecord(rawCallbackQuery)) {
    const from = rawCallbackQuery["from"];
    const message = rawCallbackQuery["message"];
    const chat = isRecord(message) ? message["chat"] : undefined;

    if (
      typeof rawCallbackQuery["id"] !== "string" ||
      rawCallbackQuery["id"].length === 0 ||
      typeof rawCallbackQuery["data"] !== "string" ||
      rawCallbackQuery["data"].length === 0 ||
      rawCallbackQuery["data"].length > 64 ||
      !isRecord(from) ||
      !isTelegramId(from["id"]) ||
      !isRecord(chat) ||
      !isTelegramId(chat["id"]) ||
      typeof chat["type"] !== "string"
    ) {
      throw invalidTelegramUpdate();
    }

    return {
      updateId: updateId as number,
      callbackQuery: {
        id: rawCallbackQuery["id"],
        data: rawCallbackQuery["data"],
        userId: String(from["id"]),
        chatId: String(chat["id"]),
        chatType: chat["type"],
      },
    };
  }

  const rawMessage = input["message"];

  if (!isRecord(rawMessage)) {
    return { updateId: updateId as number };
  }

  const chat = rawMessage["chat"];
  const from = rawMessage["from"];

  if (
    !isRecord(chat) ||
    !isRecord(from) ||
    !isTelegramId(chat["id"]) ||
    typeof chat["type"] !== "string" ||
    !isTelegramId(from["id"]) ||
    typeof from["first_name"] !== "string"
  ) {
    throw invalidTelegramUpdate();
  }

  const lastName =
    typeof from["last_name"] === "string" ? from["last_name"] : "";
  const username =
    typeof from["username"] === "string" ? from["username"] : undefined;
  const text =
    typeof rawMessage["text"] === "string"
      ? rawMessage["text"]
      : undefined;

  return {
    updateId: updateId as number,
    message: {
      chatId: String(chat["id"]),
      chatType: chat["type"],
      userId: String(from["id"]),
      displayName: `${from["first_name"]} ${lastName}`.trim(),
      ...(username === undefined ? {} : { username }),
      ...(text === undefined ? {} : { text }),
    },
  };
}

function readCommand(text: string | undefined): TelegramCommand | null {
  const match = text?.match(/^\/([A-Za-z]+)(?:@[A-Za-z0-9_]+)?(?:\s+(.+))?$/);

  if (!match?.[1]) {
    return null;
  }

  const argument = match[2]?.trim();

  return {
    name: match[1].toLowerCase(),
    ...(argument ? { argument } : {}),
  };
}

function formatWatchingMessage(entries: LibraryEntryResponse[]): string {
  if (entries.length === 0) {
    return "You are not currently watching anything. Open Drama Watch to start a title.";
  }

  const visibleEntries = entries.slice(0, 12);
  const lines = visibleEntries.map((entry, index) => {
    const progress = entry.progress
      ? ` — S${entry.progress.currentSeason} E${entry.progress.currentEpisode}`
      : "";
    return `${index + 1}. ${truncateTitle(entry.media.title)}${progress}`;
  });
  const remaining = entries.length - visibleEntries.length;

  return [
    `Currently watching (${entries.length})`,
    "",
    ...lines,
    ...(remaining > 0 ? ["", `And ${remaining} more in the Mini App.`] : []),
  ].join("\n");
}

function formatSearchMessage(
  query: string,
  response: MediaSearchResponse,
): string {
  if (response.results.length === 0) {
    return `No titles found for “${query}”. Try another title or search in the Mini App.`;
  }

  const visibleResults = response.results.slice(0, 8);
  const lines = visibleResults.map(
    (result, index) => `${index + 1}. ${formatSearchResult(result)}`,
  );
  const remaining = Math.max(response.totalResults - visibleResults.length, 0);

  return [
    `Search results for “${query}”`,
    "",
    ...lines,
    ...(remaining > 0
      ? ["", `${remaining} more result${remaining === 1 ? "" : "s"} available.`]
      : []),
    "",
    "Open the Mini App to view details or add a title.",
  ].join("\n");
}

function formatSearchResult(result: MediaSummary): string {
  const date = result.releaseDate ?? result.firstAirDate;
  const year = date?.match(/^\d{4}/)?.[0];
  const type = result.mediaType === MediaType.Tv ? "TV" : "Movie";
  return `${truncateTitle(result.title)}${year ? ` (${year})` : ""} — ${type}`;
}

function progressButtonLabel(entry: LibraryEntryResponse): string {
  const progress = entry.progress;
  const position = progress
    ? `S${progress.currentSeason} E${progress.currentEpisode}`
    : "Not started";
  return `+1 · ${truncateTitle(entry.media.title, 40)} · ${position}`;
}

function nextEpisodeProgress(entry: LibraryEntryResponse): {
  currentSeason: number;
  currentEpisode: number;
  includeSpecials: boolean;
} | null {
  if (entry.media.mediaType !== MediaType.Tv) {
    return null;
  }

  const includeSpecials = entry.progress?.includeSpecials ?? false;
  const seasons = [...(entry.media.seasons ?? [])]
    .filter((season) => includeSpecials || season.seasonNumber !== 0)
    .filter((season) => season.episodeCount > 0)
    .sort((left, right) => left.seasonNumber - right.seasonNumber);
  const firstSeason = seasons[0];
  if (!firstSeason) {
    return null;
  }

  const currentSeason = entry.progress?.currentSeason ?? firstSeason.seasonNumber;
  const currentEpisode = entry.progress?.currentEpisode ?? 0;
  const seasonIndex = Math.max(
    seasons.findIndex((season) => season.seasonNumber === currentSeason),
    0,
  );
  const season = seasons[seasonIndex];
  if (!season) {
    return null;
  }

  if (currentEpisode < season.episodeCount) {
    return {
      currentSeason: season.seasonNumber,
      currentEpisode: currentEpisode + 1,
      includeSpecials,
    };
  }

  const nextSeason = seasons[seasonIndex + 1];
  return nextSeason
    ? {
        currentSeason: nextSeason.seasonNumber,
        currentEpisode: 1,
        includeSpecials,
      }
    : null;
}

function truncateTitle(title: string, maxLength = 80): string {
  const normalized = title.trim();
  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, maxLength - 3)}...`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTelegramId(value: unknown): value is string | number {
  return (
    (typeof value === "number" && Number.isSafeInteger(value)) ||
    (typeof value === "string" && /^-?\d+$/.test(value))
  );
}

function safeEqual(left: string, right: string): boolean {
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

function invalidTelegramUpdate(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.BAD_REQUEST,
    code: "TELEGRAM_UPDATE_INVALID",
    message: "Telegram update is invalid.",
  });
}

function telegramWebhookNotFound(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.NOT_FOUND,
    code: "NOT_FOUND",
    message: "Resource not found.",
  });
}
