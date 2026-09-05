import { Types } from "mongoose";
import { MarketSnapshot } from "../models/MarketSnapshot.js";

export interface PreviousCheck {
  price: number;
  volume: number;
  checkedAt: Date;
}

export interface LastSuccessfulSnapshot {
  price: number;
  volume: number;

  marketDataTime: Date;
  fetchedAt: Date;

  dataSource: string;
  dataStatus: "FRESH" | "DELAYED" | "STALE";
}

export interface ChangeSinceLastCheck {
  priceChange: number;
  percentChange: number;
  volumeChange: number;
  volumeChangePercent: number;
}

interface SaveSnapshotInput {
  userId: Types.ObjectId;
  watchlistId: Types.ObjectId;
  stockId: Types.ObjectId;

  price: number;
  volume: number;

  marketDataTime: Date;
  fetchedAt: Date;

  dataSource: string;
  dataStatus: "FRESH" | "DELAYED" | "STALE";
}


/*
 * =========================================================
 * GET PREVIOUS SUCCESSFUL CHECK
 * =========================================================
 *
 * Only successful market snapshots are stored.
 *
 * The latest snapshot becomes the user's previous
 * successful check.
 */

export async function getPreviousCheck(
  userId: Types.ObjectId,
  watchlistId: Types.ObjectId,
  stockId: Types.ObjectId
): Promise<PreviousCheck | null> {

  const snapshot = await MarketSnapshot.findOne({
    userId,
    watchlistId,
    stockId,
  })
    .sort({ createdAt: -1 })
    .lean();

  if (!snapshot) {
    return null;
  }

  return {
    price: snapshot.price,
    volume: snapshot.volume,
    checkedAt: snapshot.createdAt,
  };
}

/*
 * =========================================================
 * GET LAST SUCCESSFUL MARKET SNAPSHOT
 * =========================================================
 *
 * Used as a fallback when the external market-data
 * provider is temporarily unavailable.
 *
 * Because failed market-data requests are never saved
 * as snapshots, the latest snapshot is the last
 * successfully retrieved market observation.
 */

export async function getLastSuccessfulSnapshot(
  userId: Types.ObjectId,
  watchlistId: Types.ObjectId,
  stockId: Types.ObjectId
): Promise<LastSuccessfulSnapshot | null> {
  const snapshot = await MarketSnapshot.findOne({
    userId,
    watchlistId,
    stockId,
  })
    .sort({ createdAt: -1 })
    .lean();

  if (!snapshot) {
    return null;
  }

  return {
    price: snapshot.price,
    volume: snapshot.volume,

    marketDataTime: snapshot.marketDataTime,
    fetchedAt: snapshot.fetchedAt,

    dataSource: snapshot.dataSource,
    dataStatus: snapshot.dataStatus,
  };
}


/*
 * =========================================================
 * CALCULATE CHANGE SINCE LAST CHECK
 * =========================================================
 */

export function calculateChangeSinceLastCheck(
  previous: PreviousCheck,
  currentPrice: number,
  currentVolume: number
): ChangeSinceLastCheck {

  const priceChange =
    currentPrice - previous.price;

  const percentChange =
    previous.price !== 0
      ? (priceChange / previous.price) * 100
      : 0;

  const volumeChange =
    currentVolume - previous.volume;

  const volumeChangePercent =
    previous.volume !== 0
      ? (volumeChange / previous.volume) * 100
      : 0;

  return {
    priceChange,
    percentChange,
    volumeChange,
    volumeChangePercent,
  };
}


/*
 * =========================================================
 * SAVE SUCCESSFUL MARKET SNAPSHOT
 * =========================================================
 *
 * This function must only be called after valid market
 * data has been successfully retrieved.
 */

export async function saveMarketSnapshot(
  input: SaveSnapshotInput
) {
  return MarketSnapshot.create({
    userId: input.userId,
    watchlistId: input.watchlistId,
    stockId: input.stockId,

    price: input.price,
    volume: input.volume,

    marketDataTime: input.marketDataTime,
    fetchedAt: input.fetchedAt,

    dataSource: input.dataSource,
    dataStatus: input.dataStatus,
  });
}