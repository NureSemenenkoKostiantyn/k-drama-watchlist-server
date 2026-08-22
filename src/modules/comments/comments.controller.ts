import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";

import { type DramaWatchAuth } from "../../auth/auth.factory";
import { type CommentResponse } from "../../common/types/comment.types";
import {
  CommentParamsDto,
  ListItemCommentParamsDto,
} from "./dto/comment-params.dto";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { UpdateCommentDto } from "./dto/update-comment.dto";
import { CommentsService } from "./comments.service";

@Controller("lists/:listId/items/:itemId/comments")
export class ListItemCommentsController {
  constructor(private readonly service: CommentsService) {}

  @Get()
  list(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: ListItemCommentParamsDto,
  ): Promise<CommentResponse[]> {
    return this.service.list(session.user.id, params.listId, params.itemId);
  }

  @Post()
  create(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: ListItemCommentParamsDto,
    @Body() input: CreateCommentDto,
  ): Promise<CommentResponse> {
    return this.service.create(
      session.user.id,
      params.listId,
      params.itemId,
      input,
    );
  }
}

@Controller("comments")
export class CommentsController {
  constructor(private readonly service: CommentsService) {}

  @Patch(":commentId")
  update(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: CommentParamsDto,
    @Body() input: UpdateCommentDto,
  ): Promise<CommentResponse> {
    return this.service.update(session.user.id, params.commentId, input);
  }

  @Delete(":commentId")
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: CommentParamsDto,
  ): Promise<void> {
    return this.service.delete(session.user.id, params.commentId);
  }
}
