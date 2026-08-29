import {
  Injectable,
  Logger,
  type OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "@thallesp/nestjs-better-auth";
import { requireMcpAuth } from "@better-auth/mcp";
import { toNodeHandler, type NodeMcpRequestHandler } from "@modelcontextprotocol/node";
import {
  createMcpHandler,
  fromJsonSchema,
  McpServer,
  type AuthInfo,
  type McpHttpHandler,
} from "@modelcontextprotocol/server";
import { type JWTPayload } from "jose";
import {
  type Request as ExpressRequest,
  type Response as ExpressResponse,
} from "express";

import {
  createMcpResourceUrl,
  type DramaWatchAuth,
} from "../../auth/auth.factory";
import { type Environment } from "../../config/environment";
import { WatchStatus } from "../../common/types/library.types";
import {
  MediaType,
  SearchMediaType,
} from "../../common/types/media.types";
import { LibraryService } from "../library/library.service";
import { MediaRepository } from "../media/media.repository";
import { MediaService } from "../media/media.service";
import { SharedListsService } from "../shared-lists/shared-lists.service";
import { StatisticsService } from "../statistics/statistics.service";
import { WheelsService } from "../wheels/wheels.service";
import { WheelSelectionMode } from "../../common/types/wheel.types";

interface SearchMediaInput {
  query: string;
  type?: SearchMediaType;
  page?: number;
  country?: string;
}

interface MediaDetailsInput {
  mediaType: MediaType;
  tmdbId: number;
}

interface LibraryInput {
  status?: WatchStatus;
}

interface StatisticsInput {
  statuses?: WatchStatus[];
}

interface AddLibraryInput extends MediaDetailsInput {
  status?: WatchStatus;
}

interface UpdateLibraryStatusInput {
  entryId: string;
  status: WatchStatus;
}

interface UpdateLibraryRatingInput {
  entryId: string;
  rating: number | null;
}

interface UpdateLibraryProgressInput {
  entryId: string;
  currentSeason: number;
  currentEpisode: number;
  includeSpecials?: boolean;
}

interface ConfirmedEntryInput {
  entryId: string;
  confirm: true;
}

interface CreateSharedListInput {
  title: string;
  description?: string;
}

interface AddSharedListItemInput extends MediaDetailsInput {
  listId: string;
  note?: string;
}

interface ConfirmedListInput {
  listId: string;
  confirm: true;
}

interface CreateWheelInput {
  title: string;
  description?: string;
  selectionMode?: WheelSelectionMode;
}

interface AddWheelItemInput extends MediaDetailsInput {
  wheelId: string;
  weight?: number;
}

interface WheelInput {
  wheelId: string;
}

interface ConfirmedWheelInput extends WheelInput {
  confirm: true;
}

const LIBRARY_READ_SCOPE = "mcp:library:read";
const SOCIAL_READ_SCOPE = "mcp:social:read";
const LIBRARY_WRITE_SCOPE = "mcp:library:write";
const SOCIAL_WRITE_SCOPE = "mcp:social:write";
const OBJECT_ID_PATTERN = "^[a-fA-F0-9]{24}$";

export interface McpPermissions {
  libraryRead: boolean;
  socialRead: boolean;
  libraryWrite: boolean;
  socialWrite: boolean;
}

export function resolveMcpPermissions(scopes: readonly string[]): McpPermissions {
  const granted = new Set(scopes);
  return {
    libraryRead: granted.has(LIBRARY_READ_SCOPE),
    socialRead: granted.has(SOCIAL_READ_SCOPE),
    libraryWrite: granted.has(LIBRARY_WRITE_SCOPE),
    socialWrite: granted.has(SOCIAL_WRITE_SCOPE),
  };
}

const EMPTY_INPUT_SCHEMA = fromJsonSchema<Record<string, never>>({
  type: "object",
  properties: {},
  additionalProperties: false,
});

@Injectable()
export class McpService implements OnModuleDestroy {
  private readonly logger = new Logger(McpService.name);
  private readonly handler: McpHttpHandler;
  private readonly nodeHandler: NodeMcpRequestHandler;
  private readonly resource: string;

  constructor(
    authService: AuthService<DramaWatchAuth>,
    configService: ConfigService<Environment, true>,
    private readonly mediaService: MediaService,
    private readonly mediaRepository: MediaRepository,
    private readonly libraryService: LibraryService,
    private readonly statisticsService: StatisticsService,
    private readonly sharedListsService: SharedListsService,
    private readonly wheelsService: WheelsService,
  ) {
    this.resource = createMcpResourceUrl(
      configService.getOrThrow("BETTER_AUTH_URL"),
    );
    this.handler = createMcpHandler(
      (context) => this.createServer(requireAuthInfo(context.authInfo)),
      {
        legacy: "reject",
        onerror: (error) => this.logger.error(error),
      },
    );
    const protectedFetch = requireMcpAuth(
      authService.instance,
      (request, claims) =>
        this.handler.fetch(request, {
          authInfo: this.toAuthInfo(request, claims),
        }),
      {
        resource: this.resource,
      },
    );
    this.nodeHandler = toNodeHandler(
      { fetch: protectedFetch },
      { onerror: (error) => this.logger.error(error) },
    );
  }

  handle(
    request: ExpressRequest,
    response: ExpressResponse,
  ): Promise<void> {
    return this.nodeHandler(request, response, request.body);
  }

  async onModuleDestroy(): Promise<void> {
    await this.handler.close();
  }

  private createServer(authInfo: AuthInfo): McpServer {
    const authenticatedUserId = readUserId(authInfo);
    const permissions = resolveMcpPermissions(authInfo.scopes);
    const server = new McpServer({
      name: "drama-watch",
      version: "0.1.0",
    });

    if (permissions.libraryRead) server.registerTool(
      "search_media",
      {
        title: "Search media",
        description:
          "Search TMDB through Drama Watch for movies and TV series.",
        annotations: { readOnlyHint: true },
        inputSchema: fromJsonSchema<SearchMediaInput>({
          type: "object",
          properties: {
            query: { type: "string", minLength: 1, maxLength: 100 },
            type: {
              type: "string",
              enum: Object.values(SearchMediaType),
            },
            page: { type: "integer", minimum: 1, maximum: 500 },
            country: {
              type: "string",
              pattern: "^[A-Z]{2}$",
            },
          },
          required: ["query"],
          additionalProperties: false,
        }),
      },
      async (input) =>
        toolResult(
          await this.mediaService.search({
            q: input.query,
            type: input.type ?? SearchMediaType.All,
            page: input.page ?? 1,
            ...(input.country === undefined
              ? {}
              : { country: input.country }),
          }),
        ),
    );

    if (permissions.libraryRead) server.registerTool(
      "get_media_details",
      {
        title: "Get media details",
        description: "Get normalized details for a TMDB title.",
        annotations: { readOnlyHint: true },
        inputSchema: fromJsonSchema<MediaDetailsInput>({
          type: "object",
          properties: {
            mediaType: {
              type: "string",
              enum: Object.values(MediaType),
            },
            tmdbId: { type: "integer", minimum: 1 },
          },
          required: ["mediaType", "tmdbId"],
          additionalProperties: false,
        }),
      },
      async ({ mediaType, tmdbId }) =>
        toolResult(await this.mediaService.getDetails(mediaType, tmdbId)),
    );

    if (permissions.libraryRead) server.registerTool(
      "get_my_library",
      {
        title: "Get my library",
        description:
          "Read the authenticated user's Drama Watch library.",
        annotations: { readOnlyHint: true },
        inputSchema: fromJsonSchema<LibraryInput>({
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: Object.values(WatchStatus),
            },
          },
          additionalProperties: false,
        }),
      },
      async ({ status }) =>
        toolResult(await this.libraryService.list(authenticatedUserId, status)),
    );

    if (permissions.libraryRead) server.registerTool(
      "get_my_statistics",
      {
        title: "Get my statistics",
        description:
          "Read statistics calculated from the authenticated user's library.",
        annotations: { readOnlyHint: true },
        inputSchema: fromJsonSchema<StatisticsInput>({
          type: "object",
          properties: {
            statuses: {
              type: "array",
              items: {
                type: "string",
                enum: Object.values(WatchStatus),
              },
              uniqueItems: true,
              minItems: 1,
            },
          },
          additionalProperties: false,
        }),
      },
      async ({ statuses }) =>
        toolResult(
          await this.statisticsService.getOverview(
            authenticatedUserId,
            statuses,
          ),
        ),
    );

    if (permissions.socialRead) server.registerTool(
      "get_my_shared_lists",
      {
        title: "Get my shared lists",
        description:
          "Read shared watchlists available to the authenticated user.",
        annotations: { readOnlyHint: true },
        inputSchema: EMPTY_INPUT_SCHEMA,
      },
      async () =>
        toolResult(await this.sharedListsService.list(authenticatedUserId)),
    );

    if (permissions.socialRead) server.registerTool(
      "get_my_wheels",
      {
        title: "Get my wheels",
        description:
          "Read selection wheels available to the authenticated user.",
        annotations: { readOnlyHint: true },
        inputSchema: EMPTY_INPUT_SCHEMA,
      },
      async () =>
        toolResult(await this.wheelsService.list(authenticatedUserId)),
    );

    if (permissions.libraryWrite) {
      this.registerLibraryWriteTools(server, authenticatedUserId);
    }

    if (permissions.socialWrite) {
      this.registerSocialWriteTools(server, authenticatedUserId);
    }

    return server;
  }

  private registerLibraryWriteTools(
    server: McpServer,
    authenticatedUserId: string,
  ): void {
    server.registerTool(
      "add_to_my_library",
      {
        title: "Add to my library",
        description:
          "Add a TMDB movie or TV series to the authenticated user's library.",
        annotations: { readOnlyHint: false, idempotentHint: false },
        inputSchema: fromJsonSchema<AddLibraryInput>({
          type: "object",
          properties: {
            mediaType: {
              type: "string",
              enum: Object.values(MediaType),
            },
            tmdbId: { type: "integer", minimum: 1 },
            status: {
              type: "string",
              enum: Object.values(WatchStatus),
            },
          },
          required: ["mediaType", "tmdbId"],
          additionalProperties: false,
        }),
      },
      async ({ mediaType, tmdbId, status }) =>
        toolResult(
          await this.libraryService.add(authenticatedUserId, {
            mediaType,
            tmdbId,
            status: status ?? WatchStatus.ToWatch,
          }),
        ),
    );

    server.registerTool(
      "set_my_library_status",
      {
        title: "Set my library status",
        description: "Change the lifecycle status of one library entry.",
        annotations: { readOnlyHint: false, idempotentHint: true },
        inputSchema: fromJsonSchema<UpdateLibraryStatusInput>({
          type: "object",
          properties: {
            entryId: { type: "string", pattern: OBJECT_ID_PATTERN },
            status: {
              type: "string",
              enum: Object.values(WatchStatus),
            },
          },
          required: ["entryId", "status"],
          additionalProperties: false,
        }),
      },
      async ({ entryId, status }) =>
        toolResult(
          await this.libraryService.updateStatus(
            authenticatedUserId,
            entryId,
            status,
          ),
        ),
    );

    server.registerTool(
      "rate_my_library_entry",
      {
        title: "Rate my library entry",
        description:
          "Set a half-point rating from 1 to 10, or clear it with null.",
        annotations: { readOnlyHint: false, idempotentHint: true },
        inputSchema: fromJsonSchema<UpdateLibraryRatingInput>({
          type: "object",
          properties: {
            entryId: { type: "string", pattern: OBJECT_ID_PATTERN },
            rating: {
              anyOf: [
                {
                  type: "number",
                  minimum: 1,
                  maximum: 10,
                  multipleOf: 0.5,
                },
                { type: "null" },
              ],
            },
          },
          required: ["entryId", "rating"],
          additionalProperties: false,
        }),
      },
      async ({ entryId, rating }) =>
        toolResult(
          await this.libraryService.updateRating(
            authenticatedUserId,
            entryId,
            rating,
          ),
        ),
    );

    server.registerTool(
      "update_my_episode_progress",
      {
        title: "Update my episode progress",
        description:
          "Set the current season and episode for one TV library entry.",
        annotations: { readOnlyHint: false, idempotentHint: true },
        inputSchema: fromJsonSchema<UpdateLibraryProgressInput>({
          type: "object",
          properties: {
            entryId: { type: "string", pattern: OBJECT_ID_PATTERN },
            currentSeason: { type: "integer", minimum: 0 },
            currentEpisode: { type: "integer", minimum: 0 },
            includeSpecials: { type: "boolean" },
          },
          required: ["entryId", "currentSeason", "currentEpisode"],
          additionalProperties: false,
        }),
      },
      async ({ entryId, ...progress }) =>
        toolResult(
          await this.libraryService.updateProgress(
            authenticatedUserId,
            entryId,
            progress,
          ),
        ),
    );

    server.registerTool(
      "remove_from_my_library",
      {
        title: "Remove from my library",
        description:
          "Permanently remove one entry from the authenticated user's library.",
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
        },
        inputSchema: fromJsonSchema<ConfirmedEntryInput>({
          type: "object",
          properties: {
            entryId: { type: "string", pattern: OBJECT_ID_PATTERN },
            confirm: { type: "boolean", const: true },
          },
          required: ["entryId", "confirm"],
          additionalProperties: false,
        }),
      },
      async ({ entryId }) => {
        await this.libraryService.delete(authenticatedUserId, entryId);
        return toolResult({ deleted: true, entryId });
      },
    );
  }

  private registerSocialWriteTools(
    server: McpServer,
    authenticatedUserId: string,
  ): void {
    server.registerTool(
      "create_shared_list",
      {
        title: "Create shared list",
        description: "Create a private shared watchlist owned by the user.",
        annotations: { readOnlyHint: false, idempotentHint: false },
        inputSchema: fromJsonSchema<CreateSharedListInput>({
          type: "object",
          properties: {
            title: { type: "string", minLength: 1, maxLength: 100 },
            description: { type: "string", maxLength: 2_000 },
          },
          required: ["title"],
          additionalProperties: false,
        }),
      },
      async (input) =>
        toolResult(
          await this.sharedListsService.create(authenticatedUserId, input),
        ),
    );

    server.registerTool(
      "add_to_shared_list",
      {
        title: "Add to shared list",
        description:
          "Resolve a TMDB title once in shared media storage and add it to a list.",
        annotations: { readOnlyHint: false, idempotentHint: false },
        inputSchema: fromJsonSchema<AddSharedListItemInput>({
          type: "object",
          properties: {
            listId: { type: "string", pattern: OBJECT_ID_PATTERN },
            mediaType: {
              type: "string",
              enum: Object.values(MediaType),
            },
            tmdbId: { type: "integer", minimum: 1 },
            note: { type: "string", maxLength: 2_000 },
          },
          required: ["listId", "mediaType", "tmdbId"],
          additionalProperties: false,
        }),
      },
      async ({ listId, mediaType, tmdbId, note }) =>
        toolResult(
          await this.sharedListsService.addItem(
            authenticatedUserId,
            listId,
            {
              mediaId: await this.resolveMediaId(mediaType, tmdbId),
              ...(note === undefined ? {} : { note }),
            },
          ),
        ),
    );

    server.registerTool(
      "delete_shared_list",
      {
        title: "Delete shared list",
        description:
          "Permanently delete a list and its items, invitations, and comments.",
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
        },
        inputSchema: fromJsonSchema<ConfirmedListInput>({
          type: "object",
          properties: {
            listId: { type: "string", pattern: OBJECT_ID_PATTERN },
            confirm: { type: "boolean", const: true },
          },
          required: ["listId", "confirm"],
          additionalProperties: false,
        }),
      },
      async ({ listId }) => {
        await this.sharedListsService.delete(authenticatedUserId, listId);
        return toolResult({ deleted: true, listId });
      },
    );

    server.registerTool(
      "create_wheel",
      {
        title: "Create wheel",
        description: "Create a private selection wheel owned by the user.",
        annotations: { readOnlyHint: false, idempotentHint: false },
        inputSchema: fromJsonSchema<CreateWheelInput>({
          type: "object",
          properties: {
            title: { type: "string", minLength: 1, maxLength: 100 },
            description: { type: "string", maxLength: 1_000 },
            selectionMode: {
              type: "string",
              enum: Object.values(WheelSelectionMode),
            },
          },
          required: ["title"],
          additionalProperties: false,
        }),
      },
      async (input) =>
        toolResult(await this.wheelsService.create(authenticatedUserId, input)),
    );

    server.registerTool(
      "add_to_wheel",
      {
        title: "Add to wheel",
        description:
          "Resolve a TMDB title once in shared media storage and add it to a wheel.",
        annotations: { readOnlyHint: false, idempotentHint: false },
        inputSchema: fromJsonSchema<AddWheelItemInput>({
          type: "object",
          properties: {
            wheelId: { type: "string", pattern: OBJECT_ID_PATTERN },
            mediaType: {
              type: "string",
              enum: Object.values(MediaType),
            },
            tmdbId: { type: "integer", minimum: 1 },
            weight: { type: "integer", minimum: 1, maximum: 100 },
          },
          required: ["wheelId", "mediaType", "tmdbId"],
          additionalProperties: false,
        }),
      },
      async ({ wheelId, mediaType, tmdbId, weight }) =>
        toolResult(
          await this.wheelsService.addItem(authenticatedUserId, wheelId, {
            mediaId: await this.resolveMediaId(mediaType, tmdbId),
            ...(weight === undefined ? {} : { weight }),
          }),
        ),
    );

    server.registerTool(
      "spin_wheel",
      {
        title: "Spin wheel",
        description:
          "Select and persist the exact winner for an editable wheel.",
        annotations: { readOnlyHint: false, idempotentHint: false },
        inputSchema: fromJsonSchema<WheelInput>({
          type: "object",
          properties: {
            wheelId: { type: "string", pattern: OBJECT_ID_PATTERN },
          },
          required: ["wheelId"],
          additionalProperties: false,
        }),
      },
      async ({ wheelId }) =>
        toolResult(await this.wheelsService.spin(authenticatedUserId, wheelId)),
    );

    server.registerTool(
      "delete_wheel",
      {
        title: "Delete wheel",
        description: "Permanently delete a wheel and its spin history.",
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
        },
        inputSchema: fromJsonSchema<ConfirmedWheelInput>({
          type: "object",
          properties: {
            wheelId: { type: "string", pattern: OBJECT_ID_PATTERN },
            confirm: { type: "boolean", const: true },
          },
          required: ["wheelId", "confirm"],
          additionalProperties: false,
        }),
      },
      async ({ wheelId }) => {
        await this.wheelsService.delete(authenticatedUserId, wheelId);
        return toolResult({ deleted: true, wheelId });
      },
    );
  }

  private async resolveMediaId(
    mediaType: MediaType,
    tmdbId: number,
  ): Promise<string> {
    const details = await this.mediaService.getDetails(mediaType, tmdbId);
    const media = await this.mediaRepository.upsertSnapshot(details);
    return media._id.toHexString();
  }

  private toAuthInfo(request: globalThis.Request, claims: JWTPayload): AuthInfo {
    const userId = readClaim(claims.sub, "sub");
    const clientId =
      optionalClaim(claims.client_id) ??
      optionalClaim(claims.azp) ??
      "unknown-client";

    return {
      token: readAccessToken(request.headers.get("authorization")),
      clientId,
      scopes: readScopes(claims.scope),
      ...(claims.exp === undefined ? {} : { expiresAt: claims.exp }),
      resource: new URL(this.resource),
      extra: { userId },
    };
  }
}

function requireAuthInfo(authInfo: AuthInfo | undefined): AuthInfo {
  if (!authInfo) throw new Error("MCP authentication is unavailable.");
  return authInfo;
}

function readUserId(authInfo: AuthInfo): string {
  const userId = authInfo.extra?.userId;
  if (typeof userId !== "string" || userId.length === 0) {
    throw new Error("The authenticated MCP user is unavailable.");
  }
  return userId;
}

function readClaim(value: unknown, name: string): string {
  const claim = optionalClaim(value);
  if (!claim) throw new Error(`The access token is missing ${name}.`);
  return claim;
}

function optionalClaim(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0
    ? value
    : undefined;
}

function readScopes(value: unknown): string[] {
  if (typeof value === "string") {
    return value.split(" ").filter(Boolean);
  }
  return Array.isArray(value)
    ? value.filter((scope): scope is string => typeof scope === "string")
    : [];
}

function readAccessToken(authorization: string | null): string {
  const token = authorization?.split(/\s+/, 2)[1];
  if (!token) throw new Error("The access token is unavailable.");
  return token;
}

function toolResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value),
      },
    ],
  };
}
