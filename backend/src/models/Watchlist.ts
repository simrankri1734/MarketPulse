import mongoose, { Document, Schema, Types } from "mongoose";

export interface IWatchlistStock {
  stockId: Types.ObjectId;
  position: number;
  addedAt: Date;
}

export interface IWatchlist extends Document {
  userId: Types.ObjectId;
  name: string;
  stocks: IWatchlistStock[];
  createdAt: Date;
  updatedAt: Date;
}

const watchlistStockSchema = new Schema<IWatchlistStock>(
  {
    stockId: {
      type: Schema.Types.ObjectId,
      ref: "Stock",
      required: true,
    },

    position: {
      type: Number,
      required: true,
      min: 0,
    },

    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  }
);

const watchlistSchema = new Schema<IWatchlist>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
    },

    stocks: {
      type: [watchlistStockSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

/*
 * Every user can have their own watchlist names,
 * but the same user cannot have two watchlists
 * with the same name, regardless of letter case.
 *
 * Examples:
 *
 * User A → "My Stocks" ✅
 * User A → "my stocks" ❌
 * User B → "My Stocks" ✅
 */
watchlistSchema.index(
  {
    userId: 1,
    name: 1,
  },
  {
    unique: true,
    collation: {
      locale: "en",
      strength: 2,
    },
  }
);

watchlistSchema.index({
  userId: 1,
  createdAt: -1,
});

export const Watchlist = mongoose.model<IWatchlist>(
  "Watchlist",
  watchlistSchema
);