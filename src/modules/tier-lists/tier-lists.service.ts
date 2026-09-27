import { Injectable } from "@nestjs/common";
import { randomBytes, randomUUID } from "node:crypto";
import { Types } from "mongoose";

import { ApiException } from "../../common/errors/api-exception";
import {
  TierColor,
  TierListVisibility,
  type PublicTierListResponse,
  type TierListMedia,
  type TierListResponse,
  type TierListSummaryResponse,
} from "../../common/types/tier-list.types";
import { MediaRepository } from "../media/media.repository";
import { MediaService } from "../media/media.service";
import { toPublicUserProfile, UsersService } from "../users/users.service";
import {
  type AddTierItemsDto,
  type CreateTierListDto,
  type RemoveTierItemDto,
  type UpdateTierLayoutDto,
  type UpdateTierListDto,
} from "./dto/tier-list.dto";
import { type TierListDocument } from "./schema/tier-list.schema";
import { TierListsRepository } from "./tier-lists.repository";

@Injectable()
export class TierListsService {
  constructor(
    private readonly repository: TierListsRepository,
    private readonly mediaRepository: MediaRepository,
    private readonly mediaService: MediaService,
    private readonly usersService: UsersService,
  ) {}

  async list(userId: string): Promise<TierListSummaryResponse[]> {
    return (await this.repository.list(new Types.ObjectId(userId))).map(
      summary,
    );
  }

  async create(
    userId: string,
    input: CreateTierListDto,
  ): Promise<TierListResponse> {
    const colors = [
      TierColor.Red,
      TierColor.Orange,
      TierColor.Yellow,
      TierColor.Green,
      TierColor.Blue,
      TierColor.Purple,
    ];
    return this.serialize(
      await this.repository.create({
        ownerId: new Types.ObjectId(userId),
        title: input.title,
        description: input.description ?? "",
        visibility: TierListVisibility.Private,
        revision: 0,
        unrankedMediaIds: [],
        tiers: ["S", "A", "B", "C", "D", "F"].map((label, index) => ({
          id: randomUUID(),
          label,
          color: colors[index]!,
          mediaIds: [],
        })),
      }),
    );
  }

  async get(userId: string, id: string): Promise<TierListResponse> {
    return this.serialize(await this.owned(userId, id));
  }

  async update(
    userId: string,
    id: string,
    input: UpdateTierListDto,
  ): Promise<TierListResponse> {
    const board = await this.owned(userId, id, input.revision);
    board.title = input.title;
    board.description = input.description;
    board.visibility = input.visibility;
    if (input.visibility === TierListVisibility.Private)
      delete board.publicSlug;
    else board.publicSlug ??= randomBytes(12).toString("base64url");
    return this.save(board);
  }

  async layout(
    userId: string,
    id: string,
    input: UpdateTierLayoutDto,
  ): Promise<TierListResponse> {
    const board = await this.owned(userId, id, input.revision);
    const media = await this.mediaRepository.findByIds(allIds(board));
    const identities = new Map(
      media.map((item) => [`${item.mediaType}:${item.tmdbId}`, item._id]),
    );
    const requested = [
      ...input.tiers.flatMap((row) => row.mediaIds),
      ...input.unrankedMediaIds,
    ];
    // A layout is a permutation, never an add/remove operation. Validate before the single write.
    if (
      input.tiers.some((row) => row.id === "__unranked") ||
      new Set(input.tiers.map((row) => row.id)).size !== input.tiers.length ||
      requested.length !== allIds(board).length ||
      requested.length > 300 ||
      new Set(requested).size !== requested.length ||
      requested.some((key) => !identities.has(key))
    ) {
      throw invalid(
        "Every existing title must appear exactly once, and tier IDs must be unique.",
      );
    }
    board.tiers = input.tiers.map((row) => ({
      id: row.id,
      label: row.label,
      color: row.color,
      mediaIds: row.mediaIds.map((key) => identities.get(key)!),
    }));
    board.unrankedMediaIds = input.unrankedMediaIds.map((key) =>
      identities.get(key)!,
    );
    return this.save(board);
  }

  async add(
    userId: string,
    id: string,
    input: AddTierItemsDto,
  ): Promise<TierListResponse> {
    const board = await this.owned(userId, id, input.revision);
    const existing = await this.mediaRepository.findByIds(allIds(board));
    const keys = new Set(
      existing.map((item) => `${item.mediaType}:${item.tmdbId}`),
    );
    const additions = [
      ...new Map(
        input.items.map((item) => [`${item.mediaType}:${item.tmdbId}`, item]),
      ).values(),
    ].filter((item) => !keys.has(`${item.mediaType}:${item.tmdbId}`));
    if (allIds(board).length + additions.length > 300)
      throw invalid("A tier list can contain up to 300 titles.");
    for (const item of additions) {
      const media =
        (await this.mediaRepository.findByIdentity(
          item.mediaType,
          item.tmdbId,
        )) ??
        (await this.mediaRepository.upsertSnapshot(
          await this.mediaService.getDetails(item.mediaType, item.tmdbId),
        ));
      board.unrankedMediaIds.push(media._id);
    }
    return this.save(board);
  }

