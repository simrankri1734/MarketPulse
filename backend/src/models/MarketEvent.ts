import mongoose, { Document, Schema, Types } from "mongoose";

export interface IMarketEvent extends Document {
  stockId: Types.ObjectId;

  eventType: string;
  title: string;
  description?: string;

  eventTime: Date;
  source: string;
  fetchedAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

const marketEventSchema = new Schema<IMarketEvent>(
  {
    stockId: {
      type: Schema.Types.ObjectId,
      ref: "Stock",
      required: true,
      index: true,
    },

    eventType: {
      type: String,
      required: true,
      trim: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    eventTime: {
      type: Date,
      required: true,
      index: true,
    },

    source: {
      type: String,
      required: true,
      trim: true,
    },

    fetchedAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Fast lookup of recent events for a stock.
marketEventSchema.index({
  stockId: 1,
  eventTime: -1,
});

// Prevent duplicate corporate events.
marketEventSchema.index(
  {
    stockId: 1,
    eventType: 1,
    eventTime: 1,
    title: 1,
  },
  {
    unique: true,
  }
);

export const MarketEvent = mongoose.model<IMarketEvent>(
  "MarketEvent",
  marketEventSchema
);