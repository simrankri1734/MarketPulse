import { Request, Response } from "express";
import mongoose from "mongoose";

import { User } from "../models/User.js";
import { Watchlist } from "../models/Watchlist.js";

import { getMarketQuote } from "../services/marketDataService.js";

import {
  getPreviousCheck,
  getLastSuccessfulSnapshot,
  calculateChangeSinceLastCheck,
  saveMarketSnapshot,
} from "../services/snapshotService.js";

import {
  getHistoricalBaseline,
} from "../services/historicalMarketDataService.js";

import {
  calculateAnomalyMetrics,
} from "../services/anomalyService.js";

import {
  calculateAttention,
} from "../services/attentionService.js";

import {
  calculateRecencyScore,
} from "../services/recencyService.js";

import {
  getRelevantMarketEvent,
} from "../services/marketEventService.js";

import {
  syncMarketEventsIfDue,
} from "../services/marketEventSyncService.js";


/*
 * =========================================================
 * GET MARKET DATA FOR WATCHLIST
 * =========================================================
 */
async function loadWatchlistMarketData(
  req: Request,
  res: Response,
  commitSnapshot: boolean
) {
  try {

    /*
     * =======================================================
     * VALIDATE WATCHLIST ID
     * =======================================================
     */

    const watchlistIdParam =
      req.params.id;

    if (
      Array.isArray(
        watchlistIdParam
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid watchlist ID.",
      });
    }

    const watchlistId =
      watchlistIdParam;

    if (!watchlistId) {
      return res.status(400).json({
        success: false,
        message: "Watchlist ID is required.",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(
        watchlistId
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid watchlist ID.",
      });
    }


    /*
     * =======================================================
     * AUTHENTICATED USER
     * =======================================================
     */

    const firebaseUid =
      req.user?.uid;

    if (!firebaseUid) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }


    /*
     * =======================================================
     * FIND USER
     * =======================================================
     */

    const user =
      await User.findOne({
        firebaseUid,
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }


    /*
     * =======================================================
     * FIND WATCHLIST + OWNERSHIP CHECK
     * =======================================================
     */

    const watchlist =
      await Watchlist.findOne({
        _id: watchlistId,
        userId: user._id,
      }).populate(
        "stocks.stockId"
      );

    if (!watchlist) {
      return res.status(404).json({
        success: false,
        message: "Watchlist not found.",
      });
    }


    /*
     * =======================================================
     * PROCESS EACH STOCK
     * =======================================================
     */

    const results = [];

    for (
      const watchlistStock of watchlist.stocks
    ) {

      /*
       * Mongoose populate can technically return either
       * an ObjectId or populated Stock document.
       */

      const stock =
        watchlistStock.stockId as unknown as {
          _id: mongoose.Types.ObjectId;
          symbol: string;
          name: string;
          exchange: string;
          currency: string;
        };


      if (
        !stock ||
        !stock._id
      ) {
        results.push({
          stock:
            watchlistStock.stockId,

          market: null,

          previousCheck: null,

          changeSinceLastCheck:
            null,

          anomaly: null,

          attention: null,

          error:
            "Stock information unavailable.",
        });

        continue;
      }


      try {

        /*
         * ===================================================
         * PREVIOUS SUCCESSFUL CHECK
         * ===================================================
         */

        const previousCheck =
          await getPreviousCheck(
            user._id,
            watchlist._id,
            stock._id
          );


        /*
         * ===================================================
         * CURRENT MARKET DATA
         * ===================================================
         *
         * First try the external provider.
         */

        let market = null;

        let isFallback = false;


        try {

          market =
            await getMarketQuote(
              stock.symbol,
              stock.exchange
            );

        } catch (
          marketError
        ) {

          /*
           * =================================================
           * LAST-KNOWN-GOOD FALLBACK
           * =================================================
           *
           * If the external provider fails because of:
           *
           * - API quota
           * - timeout
           * - temporary provider failure
           * - network failure
           *
           * use the latest successful MongoDB snapshot.
           *
           * IMPORTANT:
           * We do NOT save this fallback as a new snapshot.
           */

          console.warn(
            `Using last successful snapshot for ${stock.symbol} because market provider failed:`,
            marketError
          );


          const lastSuccessfulSnapshot =
            await getLastSuccessfulSnapshot(
              user._id,
              watchlist._id,
              stock._id
            );


          if (
            !lastSuccessfulSnapshot
          ) {

            /*
             * No previous successful market data exists.
             * Therefore we cannot provide a fallback.
             */

            throw marketError;
          }


          /*
           * Reconstruct a MarketQuote from MongoDB.
           */

          market = {
            symbol:
              stock.symbol,

            name:
              stock.name,

            exchange:
              stock.exchange,

            currency:
              stock.currency,

            price:
              lastSuccessfulSnapshot.price,

            volume:
              lastSuccessfulSnapshot.volume,

            marketDataTime:
              lastSuccessfulSnapshot.marketDataTime,

            fetchedAt:
              lastSuccessfulSnapshot.fetchedAt,

            dataSource:
              lastSuccessfulSnapshot.dataSource,

            dataStatus:
              "STALE" as const,

            previousClose:
              undefined,

            change:
              undefined,

            percentChange:
              undefined,

            isMarketOpen:
              undefined,
          };

          isFallback = true;
        }


        /*
         * ===================================================
         * CHANGE SINCE LAST CHECK
         * ===================================================
         */

        const changeSinceLastCheck =
          previousCheck
            ? calculateChangeSinceLastCheck(
                previousCheck,
                market.price,
                market.volume
              )
            : null;


        /*
         * ===================================================
         * EVENT SYNCHRONIZATION
         * ===================================================
         *
         * Only an explicit POST /check is allowed to
         * synchronize corporate actions.
         *
         * syncMarketEventsIfDue() itself ensures that:
         *
         * - recently synced stocks are skipped
         * - concurrent requests are protected
         * - sync state survives server restarts
         * - BharatStock is not called unnecessarily
         *
         * If event synchronization fails, we do NOT fail
         * the stock's market-data response.
         */

        if (
          commitSnapshot &&
          !isFallback
        ) {

          try {

            await syncMarketEventsIfDue(
              stock._id.toString(),
              stock.symbol,
              stock.exchange
            );

          } catch (
            eventSyncError
          ) {

            /*
             * Event data is an enrichment layer.
             *
             * Existing events can still be used below.
             *
             * Therefore a temporary corporate-actions
             * provider failure must not break the user's
             * market check.
             */

            console.warn(
              `Market event synchronization unavailable for ${stock.symbol}. ` +
              `Continuing with existing event data.`,
              eventSyncError
            );
          }
        }


        /*
         * ===================================================
         * FIRST CHECK
         * ===================================================
         *
         * There is no historical comparison yet.
         *
         * Therefore we do NOT calculate an anomaly or
         * attention score.
         */

        let anomaly = null;

        let attention = null;


        /*
         * ===================================================
         * HISTORICAL + ANOMALY + ATTENTION
         * ===================================================
         *
         * Only calculate these when there is a previous
         * successful user-visible check to compare against.
         */

        if (
          previousCheck &&
          changeSinceLastCheck &&
          !isFallback
        ) {

          try {

            /*
             * ===============================================
             * HISTORICAL BASELINE
             * ===============================================
             */

            const historicalBaseline =
              await getHistoricalBaseline(
                stock.symbol,
                stock.exchange
              );


            /*
             * ===============================================
             * ANOMALY
             * ===============================================
             *
             * Calculate how unusual the current movement is
             * compared with historical behavior.
             */

            anomaly =
              calculateAnomalyMetrics({
                priceChangePercent:
                  changeSinceLastCheck.percentChange,

                volumeChangePercent:
                  changeSinceLastCheck.volumeChangePercent,

                returnVolatility:
                  historicalBaseline.returnVolatility,

                averageVolume:
                  historicalBaseline.averageVolume,

                volumeVolatility:
                  historicalBaseline.volumeVolatility,
              });


            /*
             * ===============================================
             * RECENCY
             * ===============================================
             */

            const recencyScore =
              calculateRecencyScore(
                market.marketDataTime
              );


            /*
             * ===============================================
             * MOST RELEVANT MARKET EVENT
             * ===============================================
             *
             * This reads the events that were either:
             *
             * - previously stored in MongoDB
             * - or synchronized above during this explicit
             *   user check
             *
             * If no event exists, the event contribution
             * remains zero.
             *
             * We never fabricate an event.
             */

            const relevantEvent =
              await getRelevantMarketEvent(
                stock._id.toString()
              );


            const eventSignificanceScore =
              relevantEvent
                ?.significanceScore ?? 0;


            /*
             * ===============================================
             * MEANINGFUL SIGNAL
             * ===============================================
             *
             * Recency contributes only when there is an
             * actual meaningful signal.
             */

            const hasMeaningfulSignal =
              anomaly.priceAnomalyScore >= 30 ||
              anomaly.volumeAnomalyScore >= 30 ||
              eventSignificanceScore >= 30;


            const effectiveRecencyScore =
              hasMeaningfulSignal
                ? recencyScore
                : 0;


            /*
             * ===============================================
             * ATTENTION
             * ===============================================
             */

            attention =
              calculateAttention({
                priceAnomalyScore:
                  anomaly.priceAnomalyScore,

                volumeAnomalyScore:
                  anomaly.volumeAnomalyScore,

                eventSignificanceScore,

                recencyScore:
                  effectiveRecencyScore,

                priceChangePercent:
                  changeSinceLastCheck.percentChange,

                volumeChangePercent:
                  changeSinceLastCheck.volumeChangePercent,
              });

          } catch (
            historicalError
          ) {

            /*
             * Historical data is an enrichment layer.
             *
             * If it is temporarily unavailable, the current
             * market data and previous-check comparison should
             * still be returned to the user.
             *
             * We therefore do NOT fail the entire stock.
             */

            console.warn(
              `Historical baseline unavailable for ${stock.symbol}. ` +
              `Returning market data without anomaly scoring.`,
              historicalError
            );

            anomaly = null;

            attention = null;
          }
        }


        /*
         * ===================================================
         * SAVE SUCCESSFUL SNAPSHOT
         * ===================================================
         *
         * Only save when:
         *
         * 1. This is a POST /check request
         * 2. Market data came successfully from provider
         *
         * Fallback data is NEVER saved.
         */

        if (
          commitSnapshot &&
          !isFallback
        ) {

          await saveMarketSnapshot({
            userId:
              user._id,

            watchlistId:
              watchlist._id,

            stockId:
              stock._id,

            price:
              market.price,

            volume:
              market.volume,

            marketDataTime:
              market.marketDataTime,

            fetchedAt:
              market.fetchedAt,

            dataSource:
              market.dataSource,

            dataStatus:
              market.dataStatus,
          });
        }


        /*
         * ===================================================
         * RETURN SUCCESSFUL STOCK RESULT
         * ===================================================
         */

        results.push({
          stock: {
            _id:
              stock._id,

            symbol:
              stock.symbol,

            name:
              stock.name,

            exchange:
              stock.exchange,

            currency:
              stock.currency,
          },

          market: {
            symbol:
              market.symbol,

            name:
              market.name,

            exchange:
              market.exchange,

            currency:
              market.currency,

            price:
              market.price,

            volume:
              market.volume,

            marketDataTime:
              market.marketDataTime,

            fetchedAt:
              market.fetchedAt,

            dataSource:
              market.dataSource,

            dataStatus:
              market.dataStatus,

            previousClose:
              market.previousClose,

            change:
              market.change,

            percentChange:
              market.percentChange,

            /*
             * Tells the frontend that the displayed
             * market data came from MongoDB fallback.
             */

            isFallback,
          },

          previousCheck,

          changeSinceLastCheck,

          anomaly,

          attention,

          error:
            undefined,
        });

      } catch (
        stockError
      ) {

        /*
         * ===================================================
         * PER-STOCK FAILURE
         * ===================================================
         *
         * Failed stocks do NOT create snapshots.
         *
         * Their previous successful baseline therefore
         * remains intact.
         */

        console.error(
          `Market data failed for ${stock.symbol}:`,
          stockError
        );


        results.push({
          stock: {
            _id:
              stock._id,

            symbol:
              stock.symbol,

            name:
              stock.name,

            exchange:
              stock.exchange,

            currency:
              stock.currency,
          },

          market:
            null,

          previousCheck:
            null,

          changeSinceLastCheck:
            null,

          anomaly:
            null,

          attention:
            null,

          error:
            "Market data temporarily unavailable.",
        });
      }
    }


    /*
     * =======================================================
     * RESPONSE
     * =======================================================
     */

    return res.status(200).json({
      success: true,

      watchlist: {
        _id:
          watchlist._id,

        name:
          watchlist.name,
      },

      fetchedAt:
        new Date(),

      stocks:
        results,
    });

  } catch (
    error
  ) {

    /*
     * =======================================================
     * CONTROLLER FAILURE
     * =======================================================
     */

    console.error(
      "Failed to get watchlist market data:",
      error
    );


    return res.status(500).json({
      success: false,

      message:
        "Unable to load market data.",
    });
  }
}


/*
 * =========================================================
 * GET — VIEW MARKET DATA
 * =========================================================
 *
 * Does NOT:
 *
 * - create a new baseline
 * - synchronize events
 * - modify market snapshots
 */

export async function getWatchlistMarketData(
  req: Request,
  res: Response
) {
  return loadWatchlistMarketData(
    req,
    res,
    false
  );
}


/*
 * =========================================================
 * POST — EXPLICIT USER CHECK
 * =========================================================
 *
 * Creates a new snapshot only when fresh provider
 * data was successfully retrieved.
 *
 * Also allows event synchronization when its
 * 24-hour refresh window has expired.
 */

export async function checkWatchlistMarketData(
  req: Request,
  res: Response
) {
  return loadWatchlistMarketData(
    req,
    res,
    true
  );
}