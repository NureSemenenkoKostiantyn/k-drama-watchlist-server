import { type Provider } from "@nestjs/common";
import { getConnectionToken } from "@nestjs/mongoose";
import { type Connection, type Model } from "mongoose";

import {
  type WheelItemDocument,
  WheelItemSchema,
} from "./schema/wheel-item.schema";
import {
  type WheelSpinDocument,
  WheelSpinSchema,
} from "./schema/wheel-spin.schema";
import {
  type WheelDocument,
  WheelSchema,
} from "./schema/wheel.schema";

export const WHEEL_MODEL_NAME = "Wheel";
export const WHEEL_ITEM_MODEL_NAME = "WheelItem";
export const WHEEL_SPIN_MODEL_NAME = "WheelSpin";

export const WHEEL_MODEL = Symbol("WHEEL_MODEL");
export const WHEEL_ITEM_MODEL = Symbol("WHEEL_ITEM_MODEL");
export const WHEEL_SPIN_MODEL = Symbol("WHEEL_SPIN_MODEL");

export const wheelModelProviders: Provider[] = [
  {
    provide: WHEEL_MODEL,
    inject: [getConnectionToken()],
    useFactory: (connection: Connection): Model<WheelDocument> =>
      connection.model<WheelDocument>(WHEEL_MODEL_NAME, WheelSchema),
  },
  {
    provide: WHEEL_ITEM_MODEL,
    inject: [getConnectionToken()],
    useFactory: (connection: Connection): Model<WheelItemDocument> =>
      connection.model<WheelItemDocument>(
        WHEEL_ITEM_MODEL_NAME,
        WheelItemSchema,
      ),
  },
  {
    provide: WHEEL_SPIN_MODEL,
    inject: [getConnectionToken()],
    useFactory: (connection: Connection): Model<WheelSpinDocument> =>
      connection.model<WheelSpinDocument>(
        WHEEL_SPIN_MODEL_NAME,
        WheelSpinSchema,
      ),
  },
];
