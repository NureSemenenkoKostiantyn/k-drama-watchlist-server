import { Schema, type Types } from "mongoose";

import { WatchStatus } from "../../../common/types/library.types";
import { MEDIA_MODEL_NAME } from "../../media/media-model.provider";

export interface UserMediaProgressDocument {
  currentSeason: number;
  currentEpisode: number;
  completedEpisodes: number;
  totalEpisodesSnapshot?: number;
  completedSeasonNumbers: number[];
  includeSpecials: boolean;
  updatedAt: Date;
}

export interface PlaybackAudioDocument {
  type: "original" | "dubbed" | "mixed" | "unknown";
  languageCode?: string;
  customLabel?: string;
}

export interface PlaybackPreferenceDocument {
  audio?: PlaybackAudioDocument;
  subtitleLanguageCode?: string;
}

export interface UserMediaDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  mediaId: Types.ObjectId;
  status: WatchStatus;
  progress?: UserMediaProgressDocument;
  rating?: number;
  description?: string;
  categoryIds: Types.ObjectId[];
  priorityLaneId?: Types.ObjectId;
  priorityPosition?: number;
  playbackPreference?: PlaybackPreferenceDocument;
  suggestedByUserId?: Types.ObjectId;
  startedAt?: Date;
  completedAt?: Date;
  lastProgressAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const progressSchema = new Schema<UserMediaProgressDocument>(
  {
    currentSeason: { type: Number, required: true, min: 0 },
    currentEpisode: { type: Number, required: true, min: 0 },
    completedEpisodes: { type: Number, required: true, min: 0 },
    totalEpisodesSnapshot: { type: Number, min: 0 },
    completedSeasonNumbers: { type: [Number], default: [] },
    includeSpecials: { type: Boolean, default: false },
    updatedAt: { type: Date, required: true },
  },
  {
    _id: false,
  },
);

const playbackAudioSchema = new Schema<PlaybackAudioDocument>(
  {
    type: {
      type: String,
      enum: ["original", "dubbed", "mixed", "unknown"],
      required: true,
    },
    languageCode: String,
    customLabel: String,
  },
  {
    _id: false,
  },
);

const playbackPreferenceSchema =
  new Schema<PlaybackPreferenceDocument>(
    {
      audio: {
        type: playbackAudioSchema,
        default: undefined,
      },
      subtitleLanguageCode: String,
    },
    {
      _id: false,
    },
  );

export const UserMediaSchema = new Schema<UserMediaDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    mediaId: {
      type: Schema.Types.ObjectId,
      ref: MEDIA_MODEL_NAME,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(WatchStatus),
      required: true,
    },
    progress: {
      type: progressSchema,
      default: undefined,
    },
    rating: {
      type: Number,
      min: 1,
      max: 10,
      validate: {
        validator: (rating: number): boolean =>
          Number.isInteger(rating * 2),
        message: "Rating must use half-point increments.",
      },
    },
    description: {
      type: String,
      maxlength: 5_000,
    },
    categoryIds: {
      type: [Schema.Types.ObjectId],
      default: [],
    },
    priorityLaneId: Schema.Types.ObjectId,
    priorityPosition: Number,
    playbackPreference: {
      type: playbackPreferenceSchema,
      default: undefined,
    },
    suggestedByUserId: Schema.Types.ObjectId,
    startedAt: Date,
    completedAt: Date,
    lastProgressAt: Date,
  },
  {
    collection: "userMedia",
    timestamps: true,
    versionKey: false,
  },
);

UserMediaSchema.index({ userId: 1, mediaId: 1 }, { unique: true });
UserMediaSchema.index({ userId: 1, status: 1 });
UserMediaSchema.index({
  userId: 1,
  priorityLaneId: 1,
  priorityPosition: 1,
});
UserMediaSchema.index({ userId: 1, updatedAt: -1 });
