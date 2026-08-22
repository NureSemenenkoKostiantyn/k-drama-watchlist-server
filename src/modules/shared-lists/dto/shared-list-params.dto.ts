import { IsMongoId, IsString, Matches } from "class-validator";

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

export class SharedListInviteParamsDto {
  @IsString()
  @Matches(/^(?:[a-f\d]{24}|[A-Za-z0-9_-]{43})$/)
  identifier!: string;
}
