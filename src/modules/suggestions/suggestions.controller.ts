import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from "@nestjs/common";
import {
  Session,
  type UserSession,
} from "@thallesp/nestjs-better-auth";

import { type DramaWatchAuth } from "../../auth/auth.factory";
import {
  type SuggestionResponse,
  type SuggestionsResponse,
} from "../../common/types/suggestion.types";
import { CreateSuggestionDto } from "./dto/create-suggestion.dto";
import { SuggestionParamsDto } from "./dto/suggestion-params.dto";
import { SuggestionsService } from "./suggestions.service";

@Controller("suggestions")
export class SuggestionsController {
  constructor(
    private readonly suggestionsService: SuggestionsService,
  ) {}

  @Get()
  list(
    @Session() session: UserSession<DramaWatchAuth>,
  ): Promise<SuggestionsResponse> {
    return this.suggestionsService.list(session.user.id);
  }

  @Post()
  create(
    @Session() session: UserSession<DramaWatchAuth>,
    @Body() input: CreateSuggestionDto,
  ): Promise<SuggestionResponse> {
    return this.suggestionsService.create(session.user.id, input);
  }

  @Post(":suggestionId/accept")
  @HttpCode(HttpStatus.OK)
  accept(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: SuggestionParamsDto,
  ): Promise<SuggestionResponse> {
    return this.suggestionsService.accept(
      session.user.id,
      params.suggestionId,
    );
  }

  @Post(":suggestionId/dismiss")
  @HttpCode(HttpStatus.OK)
  dismiss(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: SuggestionParamsDto,
  ): Promise<SuggestionResponse> {
    return this.suggestionsService.dismiss(
      session.user.id,
      params.suggestionId,
    );
  }
}
