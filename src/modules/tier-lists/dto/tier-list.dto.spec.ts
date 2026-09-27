import { createValidationPipe } from "../../../common/validation/validation-pipe";
import {
  AddTierItemsDto,
  CreateTierListDto,
  RevisionDto,
  TierListParamsDto,
  UpdateTierLayoutDto,
  UpdateTierListDto,
} from "./tier-list.dto";

describe("tier-list validation", () => {
  const pipe = createValidationPipe();
  const validate = (metatype: new () => object, value: unknown) =>
    pipe.transform(value, { type: "body", metatype });

  it("trims names and rejects empty titles and unknown properties", async () => {
    await expect(
      validate(CreateTierListDto, { title: "  My list " }),
    ).resolves.toMatchObject({ title: "My list" });
    await expect(
      validate(CreateTierListDto, { title: "   " }),
    ).rejects.toThrow();
    await expect(
      validate(CreateTierListDto, { title: "List", ownerId: "attacker" }),
    ).rejects.toThrow();
  });
  it.each([undefined, null, true, false, "", -1, 0.5, "invalid"])(
    "rejects invalid revision %p",
    async (revision) => {
      await expect(validate(RevisionDto, { revision })).rejects.toThrow();
    },
  );
  it("accepts revision zero including a DELETE query parameter", async () => {
    await expect(validate(RevisionDto, { revision: 0 })).resolves.toMatchObject(
      { revision: 0 },
    );
    await expect(
      validate(RevisionDto, { revision: "0" }),
    ).resolves.toMatchObject({ revision: 0 });
  });
  it("validates nested rows, colors, lengths, media identities and bounds", async () => {
    for (const tiers of [
      [],
      Array.from({ length: 21 }, () => ({
        id: "s",
        label: "S",
        color: "red",
        mediaIds: [],
      })),
      [{ id: "s", label: "S", color: "url(evil)", mediaIds: [] }],
      [{ id: "s", label: "S", color: "red", mediaIds: ["tv:1", "tv:1"] }],
    ]) {
      await expect(
        validate(UpdateTierLayoutDto, {
          revision: 0,
          tiers,
          unrankedMediaIds: [],
        }),
      ).rejects.toThrow();
    }
    await expect(
      validate(AddTierItemsDto, {
        revision: 0,
        items: [{ mediaType: "person", tmdbId: 1 }],
      }),
    ).rejects.toThrow();
    await expect(
      validate(AddTierItemsDto, {
        revision: 0,
        items: Array.from({ length: 51 }, () => ({
          mediaType: "tv",
          tmdbId: 1,
        })),
      }),
    ).rejects.toThrow();
    await expect(
      validate(TierListParamsDto, { tierListId: "bad-id" }),
    ).rejects.toThrow();
    await expect(
      validate(UpdateTierListDto, {
        revision: 0,
        title: "List",
        description: "",
        visibility: "friends",
      }),
    ).rejects.toThrow();
  });
});
