import { IsMongoId } from "class-validator";

export class ListItemCommentParamsDto {
  @IsMongoId()
  listId!: string;

  @IsMongoId()
  itemId!: string;
}

export class CommentParamsDto {
  @IsMongoId()
  commentId!: string;
}
