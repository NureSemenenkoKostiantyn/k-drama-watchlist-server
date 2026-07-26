import { HttpStatus, Injectable } from "@nestjs/common";
import { Types } from "mongoose";

import { ApiException } from "../../common/errors/api-exception";
import { type MediaSummary } from "../../common/types/media.types";
import { type PublicLibraryResponse } from "../../common/types/public-library.types";
import { LibraryVisibility } from "../../common/types/settings.types";
import { FriendsService } from "../friends/friends.service";
import { type MediaDocument } from "../media/schema/media.schema";
import { SettingsService } from "../settings/settings.service";
import {
  toPublicUserProfile,
  UsersService,
} from "../users/users.service";
import { type PublicLibraryQuery } from "./dto/public-library-query.dto";
import { PublicLibraryRepository } from "./public-library.repository";

@Injectable()
export class PublicLibraryService {
  constructor(
    private readonly publicLibraryRepository: PublicLibraryRepository,
    private readonly usersService: UsersService,
    private readonly settingsService: SettingsService,
    private readonly friendsService: FriendsService,
  ) {}

  async getByUsername(
    viewerUserId: string | undefined,
    username: string,
    query: PublicLibraryQuery,
  ): Promise<PublicLibraryResponse> {
    if (
      query.yearFrom !== undefined &&
      query.yearTo !== undefined &&
      query.yearFrom > query.yearTo
    ) {
      throw invalidYearRange();
    }

    const owner = await this.usersService.resolveByUsername(username);
    const viewerId =
      viewerUserId === undefined ? undefined : toObjectId(viewerUserId);
    const isOwner = viewerId?.equals(owner._id) ?? false;
    const settings = await this.settingsService.getForUser(owner._id);

    if (
      !(await this.canView(
        viewerId,
        owner._id,
        settings.libraryVisibility,
        isOwner,
      ))
    ) {
      throw libraryNotVisible();
    }

    const page = await this.publicLibraryRepository.findPage(
      owner._id,
      query,
    );

    return {
      user: toPublicUserProfile(owner),
      visibility: settings.libraryVisibility,
      isOwner,
      page: query.page,
      totalPages:
        page.totalResults === 0
          ? 0
          : Math.ceil(page.totalResults / query.limit),
      totalResults: page.totalResults,
      items: page.items.map((item) => ({
        status: item.status,
        media: toMediaSummary(item.media),
        ...(item.rating === undefined
          ? {}
          : { rating: item.rating }),
      })),
    };
  }

  private async canView(
    viewerId: Types.ObjectId | undefined,
    ownerId: Types.ObjectId,
    visibility: LibraryVisibility,
    isOwner: boolean,
  ): Promise<boolean> {
    if (isOwner || visibility === LibraryVisibility.Public) {
      return true;
    }

    if (
      visibility !== LibraryVisibility.Friends ||
      viewerId === undefined
    ) {
      return false;
    }

    return this.friendsService.areAcceptedFriends(viewerId, ownerId);
  }
}

function toMediaSummary(media: MediaDocument): MediaSummary {
  return {
    id: `${media.mediaType}:${media.tmdbId}`,
    tmdbId: media.tmdbId,
    mediaType: media.mediaType,
    title: media.title,
    originalTitle: media.originalTitle,
    originCountry: [...media.originCountry],
    genreIds: [...media.genreIds],
    ...(media.overview === undefined
      ? {}
      : { overview: media.overview }),
    ...(media.posterPath === undefined
      ? {}
      : { posterPath: media.posterPath }),
    ...(media.posterUrl === undefined
      ? {}
      : { posterUrl: media.posterUrl }),
    ...(media.backdropPath === undefined
      ? {}
      : { backdropPath: media.backdropPath }),
    ...(media.backdropUrl === undefined
      ? {}
      : { backdropUrl: media.backdropUrl }),
    ...(media.releaseDate === undefined
      ? {}
      : { releaseDate: media.releaseDate }),
    ...(media.firstAirDate === undefined
      ? {}
      : { firstAirDate: media.firstAirDate }),
    ...(media.originalLanguage === undefined
      ? {}
      : { originalLanguage: media.originalLanguage }),
    ...(media.tmdbVoteAverage === undefined
      ? {}
      : { tmdbVoteAverage: media.tmdbVoteAverage }),
    ...(media.tmdbVoteCount === undefined
      ? {}
      : { tmdbVoteCount: media.tmdbVoteCount }),
  };
}

function toObjectId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error("Authenticated user ID is not a MongoDB ObjectId");
  }

  return new Types.ObjectId(id);
}

function libraryNotVisible(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.FORBIDDEN,
    code: "LIBRARY_NOT_VISIBLE",
    message: "This library is not available to you.",
  });
}

function invalidYearRange(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.BAD_REQUEST,
    code: "INVALID_YEAR_RANGE",
    message: "The starting year cannot be after the ending year.",
  });
}
