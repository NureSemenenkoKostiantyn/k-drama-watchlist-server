import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes } from "node:crypto";
import { MongoServerError } from "mongodb";
import { Types } from "mongoose";

import { ApiException } from "../../common/errors/api-exception";
import { NotificationType } from "../../common/types/notification.types";
import {
  type PublicSharedListDetailsResponse,
  type PublicSharedListDiscoveryResponse,
  type PublicSharedListItemResponse,
  type PublicSharedListPreviewMediaResponse,
  type SharedListDetailsResponse,
  type SharedListInviteResponse,
  type SharedListPendingInviteResponse,
  type SharedListItemResponse,
  type SharedListMemberResponse,
  type SharedListResponse,
  SharedListRole,
  SharedListVisibility,
} from "../../common/types/shared-list.types";
import { type Environment } from "../../config/environment";
import {
  MediaRepository,
  type StoredMedia,
  toMediaDetails,
} from "../media/media.repository";
import { NotificationsService } from "../notifications/notifications.service";
import {
  toPublicUserProfile,
  UsersService,
} from "../users/users.service";
import { type AddSharedListItemDto } from "./dto/add-shared-list-item.dto";
import { type CreateSharedListInviteDto } from "./dto/create-shared-list-invite.dto";
import { type CreateSharedListDto } from "./dto/create-shared-list.dto";
import { type PublicSharedListsQueryDto } from "./dto/public-shared-lists-query.dto";
import { type ReorderSharedListItemsDto } from "./dto/reorder-shared-list-items.dto";
import { type UpdateSharedListItemDto } from "./dto/update-shared-list-item.dto";
import { type UpdateSharedListMemberDto } from "./dto/update-shared-list-member.dto";
import { type UpdateSharedListDto } from "./dto/update-shared-list.dto";
import {
  type StoredSharedList,
  type StoredSharedListItem,
  SharedListsRepository,
} from "./shared-lists.repository";

const INVITE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1_000;
const PUBLIC_LIST_PREVIEW_LIMIT = 4;

@Injectable()
export class SharedListsService {
  constructor(
    private readonly repository: SharedListsRepository,
    private readonly mediaRepository: MediaRepository,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService<Environment, true>,
  ) {}

