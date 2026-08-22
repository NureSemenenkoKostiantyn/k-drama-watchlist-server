import { IsMongoId, IsString, Length } from "class-validator";

export class SharedListParamsDto {
  @IsMongoId()
  listId!: string;
}

export class SharedListItemParamsDto extends SharedListParamsDto {
  @IsMongoId()
  itemId!: string;
}

export class SharedListInviteParamsDto {
  @IsString()
  @Length(43, 43)
  token!: string;
}
