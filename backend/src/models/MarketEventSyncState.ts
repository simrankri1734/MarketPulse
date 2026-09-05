import mongoose, {
  Document,
  Schema,
  Types,
} from "mongoose";

/*
 * =========================================================
 * TYPES
 * =========================================================
 */

export interface IMarketEventSyncState
  extends Document {
  stockId: Types.ObjectId;

  /*
   * Last time a corporate-action synchronization
   * completed successfully.
   *
   * This is deliberately stored in MongoDB so the
   * information survives backend restarts.
   */
  lastSyncedAt?: Date;

  /*
   * Temporary lock used to prevent two simultaneous
   * requests from synchronizing the same stock.
   */
  lockUntil?: Date;

  createdAt: Date;
  updatedAt: Date;
}

/*
 * =========================================================
 * SCHEMA
 * =========================================================
 */

const marketEventSyncStateSchema =
  new Schema<IMarketEventSyncState>(
    {
      stockId: {
        type: Schema.Types.ObjectId,
        ref: "Stock",
        required: true,
        unique: true,
        index: true,
      },

      lastSyncedAt: {
        type: Date,
      },

      lockUntil: {
        type: Date,
      },
    },
    {
      timestamps: true,
    }
  );

/*
 * =========================================================
 * MODEL
 * =========================================================
 */

export const MarketEventSyncState =
  mongoose.model<IMarketEventSyncState>(
    "MarketEventSyncState",
    marketEventSyncStateSchema
  );