  async list(authenticatedUserId: string): Promise<SharedListResponse[]> {
    const userId = toObjectId(authenticatedUserId);
    const lists = await this.repository.findAll(userId);
    const items = await this.repository.findItemsForLists(
      lists.map((list) => list._id),
    );
    const counts = new Map<string, number>();
    for (const item of items) {
      const key = item.listId.toHexString();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return lists.map((list) =>
      toListResponse(list, userId, counts.get(list._id.toHexString()) ?? 0),
    );
  }

  async create(
    authenticatedUserId: string,
    input: CreateSharedListDto,
  ): Promise<SharedListDetailsResponse> {
    const userId = toObjectId(authenticatedUserId);
    const list = await this.repository.create(
      userId,
      input.title,
      normalizeOptionalText(input.description),
      new Date(),
    );
    return this.withDetails(list, userId);
  }

  async get(
    authenticatedUserId: string,
    listId: string,
  ): Promise<SharedListDetailsResponse> {
    const userId = toObjectId(authenticatedUserId);
    return this.withDetails(
      await this.requireList(userId, new Types.ObjectId(listId)),
      userId,
    );
  }

  async getPublic(publicSlug: string): Promise<PublicSharedListDetailsResponse> {
    const list = await this.repository.findByPublicSlug(publicSlug);
    if (!list || !list.publicSlug) throw listNotFound();
    const details = await this.withDetails(list, list.ownerId);
    return {
      title: details.title,
      visibility: list.visibility as
        | SharedListVisibility.Unlisted
        | SharedListVisibility.Public,
      publicSlug: list.publicSlug,
      itemCount: details.itemCount,
      members: details.members,
      items: details.items.map(toPublicItemResponse),
      createdAt: details.createdAt,
      updatedAt: details.updatedAt,
      ...(details.description === undefined
        ? {}
        : { description: details.description }),
    };
  }

  async discoverPublic(
    query: PublicSharedListsQueryDto,
  ): Promise<PublicSharedListDiscoveryResponse> {
    const page = await this.repository.findPublicPage(query.page, query.limit);
    const summaries = await this.repository.summarizeItemsForLists(
      page.lists.map((list) => list._id),
      PUBLIC_LIST_PREVIEW_LIMIT,
    );
    const summariesByListId = new Map(
      summaries.map((summary) => [summary.listId.toHexString(), summary]),
    );
    const previewMediaIds = summaries.flatMap(
      (summary) => summary.previewMediaIds,
    );
    const [owners, previewMedia] = await Promise.all([
      this.usersService.findStoredByIds(
        uniqueObjectIds(page.lists.map((list) => list.ownerId)),
      ),
      this.mediaRepository.findByIds(uniqueObjectIds(previewMediaIds)),
    ]);
    const ownersById = new Map(
      owners.map((owner) => [owner._id.toHexString(), owner]),
    );
    const mediaById = new Map(
      previewMedia.map((media) => [media._id.toHexString(), media]),
    );

    return {
      page: query.page,
      totalPages:
        page.totalResults === 0
          ? 0
          : Math.ceil(page.totalResults / query.limit),
      totalResults: page.totalResults,
      items: page.lists.flatMap((list) => {
        if (!list.publicSlug) return [];
        const summary = summariesByListId.get(list._id.toHexString());
        const owner = ownersById.get(list.ownerId.toHexString());
        return [
          {
            title: list.title,
            publicSlug: list.publicSlug,
            itemCount: summary?.itemCount ?? 0,
            previewMedia: (summary?.previewMediaIds ?? []).flatMap(
              (mediaId) => {
                const media = mediaById.get(mediaId.toHexString());
                return media ? [toPublicListPreviewMedia(media)] : [];
              },
            ),
            createdAt: list.createdAt.toISOString(),
            updatedAt: list.updatedAt.toISOString(),
            ...(list.description === undefined
              ? {}
              : { description: list.description }),
            ...(owner === undefined
              ? {}
              : { owner: toPublicUserProfile(owner) }),
          },
        ];
      }),
    };
  }

  async update(
    authenticatedUserId: string,
    listId: string,
    input: UpdateSharedListDto,
  ): Promise<SharedListDetailsResponse> {
    if (
      input.title === undefined &&
      input.description === undefined &&
      input.visibility === undefined
    ) {
      throw invalidList("Provide a shared-list field to update.");
    }
    const userId = toObjectId(authenticatedUserId);
    const listIdObject = new Types.ObjectId(listId);
    const current = await this.requireOwner(userId, listIdObject);
    const list = await this.repository.update(userId, listIdObject, {
      ...(input.title === undefined ? {} : { title: input.title }),
      ...(input.description === undefined
        ? {}
        : {
            description:
              input.description === null
                ? null
                : (normalizeOptionalText(input.description) ?? null),
          }),
      ...(input.visibility === undefined
        ? {}
        : input.visibility === SharedListVisibility.Private
          ? {
              visibility: SharedListVisibility.Private,
              publicSlug: null,
            }
          : {
              visibility: input.visibility,
              publicSlug: current.publicSlug ?? createPublicSlug(),
            }),
    });
    if (!list) throw listNotFound();
    return this.withDetails(list, userId);
  }

  async delete(authenticatedUserId: string, listId: string): Promise<void> {
    const userId = toObjectId(authenticatedUserId);
    const listIdObject = new Types.ObjectId(listId);
    await this.requireOwner(userId, listIdObject);
    if (!(await this.repository.delete(userId, listIdObject))) {
      throw listNotFound();
    }
  }

  async addItem(
    authenticatedUserId: string,
    listId: string,
    input: AddSharedListItemDto,
  ): Promise<SharedListItemResponse> {
    const userId = toObjectId(authenticatedUserId);
    const listIdObject = new Types.ObjectId(listId);
    const list = await this.requireEditor(userId, listIdObject);
    const mediaId = new Types.ObjectId(input.mediaId);
    const media = await this.mediaRepository.findById(mediaId);
    if (!media) throw mediaNotFound();
    const items = await this.repository.findItems(listIdObject);
    try {
      const item = await this.repository.createItem(
        listIdObject,
        mediaId,
        userId,
        items.length,
        {
          ...(normalizeOptionalText(input.note) === undefined
            ? {}
            : { note: normalizeOptionalText(input.note) }),
          ...(input.groupStatus === undefined
            ? {}
            : { groupStatus: input.groupStatus }),
          ...(input.groupProgress === undefined
            ? {}
            : { groupProgress: { ...input.groupProgress } }),
        },
      );
      await this.repository.touch(listIdObject);
      await this.publishItemUpdate(list, userId);
      return this.withSingleItemData(item);
    } catch (error: unknown) {
      if (isDuplicateKeyError(error)) throw itemAlreadyExists();
      throw error;
    }
  }

  async updateItem(
    authenticatedUserId: string,
    listId: string,
    itemId: string,
    input: UpdateSharedListItemDto,
  ): Promise<SharedListItemResponse> {
    if (
      input.note === undefined &&
      input.groupStatus === undefined &&
      input.groupProgress === undefined
    ) {
      throw invalidList("Provide a shared-list item field to update.");
    }
    const userId = toObjectId(authenticatedUserId);
    const listIdObject = new Types.ObjectId(listId);
    const list = await this.requireEditor(userId, listIdObject);
    const item = await this.repository.updateItem(
      listIdObject,
      new Types.ObjectId(itemId),
      {
        ...(input.note === undefined
          ? {}
          : {
              note:
                input.note === null
                  ? null
                  : (normalizeOptionalText(input.note) ?? null),
            }),
        ...(input.groupStatus === undefined
          ? {}
          : { groupStatus: input.groupStatus }),
        ...(input.groupProgress === undefined
          ? {}
          : {
              groupProgress:
                input.groupProgress === null
                  ? null
                  : { ...input.groupProgress },
            }),
      },
    );
    if (!item) throw itemNotFound();
    await this.repository.touch(listIdObject);
    await this.publishItemUpdate(list, userId);
    return this.withSingleItemData(item);
  }

  async deleteItem(
    authenticatedUserId: string,
    listId: string,
    itemId: string,
  ): Promise<void> {
    const userId = toObjectId(authenticatedUserId);
    const listIdObject = new Types.ObjectId(listId);
    const list = await this.requireEditor(userId, listIdObject);
    if (
      !(await this.repository.deleteItem(
        listIdObject,
        new Types.ObjectId(itemId),
      ))
    ) {
      throw itemNotFound();
    }
    const remaining = await this.repository.findItems(listIdObject);
    await this.repository.reorderItems(
      listIdObject,
      remaining.map((item) => item._id),
    );
    await this.repository.touch(listIdObject);
    await this.publishItemUpdate(list, userId);
  }

  async reorderItems(
    authenticatedUserId: string,
    listId: string,
    input: ReorderSharedListItemsDto,
  ): Promise<SharedListItemResponse[]> {
    const userId = toObjectId(authenticatedUserId);
    const listIdObject = new Types.ObjectId(listId);
    const list = await this.requireEditor(userId, listIdObject);
    const current = await this.repository.findItems(listIdObject);
    if (
      input.itemIds.length !== current.length ||
      !sameIds(
        input.itemIds,
        current.map((item) => item._id.toHexString()),
      )
    ) {
      throw invalidList("Item order must contain every list item exactly once.");
    }
    await this.repository.reorderItems(
      listIdObject,
      input.itemIds.map((id) => new Types.ObjectId(id)),
    );
    await this.repository.touch(listIdObject);
    await this.publishItemUpdate(list, userId);
    return this.withItemData(await this.repository.findItems(listIdObject));
  }

  async createInvite(
    authenticatedUserId: string,
    listId: string,
    input: CreateSharedListInviteDto,
  ): Promise<SharedListInviteResponse> {
    const userId = toObjectId(authenticatedUserId);
    const listIdObject = new Types.ObjectId(listId);
    const list = await this.requireOwner(userId, listIdObject);
    const target = await this.usersService.resolveByUsername(input.username);
    if (list.members.some((member) => member.userId.equals(target._id))) {
      throw memberAlreadyExists();
    }
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + INVITE_LIFETIME_MS);
    const invite = await this.repository.upsertInvite(
      listIdObject,
      userId,
      target._id,
      hashToken(token),
      input.role,
      expiresAt,
    );
    await this.notificationsService.publish({
      userId: target._id,
      type: NotificationType.SharedListInvite,
      actorUserId: userId,
      entityId: invite._id,
    });
    const frontendUrl = this.configService
      .getOrThrow<string>("FRONTEND_URL")
      .replace(/\/$/, "");
    return {
      id: invite._id.toHexString(),
      acceptUrl: `${frontendUrl}/lists/invites/${token}`,
      target: toPublicUserProfile(target),
      role: input.role,
      expiresAt: expiresAt.toISOString(),
      createdAt: invite.createdAt.toISOString(),
    };
  }

