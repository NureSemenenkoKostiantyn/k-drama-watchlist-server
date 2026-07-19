import { type ArgumentMetadata } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsInt, IsString, Min, MinLength } from "class-validator";

import { ApiException } from "../errors/api-exception";
import { createValidationPipe } from "./validation-pipe";

class ExampleRequestDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page!: number;

  @IsString()
  @MinLength(1)
  query!: string;
}

const metadata: ArgumentMetadata = {
  type: "body",
  metatype: ExampleRequestDto,
};

describe("createValidationPipe", () => {
  it("transforms and validates a request DTO", async () => {
    const pipe = createValidationPipe();

    await expect(
      pipe.transform({ page: "2", query: "goblin" }, metadata),
    ).resolves.toEqual({ page: 2, query: "goblin" });
  });

  it("rejects unknown request properties", async () => {
    const pipe = createValidationPipe();

    await expect(
      pipe.transform(
        { page: 2, query: "goblin", userId: "untrusted" },
        metadata,
      ),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Request validation failed.",
    } satisfies Partial<ApiException>);
  });

  it("rejects invalid request values", async () => {
    const pipe = createValidationPipe();

    await expect(
      pipe.transform({ page: 0, query: "" }, metadata),
    ).rejects.toBeInstanceOf(ApiException);
  });
});
