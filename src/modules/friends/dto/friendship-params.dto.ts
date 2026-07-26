import { IsMongoId } from "class-validator";

export class FriendshipParams {
  @IsMongoId()
  friendshipId!: string;
}
