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
  MCP_REQUIRED_SCOPES,
} from "../../auth/auth.factory";
import { type Environment } from "../../config/environment";
import { WatchStatus } from "../../common/types/library.types";
import {
  MediaType,
  SearchMediaType,
} from "../../common/types/media.types";
import { LibraryService } from "../library/library.service";
import { MediaService } from "../media/media.service";
import { SharedListsService } from "../shared-lists/shared-lists.service";
import { StatisticsService } from "../statistics/statistics.service";
import { WheelsService } from "../wheels/wheels.service";

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
    private readonly libraryService: LibraryService,
    private readonly statisticsService: StatisticsService,
    private readonly sharedListsService: SharedListsService,
    private readonly wheelsService: WheelsService,
  ) {
    this.resource = createMcpResourceUrl(
      configService.getOrThrow("BETTER_AUTH_URL"),
    );
    this.handler = createMcpHandler(
      (context) => this.createServer(readUserId(context.authInfo)),
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
        requiredScopes: MCP_REQUIRED_SCOPES,
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

  private createServer(authenticatedUserId: string): McpServer {
    const server = new McpServer({
      name: "drama-watch",
      version: "0.1.0",
    });

    server.registerTool(
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

    server.registerTool(
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

    server.registerTool(
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

    server.registerTool(
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

    server.registerTool(
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

    server.registerTool(
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

    return server;
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

function readUserId(authInfo: AuthInfo | undefined): string {
  const userId = authInfo?.extra?.userId;
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
