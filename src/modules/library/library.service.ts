import { HttpStatus, Injectable } from "@nestjs/common";
import { MongoServerError } from "mongodb";
import { Types } from "mongoose";

import { ApiException } from "../../common/errors/api-exception";
import {
  type LibraryEntryResponse,
  WatchStatus,
} from "../../common/types/library.types";
import {
  MediaRepository,
  type StoredMedia,
  toMediaDetails,
} from "../media/media.repository";
import { MediaService } from "../media/media.service";
import { type AddLibraryEntryDto } from "./dto/add-library-entry.dto";
import {
  LibraryRepository,
  type StoredUserMedia,
} from "./library.repository";

@Injectable()
export class LibraryService {
  constructor(
    private readonly libraryRepository: LibraryRepository,
    private readonly mediaRepository: MediaRepository,
    private readonly mediaService: MediaService,
  ) {}

  async list(
    authenticatedUserId: string,
    status?: WatchStatus,
  ): Promise<LibraryEntryResponse[]> {
    const userId = toObjectId(authenticatedUserId);
    const entries = await this.libraryRepository.findAll(userId, status);
    const media = await this.mediaRepository.findByIds(
      entries.map((entry) => entry.mediaId),
    );
    const mediaById = new Map(
      media.map((item) => [item._id.toHexString(), item]),
    );

    return entries.map((entry) => {
      const item = mediaById.get(entry.mediaId.toHexString());

      if (!item) {
        throw new Error(
          `Library entry ${entry._id.toHexString()} references missing media`,
        );
      }

      return toLibraryEntryResponse(entry, item);
    });
  }

  async add(
    authenticatedUserId: string,
    input: AddLibraryEntryDto,
  ): Promise<LibraryEntryResponse> {
    const userId = toObjectId(authenticatedUserId);
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

    const existing = await this.libraryRepository.findByMedia(
      userId,
      media._id,
    );

    if (existing) {
      throw mediaAlreadyInLibrary();
    }

    try {
      const entry = await this.libraryRepository.create(
        userId,
        media._id,
        input.status,
      );
      return toLibraryEntryResponse(entry, media);
    } catch (error: unknown) {
      if (isDuplicateKeyError(error)) {
        throw mediaAlreadyInLibrary();
      }

      throw error;
    }
  }

  async get(
    authenticatedUserId: string,
    entryId: string,
  ): Promise<LibraryEntryResponse> {
    const entry = await this.findOwnedEntry(
      toObjectId(authenticatedUserId),
      new Types.ObjectId(entryId),
    );
    return this.withMedia(entry);
  }

  async updateStatus(
    authenticatedUserId: string,
    entryId: string,
    status: WatchStatus,
  ): Promise<LibraryEntryResponse> {
    const entry = await this.libraryRepository.updateStatus(
      toObjectId(authenticatedUserId),
      new Types.ObjectId(entryId),
      status,
    );

    if (!entry) {
      throw libraryEntryNotFound();
    }

    return this.withMedia(entry);
  }

  async delete(
    authenticatedUserId: string,
    entryId: string,
  ): Promise<void> {
    const deleted = await this.libraryRepository.delete(
      toObjectId(authenticatedUserId),
      new Types.ObjectId(entryId),
    );

    if (!deleted) {
      throw libraryEntryNotFound();
    }
  }

  private async findOwnedEntry(
    userId: Types.ObjectId,
    entryId: Types.ObjectId,
  ): Promise<StoredUserMedia> {
    const entry = await this.libraryRepository.findById(userId, entryId);

    if (!entry) {
      throw libraryEntryNotFound();
    }

    return entry;
  }

  private async withMedia(
    entry: StoredUserMedia,
  ): Promise<LibraryEntryResponse> {
    const media = await this.mediaRepository.findById(entry.mediaId);

    if (!media) {
      throw new Error(
        `Library entry ${entry._id.toHexString()} references missing media`,
      );
    }

    return toLibraryEntryResponse(entry, media);
  }
}

function toLibraryEntryResponse(
  entry: StoredUserMedia,
  media: StoredMedia,
): LibraryEntryResponse {
  return {
    id: entry._id.toHexString(),
    mediaId: entry.mediaId.toHexString(),
    status: entry.status,
    media: toMediaDetails(media),
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    ...(entry.rating === undefined ? {} : { rating: entry.rating }),
    ...(entry.description === undefined
      ? {}
      : { description: entry.description }),
  };
}

function toObjectId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error("Authenticated user ID is not a MongoDB ObjectId");
  }

  return new Types.ObjectId(id);
}

function mediaAlreadyInLibrary(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.CONFLICT,
    code: "MEDIA_ALREADY_IN_LIBRARY",
    message: "This title is already in your library.",
  });
}

function libraryEntryNotFound(): ApiException {
  return new ApiException({
    statusCode: HttpStatus.NOT_FOUND,
    code: "NOT_FOUND",
    message: "Library entry not found.",
  });
}

function isDuplicateKeyError(error: unknown): error is MongoServerError {
  return error instanceof MongoServerError && error.code === 11_000;
}
