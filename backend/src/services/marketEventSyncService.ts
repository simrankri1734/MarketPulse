import { MarketEventSyncState } from "../models/MarketEventSyncState.js";

import {
  syncMarketEvents,
  type MarketEventIngestionResult,
} from "./marketEventIngestionService.js";

/*
 * =========================================================
 * CONFIGURATION
 * =========================================================
 */

/*
 * Corporate actions are refreshed at most once every
 * 24 hours for a particular stock.
 *
 * The state is stored in MongoDB, so this limit applies
 * across:
 *
 * - different users
 * - different requests
 * - backend restarts
 * - multiple backend instances
 */
const SYNC_INTERVAL_MS =
  24 * 60 * 60 * 1000;

/*
 * =========================================================
 * SYNC LOCK
 * =========================================================
 *
 * The lock protects against concurrent requests.
 *
 * Example:
 *
 * Request A ──┐
 *             ├── same stock
 * Request B ──┘
 *
 * Only one request should call BharatStock.
 */
const SYNC_LOCK_MS =
  2 * 60 * 1000;

/*
 * =========================================================
 * TYPES
 * =========================================================
 */

export interface MarketEventSyncResult {
  status:
    | "SYNCED"
    | "SKIPPED"
    | "LOCKED";

  reason:
    | "SYNC_COMPLETED"
    | "RECENTLY_SYNCED"
    | "SYNC_IN_PROGRESS";

  ingestion?: MarketEventIngestionResult;

  lastSyncedAt?: Date;
}

/*
 * =========================================================
 * NORMALIZE ID
 * =========================================================
 */

function normalizeStockId(
  stockId: string
): string {
  const normalized =
    stockId.trim();

  if (!normalized) {
    throw new Error(
      "Stock ID is required"
    );
  }

  return normalized;
}

/*
 * =========================================================
 * CHECK WHETHER SYNC IS DUE
 * =========================================================
 */

function isSyncDue(
  lastSyncedAt: Date | undefined,
  now: Date
): boolean {
  if (!lastSyncedAt) {
    return true;
  }

  const elapsedMs =
    now.getTime() -
    lastSyncedAt.getTime();

  return (
    elapsedMs >=
    SYNC_INTERVAL_MS
  );
}

/*
 * =========================================================
 * TRY ACQUIRE SYNC LOCK
 * =========================================================
 *
 * This operation is atomic.
 *
 * That is important because a normal:
 *
 * find → check → update
 *
 * sequence can have a race condition.
 *
 * Instead, MongoDB performs the condition and update
 * as one operation.
 * =========================================================
 */

