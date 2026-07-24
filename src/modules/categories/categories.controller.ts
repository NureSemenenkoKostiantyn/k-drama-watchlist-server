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
import {
  Session,
  type UserSession,
} from "@thallesp/nestjs-better-auth";

import { type DramaWatchAuth } from "../../auth/auth.factory";
import { type CategoryResponse } from "../../common/types/category.types";
import { CategoriesService } from "./categories.service";
import { CategoryParams } from "./dto/category-params.dto";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

@Controller("categories")
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  list(
    @Session() session: UserSession<DramaWatchAuth>,
  ): Promise<CategoryResponse[]> {
    return this.categoriesService.list(session.user.id);
  }

  @Post()
  create(
    @Session() session: UserSession<DramaWatchAuth>,
    @Body() input: CreateCategoryDto,
  ): Promise<CategoryResponse> {
    return this.categoriesService.create(session.user.id, input);
  }

  @Patch(":categoryId")
  update(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: CategoryParams,
    @Body() input: UpdateCategoryDto,
  ): Promise<CategoryResponse> {
    return this.categoriesService.update(
      session.user.id,
      params.categoryId,
      input,
    );
  }

  @Delete(":categoryId")
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @Session() session: UserSession<DramaWatchAuth>,
    @Param() params: CategoryParams,
  ): Promise<void> {
    return this.categoriesService.delete(
      session.user.id,
      params.categoryId,
    );
  }
}