  async listInvites(
    authenticatedUserId: string,
    listId: string,
  ): Promise<SharedListPendingInviteResponse[]> {
    const ownerId = toObjectId(authenticatedUserId);
    const listIdObject = new Types.ObjectId(listId);
    await this.requireOwner(ownerId, listIdObject);
    const invites = await this.repository.findInvites(listIdObject);
    const targets = await this.usersService.findStoredByIds(
      uniqueObjectIds(
        invites.flatMap((invite) =>
          invite.targetUserId ? [invite.targetUserId] : [],
        ),
      ),
    );
    const targetsById = new Map(
      targets.map((target) => [target._id.toHexString(), target]),
    );

    return invites.flatMap((invite) => {
      if (!invite.targetUserId) return [];
      const target = targetsById.get(invite.targetUserId.toHexString());
      return target
        ? [
            {
              id: invite._id.toHexString(),
              target: toPublicUserProfile(target),
              role: invite.role,
              expiresAt: invite.expiresAt.toISOString(),
              createdAt: invite.createdAt.toISOString(),
            },
          ]
        : [];
    });
  }

  async revokeInvite(
    authenticatedUserId: string,
    listId: string,
    inviteId: string,
  ): Promise<void> {
    const ownerId = toObjectId(authenticatedUserId);
    const listIdObject = new Types.ObjectId(listId);
    await this.requireOwner(ownerId, listIdObject);
    const invite = await this.repository.deleteInviteForList(
      listIdObject,
      new Types.ObjectId(inviteId),
    );
    if (!invite) throw inviteNotFound();
    if (invite.targetUserId) {
      await this.notificationsService.removeEntity({
        userId: invite.targetUserId,
        type: NotificationType.SharedListInvite,
        entityId: invite._id,
      });
    }
  }