async function tryAcquireSyncLock(
  stockId: string,
  now: Date
): Promise<boolean> {
  const lockUntil =
    new Date(
      now.getTime() +
        SYNC_LOCK_MS
    );

  const state =
    await MarketEventSyncState.findOneAndUpdate(
      {
        stockId,

        /*
         * Either there is no lock or the previous
         * lock has expired.
         */
        $or: [
          {
            lockUntil: {
              $exists: false,
            },
          },
          {
            lockUntil: {
              $lte: now,
            },
          },
        ],
      },
      {
        $set: {
          lockUntil,
        },

        $setOnInsert: {
          stockId,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
      }
    );

  /*
   * With an upsert, another request could race with
   * creation of the same unique stockId.
   *
   * If MongoDB rejects that race, the caller should
   * simply treat it as another request owning the lock.
   */
  return (
    state !== null
  );
}

/*
 * =========================================================
 * RELEASE LOCK
 * =========================================================
 */

async function releaseSyncLock(
  stockId: string
): Promise<void> {
  await MarketEventSyncState.updateOne(
    {
      stockId,
    },
    {
      $unset: {
        lockUntil: "",
      },
    }
  );
}

/*
 * =========================================================
 * MARK SYNC SUCCESSFUL
 * =========================================================
 */

async function markSyncSuccessful(
  stockId: string,
  syncedAt: Date
): Promise<void> {
  await MarketEventSyncState.updateOne(
    {
      stockId,
    },
    {
      $set: {
        lastSyncedAt: syncedAt,
      },

      $unset: {
        lockUntil: "",
      },
    }
  );
}

/*
 * =========================================================
 * SYNC EVENTS IF DUE
 * =========================================================
 *
 * This is the function that the application will use.
 *
 * It decides whether BharatStock actually needs to be
 * contacted.
 * =========================================================
 */

export async function syncMarketEventsIfDue(
  stockId: string,
  symbol: string,
  exchange: string,
  now: Date = new Date()
): Promise<MarketEventSyncResult> {
  const normalizedStockId =
    normalizeStockId(
      stockId
    );

  /*
   * =======================================================
   * READ CURRENT SYNC STATE
   * =======================================================
   */

  const existingState =
    await MarketEventSyncState.findOne({
      stockId:
        normalizedStockId,
    }).lean();

  /*
   * =======================================================
   * RECENTLY SYNCED
   * =======================================================
   *
   * If the stock was synchronized recently, don't call
   * BharatStock again.
   */

  if (
    existingState?.lastSyncedAt &&
    !isSyncDue(
      existingState.lastSyncedAt,
      now
    )
  ) {
    return {
      status: "SKIPPED",

      reason:
        "RECENTLY_SYNCED",

      lastSyncedAt:
        existingState.lastSyncedAt,
    };
  }

  /*
   * =======================================================
   * ACQUIRE LOCK
   * =======================================================
   */

  let lockAcquired =
    false;

  try {
    lockAcquired =
      await tryAcquireSyncLock(
        normalizedStockId,
        now
      );
  } catch (error) {
    /*
     * A duplicate-key race can happen when two requests
     * simultaneously create the first sync-state document.
     *
     * In that situation, another request has effectively
     * won the race.
     */
    if (
      error instanceof Error &&
      (
        error.message.includes(
          "E11000"
        ) ||
        error.message.includes(
          "duplicate key"
        )
      )
    ) {
      return {
        status: "LOCKED",

        reason:
          "SYNC_IN_PROGRESS",
      };
    }

    throw error;
  }

  if (!lockAcquired) {
    return {
      status: "LOCKED",

      reason:
        "SYNC_IN_PROGRESS",
    };
  }

  /*
   * =======================================================
   * DOUBLE-CHECK STATE
   * =======================================================
   *
   * Another request might have completed the sync between
   * our initial read and lock acquisition.
   *
   * Check again before spending an API request.
   */

  try {
    const latestState =
      await MarketEventSyncState.findOne({
        stockId:
          normalizedStockId,
      }).lean();

    if (
      latestState?.lastSyncedAt &&
      !isSyncDue(
        latestState.lastSyncedAt,
        now
      )
    ) {
      await releaseSyncLock(
        normalizedStockId
      );

      return {
        status: "SKIPPED",

        reason:
          "RECENTLY_SYNCED",

        lastSyncedAt:
          latestState.lastSyncedAt,
      };
    }

    /*
     * =====================================================
     * CALL BHARATSTOCK
     * =====================================================
     */

    const ingestion =
      await syncMarketEvents(
        normalizedStockId,
        symbol,
        exchange,
        now
      );

    /*
     * =====================================================
     * MARK SUCCESS
     * =====================================================
     *
     * Even if BharatStock returns zero recent events,
     * the synchronization itself succeeded.
     *
     * Therefore we record the successful sync time.
     *
     * This is important to avoid repeatedly calling the
     * API for a stock that simply has no recent events.
     */

    await markSyncSuccessful(
      normalizedStockId,
      now
    );

    return {
      status: "SYNCED",

      reason:
        "SYNC_COMPLETED",

      ingestion,

      lastSyncedAt: now,
    };
  } catch (error) {
    /*
     * =====================================================
     * FAILURE
     * =====================================================
     *
     * We intentionally DO NOT update lastSyncedAt.
     *
     * Therefore a failed API request does not incorrectly
     * make the system believe that the stock was synchronized
     * successfully.
     */

    await releaseSyncLock(
      normalizedStockId
    );

    throw error;
  }
}