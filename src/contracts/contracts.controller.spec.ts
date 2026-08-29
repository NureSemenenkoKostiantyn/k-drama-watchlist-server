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
  });
});
