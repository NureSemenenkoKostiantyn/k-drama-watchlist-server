import { Injectable, Logger } from "@nestjs/common";
import { Types } from "mongoose";

import { type ActivityFeedResponse } from "../../common/types/activity.types";
import { type MediaSummary } from "../../common/types/media.types";
import { FriendsRepository } from "../friends/friends.repository";
import {
  MediaRepository,
  type StoredMedia,
} from "../media/media.repository";
import { SettingsService } from "../settings/settings.service";
import {
  toPublicUserProfile,
  UsersService,
} from "../users/users.service";
import { type ActivityFeedQueryDto } from "./dto/activity-feed-query.dto";
import {
  ActivityRepository,
  type PublishActivityInput,
} from "./activity.repository";

const ACTIVITY_RETENTION_MS = 180 * 24 * 60 * 60 * 1_000;

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(
    private readonly activityRepository: ActivityRepository,
    private readonly friendsRepository: FriendsRepository,
    private readonly settingsService: SettingsService,
    private readonly usersService: UsersService,
    private readonly mediaRepository: MediaRepository,
  ) {}

  async list(
    authenticatedUserId: string,
    query: ActivityFeedQueryDto,
  ): Promise<ActivityFeedResponse> {
    const viewerId = toObjectId(authenticatedUserId);
    const friendIds = await this.friendsRepository.findAcceptedCounterpartIds(
      viewerId,
    );
    const visibleActorIds =
      await this.settingsService.findVisibleFriendActivityUserIds(friendIds);
    const page = await this.activityRepository.findPage(
      visibleActorIds,
      query.page,
      query.limit,
    );
    const [actors, media] = await Promise.all([
      this.usersService.findStoredByIds(
        uniqueObjectIds(page.items.map((item) => item.actorUserId)),
      ),
      this.mediaRepository.findByIds(
        uniqueObjectIds(page.items.map((item) => item.mediaId)),
      ),
    ]);
    const actorsById = new Map(
      actors.map((actor) => [actor._id.toHexString(), actor]),
    );
    const mediaById = new Map(
      media.map((item) => [item._id.toHexString(), item]),
    );

    return {
      page: query.page,
      totalPages:
        page.totalResults === 0
          ? 0
          : Math.ceil(page.totalResults / query.limit),
      totalResults: page.totalResults,
      items: page.items.flatMap((item) => {
        const actor = actorsById.get(item.actorUserId.toHexString());
        const itemMedia = mediaById.get(item.mediaId.toHexString());
        if (!actor || !itemMedia) return [];
        return [
          {
            id: item._id.toHexString(),
            type: item.type,
            actor: toPublicUserProfile(actor),
            media: toMediaSummary(itemMedia),
            createdAt: item.createdAt.toISOString(),
            ...(item.status === undefined ? {} : { status: item.status }),
            ...(item.rating === undefined ? {} : { rating: item.rating }),
          },
        ];
      }),
    };
  }

  async publish(input: PublishActivityInput): Promise<void> {
    const createdAt = new Date();
    try {
      await this.activityRepository.create(
        input,
        createdAt,
        new Date(createdAt.getTime() + ACTIVITY_RETENTION_MS),
      );
    } catch (error: unknown) {
      this.logger.warn(
        { err: error, type: input.type },
        "Activity publication failed after the primary library write",
      );
    }
  }
}

function toMediaSummary(media: StoredMedia): MediaSummary {
  return {
    id: `${media.mediaType}:${media.tmdbId}`,
    tmdbId: media.tmdbId,
    mediaType: media.mediaType,
    title: media.title,
    originalTitle: media.originalTitle,
    originCountry: [...media.originCountry],
    genreIds: [...media.genreIds],
    ...(media.overview === undefined ? {} : { overview: media.overview }),
    ...(media.posterPath === undefined
      ? {}
      : { posterPath: media.posterPath }),
    ...(media.posterUrl === undefined ? {} : { posterUrl: media.posterUrl }),
    ...(media.releaseDate === undefined
      ? {}
      : { releaseDate: media.releaseDate }),
    ...(media.firstAirDate === undefined
      ? {}
      : { firstAirDate: media.firstAirDate }),
    ...(media.tmdbVoteAverage === undefined
      ? {}
      : { tmdbVoteAverage: media.tmdbVoteAverage }),
    ...(media.tmdbVoteCount === undefined
      ? {}
      : { tmdbVoteCount: media.tmdbVoteCount }),
  };
}

function uniqueObjectIds(ids: Types.ObjectId[]): Types.ObjectId[] {
  return [...new Map(ids.map((id) => [id.toHexString(), id])).values()];
}

function toObjectId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error("Authenticated user ID is not a MongoDB ObjectId");
  }
  return new Types.ObjectId(id);
}
