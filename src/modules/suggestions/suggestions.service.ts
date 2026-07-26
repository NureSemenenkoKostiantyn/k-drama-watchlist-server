import { HttpStatus, Injectable } from "@nestjs/common";
import { Types } from "mongoose";

import { ApiException } from "../../common/errors/api-exception";
import {
  type SuggestionDirection,
  type SuggestionResponse,
  type SuggestionsResponse,
} from "../../common/types/suggestion.types";
import { NotificationType } from "../../common/types/notification.types";
import { FriendsService } from "../friends/friends.service";
import {
  MediaRepository,
  type StoredMedia,
  toMediaDetails,
} from "../media/media.repository";
import { MediaService } from "../media/media.service";
import { NotificationsService } from "../notifications/notifications.service";
import { type StoredPublicUser } from "../users/users.repository";
import {
  toPublicUserProfile,
  UsersService,
} from "../users/users.service";
import { type CreateSuggestionDto } from "./dto/create-suggestion.dto";
import {
  type StoredSuggestion,
  SuggestionsRepository,
} from "./suggestions.repository";

@Injectable()
export class SuggestionsService {
  constructor(
    private readonly suggestionsRepository: SuggestionsRepository,
    private readonly friendsService: FriendsService,
    private readonly usersService: UsersService,
    private readonly mediaRepository: MediaRepository,
    private readonly mediaService: MediaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async list(authenticatedUserId: string): Promise<SuggestionsResponse> {
    const userId = toObjectId(authenticatedUserId);
    const suggestions =
      await this.suggestionsRepository.findAllForUser(userId);
    const users = await this.usersService.findStoredByIds(
      uniqueObjectIds(
        suggestions.map((suggestion) =>
          counterpartId(suggestion, userId),
        ),
      ),
    );
    const media = await this.mediaRepository.findByIds(
      uniqueObjectIds(
        suggestions.map((suggestion) => suggestion.mediaId),
      ),
    );
    const usersById = new Map(
      users.map((user) => [user._id.toHexString(), user]),
    );
    const mediaById = new Map(
      media.map((item) => [item._id.toHexString(), item]),
    );
    const response: SuggestionsResponse = {
      received: [],
      sent: [],
    };

    for (const suggestion of suggestions) {
      const direction: SuggestionDirection =
        suggestion.toUserId.equals(userId) ? "received" : "sent";
      const user = usersById.get(
        counterpartId(suggestion, userId).toHexString(),
      );
      const item = mediaById.get(suggestion.mediaId.toHexString());

      if (!user || !item) {
        continue;
      }

      response[direction].push(
        toSuggestionResponse(
          suggestion,
          user,
          item,
          direction,
        ),
      );
    }

    return response;
  }

  async create(
    authenticatedUserId: string,
    input: CreateSuggestionDto,
  ): Promise<SuggestionResponse> {
    const fromUserId = toObjectId(authenticatedUserId);
    const recipient = await this.usersService.resolveByUsername(
      input.username,
    );

    if (fromUserId.equals(recipient._id)) {
      throw invalidSuggestion(
        "You cannot suggest a title to yourself.",
      );
    }

    if (
      !(await this.friendsService.areAcceptedFriends(
        fromUserId,
        recipient._id,
      ))
    ) {
      throw friendshipRequired();
    }

    let media = await this.mediaRepository.findByIdentity(
      input.mediaType,
      input.tmdbId,
    );

    if (!media) {
      const details = await this.mediaService.getDetails(
        input.mediaType,
        input.tmdbId,
      );
      media = await this.mediaRepository.upsertSnapshot(details);
    }

    const suggestion = await this.suggestionsRepository.create(
      fromUserId,
      recipient._id,
      media._id,
      input.message,
    );
    await this.notificationsService.publish({
      userId: recipient._id,
      type: NotificationType.SuggestionReceived,
      actorUserId: fromUserId,
      entityId: suggestion._id,
    });
    return toSuggestionResponse(
      suggestion,
      recipient,
      media,
      "sent",
    );
  }

  async accept(
    authenticatedUserId: string,
    suggestionId: string,
  ): Promise<SuggestionResponse> {
    return this.respond(
      authenticatedUserId,
      suggestionId,
      (id, userId) =>
        this.suggestionsRepository.accept(id, userId, new Date()),
    );
  }

  async dismiss(
    authenticatedUserId: string,
    suggestionId: string,
  ): Promise<SuggestionResponse> {
    return this.respond(
      authenticatedUserId,
      suggestionId,
      (id, userId) =>
        this.suggestionsRepository.dismiss(id, userId, new Date()),
    );
  }

  private async respond(
    authenticatedUserId: string,
    suggestionId: string,
    response: (
      suggestionId: Types.ObjectId,
      userId: Types.ObjectId,
    ) => Promise<StoredSuggestion | null>,
  ): Promise<SuggestionResponse> {
    const userId = toObjectId(authenticatedUserId);
    const suggestion = await response(
      new Types.ObjectId(suggestionId),
      userId,
    );

    if (!suggestion) {
      throw suggestionNotFound();
    }

    const [senders, media] = await Promise.all([
      this.usersService.findStoredByIds([suggestion.fromUserId]),
      this.mediaRepository.findById(suggestion.mediaId),
    ]);
    const sender = senders[0];

    if (!sender || !media) {
      throw suggestionNotFound();
    }

    return toSuggestionResponse(
      suggestion,
      sender,
      media,
      "received",
    );
  }
}

function toSuggestionResponse(
  suggestion: StoredSuggestion,
  user: StoredPublicUser,
  media: StoredMedia,
  direction: SuggestionDirection,
): SuggestionResponse {
  return {
    id: suggestion._id.toHexString(),
    status: suggestion.status,
    direction,
    user: toPublicUserProfile(user),
    media: toMediaDetails(media),
    createdAt: suggestion.createdAt.toISOString(),
    ...(suggestion.message === undefined
      ? {}
      : { message: suggestion.message }),
    ...(suggestion.respondedAt === undefined
      ? {}
      : { respondedAt: suggestion.respondedAt.toISOString() }),
  };
}

function counterpartId(
  suggestion: StoredSuggestion,
  authenticatedUserId: Types.ObjectId,
): Types.ObjectId {
  return suggestion.fromUserId.equals(authenticatedUserId)
    ? suggestion.toUserId
    : suggestion.fromUserId;
}

function uniqueObjectIds(ids: Types.ObjectId[]): Types.ObjectId[] {
  return [
    ...new Map(ids.map((id) => [id.toHexString(), id])).values(),
  ];
}

function toObjectId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error("Authenticated user ID is not a MongoDB ObjectId");
  }

  return new Types.ObjectId(id);
}

function invalidSuggestion(message: string): ApiException {
  return new ApiException({
    statusCode: HttpStatus.BAD_REQUEST,
    code: "INVALID_SUGGESTION",
    message,
  });
}

function friendshipRequired(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.FORBIDDEN,
    code: "FRIENDSHIP_REQUIRED",
    message: "You can suggest titles only to accepted friends.",
  });
}

function suggestionNotFound(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.NOT_FOUND,
    code: "NOT_FOUND",
    message: "Pending suggestion not found.",
  });
}