  async acceptInvite(
    authenticatedUserId: string,
    identifier: string,
  ): Promise<SharedListDetailsResponse> {
    const userId = toObjectId(authenticatedUserId);
    const accepted = await this.repository.runInTransaction(async (session) => {
      const invite = identifier.length === 24
        ? await this.repository.findInviteById(
            new Types.ObjectId(identifier),
            userId,
            session,
          )
        : await this.repository.findInviteByTokenHash(
            hashToken(identifier),
            userId,
            session,
          );
      if (!invite) throw invalidInvite();
      const existingMembership = await this.repository.findById(
        userId,
        invite.listId,
        session,
      );
      if (existingMembership) throw memberAlreadyExists();
      const joined = await this.repository.addMember(
        invite.listId,
        userId,
        invite.role,
        new Date(),
        session,
      );
      if (!joined) throw invalidInvite();
      await this.repository.deleteInvite(invite._id, session);
      return { list: joined, inviteId: invite._id };
    });
    await this.notificationsService.markEntityRead({
      userId,
      type: NotificationType.SharedListInvite,
      entityId: accepted.inviteId,
    });
    return this.withDetails(accepted.list, userId);
  }

  async updateMember(
    authenticatedUserId: string,
    listId: string,
    memberUserId: string,
    input: UpdateSharedListMemberDto,
  ): Promise<SharedListMemberResponse> {
    const ownerId = toObjectId(authenticatedUserId);
    const listIdObject = new Types.ObjectId(listId);
    const memberId = new Types.ObjectId(memberUserId);
    await this.requireOwner(ownerId, listIdObject);
    const list = await this.repository.updateMember(
      ownerId,
      listIdObject,
      memberId,
      input.role,
    );
    if (!list) throw memberNotFound();
    const [member] = await this.usersService.findStoredByIds([memberId]);
    if (!member) throw memberNotFound();
    const membership = list.members.find((candidate) =>
      candidate.userId.equals(memberId),
    );
    if (!membership) throw memberNotFound();
    return {
      user: toPublicUserProfile(member),
      role: input.role,
      joinedAt: membership.joinedAt.toISOString(),
    };
  }

  async removeMember(
    authenticatedUserId: string,
    listId: string,
    memberUserId: string,
  ): Promise<void> {
    const ownerId = toObjectId(authenticatedUserId);
    const listIdObject = new Types.ObjectId(listId);
    await this.requireOwner(ownerId, listIdObject);
    if (
      !(await this.repository.removeMember(
        ownerId,
        listIdObject,
        new Types.ObjectId(memberUserId),
      ))
    ) {
      throw memberNotFound();
    }
  }

