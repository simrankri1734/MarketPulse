import mongoose, { Document, Schema } from "mongoose";

export interface IStock extends Document {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

const stockSchema = new Schema<IStock>(
  {
    symbol: {
      type: String,
      required: true,
      unique: true,
      index: true,
      uppercase: true,
      trim: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    exchange: {
      type: String,
      required: true,
      trim: true
    },

    currency: {
      type: String,
      required: true,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

export const Stock = mongoose.model<IStock>("Stock", stockSchema);