import { ContractsController } from "./contracts.controller";

describe("ContractsController", () => {
  it("publishes the generated public API contract", () => {
    const document = new ContractsController().getContract();

    expect(document.openapi).toBe("3.1.0");
    expect(document.paths["/library"].post.operationId).toBe(
      "addLibraryEntry",
    );
    expect(document.components.schemas).toHaveProperty(
      "LibraryEntryResponse",
    );
    expect(document.components.schemas).toHaveProperty(
      "PublicWheelDetailsResponse",
    );
    expect(document.components.schemas).not.toHaveProperty(
      "UserMediaDocument",
    );
    expect(document.components.schemas).toHaveProperty("TierListResponse");
    expect(document.components.schemas).not.toHaveProperty("TierListDocument");
    expect(document.paths["/tier-lists/{tierListId}/layout"].patch.operationId).toBe("updateTierLayout");
    expect(document.paths["/public/tier-lists/{publicSlug}"].get.security).toEqual([]);
  });
});
