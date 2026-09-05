import mongoose, { Document, Schema, Types } from "mongoose";

export interface IMarketSnapshot extends Document {
  userId: Types.ObjectId;
  watchlistId: Types.ObjectId;
  stockId: Types.ObjectId;

  price: number;
  volume: number;

  marketDataTime: Date;
  fetchedAt: Date;

  dataSource: string;
  dataStatus: "FRESH" | "DELAYED" | "STALE";

  createdAt: Date;
}

const marketSnapshotSchema = new Schema<IMarketSnapshot>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    watchlistId: {
      type: Schema.Types.ObjectId,
      ref: "Watchlist",
      required: true,
      index: true
    },

    stockId: {
      type: Schema.Types.ObjectId,
      ref: "Stock",
      required: true,
      index: true
    },

    price: {
      type: Number,
      required: true,
      min: 0
    },

    volume: {
      type: Number,
      required: true,
      min: 0
    },

    marketDataTime: {
      type: Date,
      required: true,
      index: true
    },

    fetchedAt: {
      type: Date,
      required: true
    },

    dataSource: {
      type: String,
      required: true,
      trim: true
    },

    dataStatus: {
      type: String,
      enum: ["FRESH", "DELAYED", "STALE"],
      required: true
    }
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false
    }
  }
);

marketSnapshotSchema.index({
  userId: 1,
  watchlistId: 1,
  stockId: 1,
  createdAt: -1
});

export const MarketSnapshot = mongoose.model<IMarketSnapshot>(
  "MarketSnapshot",
  marketSnapshotSchema
);