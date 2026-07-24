import { Module } from "@nestjs/common";

import { categoryModelProvider } from "./category-model.provider";
import { CategoriesController } from "./categories.controller";
import { CategoriesRepository } from "./categories.repository";
import { CategoriesService } from "./categories.service";

@Module({
  controllers: [CategoriesController],
  providers: [
    categoryModelProvider,
    CategoriesRepository,
    CategoriesService,
  ],
  exports: [CategoriesService],
})
export class CategoriesModule {}
