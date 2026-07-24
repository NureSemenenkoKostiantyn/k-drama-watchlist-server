import { Type } from "class-transformer";
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";

import { AudioType } from "../../../common/types/library.types";

export class PlaybackAudioDto {
  @IsEnum(AudioType)
  type!: AudioType;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  languageCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  customLabel?: string;
}

export class UpdatePlaybackPreferenceDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => PlaybackAudioDto)
  audio?: PlaybackAudioDto | null;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  subtitleLanguageCode?: string | null;
}
