import { IsMongoId, IsString, Length, Matches } from "class-validator";

export class SharedListParamsDto {
  @IsMongoId()
  listId!: string;
}

export class SharedListItemParamsDto extends SharedListParamsDto {
  @IsMongoId()
  itemId!: string;
}

export class SharedListMemberParamsDto extends SharedListParamsDto {
  @IsMongoId()
  memberUserId!: string;
}

export class SharedListPendingInviteParamsDto extends SharedListParamsDto {
  @IsMongoId()
  inviteId!: string;
}

export class SharedListInviteParamsDto {
  @IsString()
  @Matches(/^(?:[a-f\d]{24}|[A-Za-z0-9_-]{43})$/)
  identifier!: string;
}

export class PublicSharedListParamsDto {
  @IsString()
  @Length(16, 16)
  @Matches(/^[A-Za-z0-9_-]+$/)
  publicSlug!: string;
}
