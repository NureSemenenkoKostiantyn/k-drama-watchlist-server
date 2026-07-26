import { IsMongoId } from "class-validator";

export class NotificationParamsDto {
  @IsMongoId()
  notificationId!: string;
}