  private async requireList(
    userId: Types.ObjectId,
    listId: Types.ObjectId,
  ): Promise<StoredSharedList> {
    const list = await this.repository.findById(userId, listId);
    if (!list) throw listNotFound();
    return list;
  }

  private async requireOwner(
    userId: Types.ObjectId,
    listId: Types.ObjectId,
  ): Promise<StoredSharedList> {
    const list = await this.requireList(userId, listId);
    if (sharedListRoleForUser(list, userId) !== SharedListRole.Owner) {
      throw listForbidden();
    }
    return list;
  }

  private async requireEditor(
    userId: Types.ObjectId,
    listId: Types.ObjectId,
  ): Promise<StoredSharedList> {
    const list = await this.requireList(userId, listId);
    const role = sharedListRoleForUser(list, userId);
    if (role !== SharedListRole.Owner && role !== SharedListRole.Editor) {
      throw listForbidden();
    }
    return list;
  }

  private async requireMedia(mediaId: Types.ObjectId): Promise<StoredMedia> {
    const media = await this.mediaRepository.findById(mediaId);
    if (!media) throw mediaNotFound();
    return media;
  }

  private async withSingleItemData(
    item: StoredSharedListItem,
  ): Promise<SharedListItemResponse> {
    const [response] = await this.withItemData([item]);
    if (!response) throw itemNotFound();
    return response;
  }

  private async publishItemUpdate(
    list: StoredSharedList,
    actorUserId: Types.ObjectId,
  ): Promise<void> {
    await Promise.all(
      uniqueObjectIds(list.members.map((member) => member.userId))
        .filter((userId) => !userId.equals(actorUserId))
        .map((userId) =>
          this.notificationsService.publish({
            userId,
            type: NotificationType.SharedItemUpdated,
            actorUserId,
            entityId: list._id,
          }),
        ),
    );
  }

  private async withDetails(
    list: StoredSharedList,
    userId: Types.ObjectId,
  ): Promise<SharedListDetailsResponse> {
    const items = await this.repository.findItems(list._id);
    const users = await this.usersService.findStoredByIds(
      uniqueObjectIds([
        ...list.members.map((member) => member.userId),
        ...items.map((item) => item.addedByUserId),
      ]),
    );
    const usersById = new Map(
      users.map((user) => [user._id.toHexString(), user]),
    );
    return {
      ...toListResponse(list, userId, items.length),
      members: list.members.flatMap((member) => {
        const user = usersById.get(member.userId.toHexString());
        return user
          ? [
              {
                user: toPublicUserProfile(user),
                role: member.role,
                joinedAt: member.joinedAt.toISOString(),
              } satisfies SharedListMemberResponse,
            ]
          : [];
      }),
      items: await this.withItemData(items, usersById),
    };
  }

  private async withItemData(
    items: StoredSharedListItem[],
    suppliedUsers?: Map<
      string,
      Parameters<typeof toPublicUserProfile>[0]
    >,
  ): Promise<SharedListItemResponse[]> {
    const [media, users] = await Promise.all([
      this.mediaRepository.findByIds(items.map((item) => item.mediaId)),
      suppliedUsers
        ? Promise.resolve([])
        : this.usersService.findStoredByIds(
            uniqueObjectIds(items.map((item) => item.addedByUserId)),
          ),
    ]);
    const mediaById = new Map(
      media.map((entry) => [entry._id.toHexString(), entry]),
    );
    const usersById =
      suppliedUsers ??
      new Map(users.map((user) => [user._id.toHexString(), user]));
    return items.map((item) => {
      const itemMedia = mediaById.get(item.mediaId.toHexString());
      if (!itemMedia) throw mediaNotFound();
      return this.toItemResponse(
        item,
        itemMedia,
        usersById.get(item.addedByUserId.toHexString()),
      );
    });
  }

  private toItemResponse(
    item: StoredSharedListItem,
    media: StoredMedia,
    addedBy?: Parameters<typeof toPublicUserProfile>[0],
  ): SharedListItemResponse {
    return {
      id: item._id.toHexString(),
      mediaId: item.mediaId.toHexString(),
      position: item.position,
      media: toMediaDetails(media),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      ...(addedBy ? { addedBy: toPublicUserProfile(addedBy) } : {}),
      ...(item.note === undefined ? {} : { note: item.note }),
      ...(item.groupStatus === undefined
        ? {}
        : { groupStatus: item.groupStatus }),
      ...(item.groupProgress === undefined
        ? {}
        : {
            groupProgress: {
              currentSeason: item.groupProgress.currentSeason,
              currentEpisode: item.groupProgress.currentEpisode,
            },
          }),
    };
  }
}