  async remove(
    userId: string,
    id: string,
    input: RemoveTierItemDto,
  ): Promise<TierListResponse> {
    const board = await this.owned(userId, id, input.revision);
    const media = await this.mediaRepository.findByIds(allIds(board));
    const target = media.find(
      (item) => `${item.mediaType}:${item.tmdbId}` === input.mediaId,
    );
    if (!target) throw invalid("This title is not in the tier list.");
    const keep = (item: Types.ObjectId): boolean => !item.equals(target._id);
    board.tiers = board.tiers.map((row) => ({
      ...row,
      mediaIds: row.mediaIds.filter(keep),
    }));
    board.unrankedMediaIds = board.unrankedMediaIds.filter(keep);
    return this.save(board);
  }

  async duplicate(
    userId: string,
    id: string,
    revision: number,
  ): Promise<TierListResponse> {
    const board = await this.owned(userId, id, revision);
    return this.serialize(
      await this.repository.create({
        ownerId: board.ownerId,
        title: `${board.title.slice(0, 93)} (copy)`,
        description: board.description,
        visibility: TierListVisibility.Private,
        revision: 0,
        tiers: board.tiers,
        unrankedMediaIds: board.unrankedMediaIds,
      }),
    );
  }

  async delete(userId: string, id: string, revision: number): Promise<void> {
    if (!(await this.repository.delete(await this.owned(userId, id, revision))))
      throw conflict();
  }

  async getPublic(slug: string): Promise<PublicTierListResponse> {
    const board = await this.repository.findPublic(slug);
    if (
      !board ||
      board.visibility === TierListVisibility.Private ||
      !board.publicSlug
    )
      throw notFound();
    // Do not even load the owner's unranked titles for an anonymous projection.
    const rankedBoard = { ...board, unrankedMediaIds: [] };
    const [result, users] = await Promise.all([
      this.serialize(rankedBoard),
      this.usersService.findStoredByIds([board.ownerId]),
    ]);
    return {
      title: result.title,
      description: result.description,
      visibility: board.visibility,
      publicSlug: board.publicSlug,
      ...(users[0] ? { owner: toPublicUserProfile(users[0]) } : {}),
      tiers: result.tiers.map((row) => ({
        label: row.label,
        color: row.color,
        items: row.items,
      })),
      itemCount: result.itemCount,
      updatedAt: result.updatedAt,
    };
  }

  private async owned(
    userId: string,
    id: string,
    revision?: number,
  ): Promise<TierListDocument> {
    const board = await this.repository.findOwned(
      id,
      new Types.ObjectId(userId),
    );
    if (!board) throw notFound();
    if (revision !== undefined && board.revision !== revision) throw conflict();
    return board;
  }

  private async save(board: TierListDocument): Promise<TierListResponse> {
    const saved = await this.repository.save(board);
    if (!saved) throw conflict();
    return this.serialize(saved);
  }

  private async serialize(board: TierListDocument): Promise<TierListResponse> {
    const media = await this.mediaRepository.findByIds(allIds(board));
    const byId = new Map(media.map((item) => [item._id.toHexString(), item]));
    const mapMedia = (id: Types.ObjectId): TierListMedia => {
      const item = byId.get(id.toHexString());
      if (!item)
        throw new Error(
          "Tier list references an unavailable shared media record",
        );
      return {
        id: `${item.mediaType}:${item.tmdbId}`,
        mediaType: item.mediaType,
        tmdbId: item.tmdbId,
        title: item.title,
        originalTitle: item.originalTitle,
        ...(item.posterUrl ? { posterUrl: item.posterUrl } : {}),
      };
    };
    return {
      ...summary(board),
      tiers: board.tiers.map((row) => ({
        id: row.id,
        label: row.label,
        color: row.color,
        items: row.mediaIds.map(mapMedia),
      })),
      unranked: board.unrankedMediaIds.map(mapMedia),
    };
  }
}

function allIds(board: TierListDocument): Types.ObjectId[] {
  return [
    ...board.tiers.flatMap((row) => row.mediaIds),
    ...board.unrankedMediaIds,
  ];
}

function summary(board: TierListDocument): TierListSummaryResponse {
  return {
    id: board._id.toHexString(),
    title: board.title,
    description: board.description,
    visibility: board.visibility,
    ...(board.publicSlug ? { publicSlug: board.publicSlug } : {}),
    revision: board.revision,
    itemCount: allIds(board).length,
    createdAt: board.createdAt.toISOString(),
    updatedAt: board.updatedAt.toISOString(),
  };
}

function invalid(message: string): ApiException {
  return new ApiException({
    statusCode: 400,
    code: "INVALID_TIER_LIST",
    message,
  });
}
function notFound(): ApiException {
  return new ApiException({
    statusCode: 404,
    code: "TIER_LIST_NOT_FOUND",
    message: "Tier list not found.",
  });
}
function conflict(): ApiException {
  return new ApiException({
    statusCode: 409,
    code: "TIER_LIST_CONFLICT",
    message:
      "This tier list changed in another tab. Reload it before editing again.",
  });
}
