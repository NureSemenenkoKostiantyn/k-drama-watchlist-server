import { IsMongoId } from "class-validator";

export class UserIdParams {
  @IsMongoId()
  userId!: string;
}
