import { Types } from "mongoose";

import {
  WheelRole,
  WheelSelectionMode,
  WheelVisibility,
} from "../../common/types/wheel.types";
import {
  type StoredWheel,
  type StoredWheelItem,
} from "./wheels.repository";
import {
  selectWheelItem,
  wheelRoleForUser,
} from "./wheels.service";

describe("selectWheelItem", () => {
  const now = new Date("2026-07-24T12:00:00.000Z");

  it("selects enabled items according to their weights", () => {
    const light = createItem({ weight: 1 });
    const heavy = createItem({ weight: 3 });

    expect(
      selectWheelItem(
        [light, heavy],
        WheelSelectionMode.FullyRandom,
        () => 0.24,
      ),
    ).toBe(light);
    expect(
      selectWheelItem(
        [light, heavy],
        WheelSelectionMode.FullyRandom,
        () => 0.25,
      ),
    ).toBe(heavy);
  });

  it("never selects disabled items", () => {
    const disabled = createItem({ weight: 100, isEnabled: false });
    const enabled = createItem({ weight: 1 });

    expect(
      selectWheelItem(
        [disabled, enabled],
        WheelSelectionMode.FullyRandom,
        () => 0,
      ),
    ).toBe(enabled);
  });

  it("excludes the most recent winner when alternatives exist", () => {
    const recent = createItem({
      weight: 100,
      lastSelectedAt: now,
    });
    const older = createItem({
      weight: 1,
      lastSelectedAt: new Date(now.getTime() - 60_000),
    });

    expect(
      selectWheelItem(
        [recent, older],
        WheelSelectionMode.AvoidRecentWinners,
        () => 0,
      ),
    ).toBe(older);
  });

  it("keeps a sole enabled item eligible in avoid-recent mode", () => {
    const onlyItem = createItem({ lastSelectedAt: now });

    expect(
      selectWheelItem(
        [onlyItem],
        WheelSelectionMode.AvoidRecentWinners,
        () => 0.5,
      ),
    ).toBe(onlyItem);
  });

  it("rejects a spin when every item is disabled", () => {
    expect(() => {
      selectWheelItem(
        [createItem({ isEnabled: false })],
        WheelSelectionMode.FullyRandom,
      );
    }).toThrow("Enable at least one wheel item before spinning.");
  });
});

describe("wheelRoleForUser", () => {
  it("keeps the owner authoritative and resolves shared roles", () => {
    const ownerId = new Types.ObjectId();
    const editorId = new Types.ObjectId();
    const viewerId = new Types.ObjectId();
    const outsiderId = new Types.ObjectId();
    const wheel = createWheel(ownerId, [
      { userId: ownerId, role: WheelRole.Viewer },
      { userId: editorId, role: WheelRole.Editor },
      { userId: viewerId, role: WheelRole.Viewer },
    ]);

    expect(wheelRoleForUser(wheel, ownerId)).toBe(WheelRole.Owner);
    expect(wheelRoleForUser(wheel, editorId)).toBe(WheelRole.Editor);
    expect(wheelRoleForUser(wheel, viewerId)).toBe(WheelRole.Viewer);
    expect(wheelRoleForUser(wheel, outsiderId)).toBeNull();
  });
});

function createItem(
  overrides: Partial<StoredWheelItem> = {},
): StoredWheelItem {
  return {
    _id: new Types.ObjectId(),
    wheelId: new Types.ObjectId(),
    mediaId: new Types.ObjectId(),
    addedByUserId: new Types.ObjectId(),
    position: 0,
    weight: 1,
    isEnabled: true,
    selectionCount: 0,
    createdAt: new Date("2026-07-24T10:00:00.000Z"),
    updatedAt: new Date("2026-07-24T10:00:00.000Z"),
    ...overrides,
  };
}

function createWheel(
  ownerId: Types.ObjectId,
  members: StoredWheel["members"],
): StoredWheel {
  return {
    _id: new Types.ObjectId(),
    ownerId,
    title: "Shared picks",
    visibility: WheelVisibility.Private,
    selectionMode: WheelSelectionMode.FullyRandom,
    members,
    createdAt: new Date("2026-07-24T10:00:00.000Z"),
    updatedAt: new Date("2026-07-24T10:00:00.000Z"),
  };
}
