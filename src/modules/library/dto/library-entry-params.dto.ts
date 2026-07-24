import { IsMongoId } from "class-validator";

export class LibraryEntryParams {
  @IsMongoId()
  entryId!: string;
}