export function sharedListRoleForUser(
  list: StoredSharedList,
  userId: Types.ObjectId,
): SharedListRole | null {
  if (list.ownerId.equals(userId)) return SharedListRole.Owner;
  return (
    list.members.find((member) => member.userId.equals(userId))?.role ?? null
  );
}

function toListResponse(
  list: StoredSharedList,
  userId: Types.ObjectId,
  itemCount: number,
): SharedListResponse {
  return {
    id: list._id.toHexString(),
    title: list.title,
    visibility: list.visibility,
    role: sharedListRoleForUser(list, userId) ?? SharedListRole.Viewer,
    itemCount,
    createdAt: list.createdAt.toISOString(),
    updatedAt: list.updatedAt.toISOString(),
    ...(list.description === undefined ? {} : { description: list.description }),
    ...(list.publicSlug === undefined ? {} : { publicSlug: list.publicSlug }),
  };
}

function toPublicItemResponse(
  item: SharedListItemResponse,
): PublicSharedListItemResponse {
  const publicMedia = { ...item.media };
  Reflect.deleteProperty(publicMedia, "id");
  return {
    position: item.position,
    media: publicMedia,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    ...(item.addedBy === undefined ? {} : { addedBy: item.addedBy }),
    ...(item.note === undefined ? {} : { note: item.note }),
    ...(item.groupStatus === undefined
      ? {}
      : { groupStatus: item.groupStatus }),
    ...(item.groupProgress === undefined
      ? {}
      : { groupProgress: item.groupProgress }),
  };
}

function toPublicListPreviewMedia(
  media: StoredMedia,
): PublicSharedListPreviewMediaResponse {
  return {
    tmdbId: media.tmdbId,
    mediaType: media.mediaType,
    title: media.title,
    ...(media.posterPath === undefined
      ? {}
      : { posterPath: media.posterPath }),
    ...(media.posterUrl === undefined
      ? {}
      : { posterUrl: media.posterUrl }),
  };
}

function createPublicSlug(): string {
  return randomBytes(12).toString("base64url");
}

function sameIds(left: string[], right: string[]): boolean {
  const expected = new Set(right);
  return (
    new Set(left).size === left.length &&
    left.every((id) => expected.has(id))
  );
}

function uniqueObjectIds(ids: Types.ObjectId[]): Types.ObjectId[] {
  return [...new Map(ids.map((id) => [id.toHexString(), id])).values()];
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function toObjectId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error("Authenticated user ID is not a MongoDB ObjectId");
  }
  return new Types.ObjectId(id);
}

function isDuplicateKeyError(error: unknown): error is MongoServerError {
  return error instanceof MongoServerError && error.code === 11_000;
}

function listNotFound(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.NOT_FOUND,
    code: "NOT_FOUND",
    message: "Shared list not found.",
  });
}

function itemNotFound(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.NOT_FOUND,
    code: "NOT_FOUND",
    message: "Shared-list item not found.",
  });
}

function mediaNotFound(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.NOT_FOUND,
    code: "NOT_FOUND",
    message: "Media not found.",
  });
}

function listForbidden(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.FORBIDDEN,
    code: "FORBIDDEN",
    message: "You do not have permission to change this shared list.",
  });
}

function invalidList(message: string): ApiException {
  return new ApiException({
    statusCode: HttpStatus.BAD_REQUEST,
    code: "VALIDATION_ERROR",
    message,
  });
}

function itemAlreadyExists(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.CONFLICT,
    code: "SHARED_LIST_ITEM_ALREADY_EXISTS",
    message: "This title is already on the shared list.",
  });
}

function invalidInvite(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.BAD_REQUEST,
    code: "INVITE_INVALID",
    message: "This shared-list invitation is invalid or expired.",
  });
}

function inviteNotFound(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.NOT_FOUND,
    code: "NOT_FOUND",
    message: "Shared-list invitation not found.",
  });
}

function memberAlreadyExists(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.CONFLICT,
    code: "SHARED_LIST_MEMBER_ALREADY_EXISTS",
    message: "You already have access to this shared list.",
  });
}

function memberNotFound(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.NOT_FOUND,
    code: "NOT_FOUND",
    message: "Shared-list member not found.",
  });
}
