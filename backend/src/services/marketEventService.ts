import { MarketEvent } from "../models/MarketEvent.js";

/*
 * =========================================================
 * TYPES
 * =========================================================
 */

export interface MarketEventResult {
  event: {
    id: string;
    eventType: string;
    title: string;
    description?: string;
    eventTime: Date;
    source: string;
  };

  significanceScore: number;
}

/*
 * =========================================================
 * CONFIGURATION
 * =========================================================
 *
 * Events older than this are ignored.
 *
 * We keep the window reasonably small because the goal is
 * to identify events that are still relevant to the user's
 * current market check.
 * =========================================================
 */

const EVENT_LOOKBACK_DAYS = 30;

/*
 * =========================================================
 * EVENT SIGNIFICANCE
 * =========================================================
 *
 * Higher score = more potentially meaningful event.
 *
 * These are deterministic rules, so the system can explain
 * why an event contributed to attention.
 * =========================================================
 */

const EVENT_SIGNIFICANCE: Record<string, number> = {
  SPLIT: 100,
  BONUS: 100,

  BUYBACK: 90,
  RIGHTS: 90,

  DIVIDEND: 60,

  OTHER: 40,
};

/*
 * =========================================================
 * NORMALIZE EVENT TYPE
 * =========================================================
 */

function normalizeEventType(
  eventType: string
): string {
  return eventType
    .trim()
    .toUpperCase();
}

/*
 * =========================================================
 * GET BASE SIGNIFICANCE
 * =========================================================
 */

function getBaseSignificance(
  eventType: string
): number {
  const normalizedType =
    normalizeEventType(eventType);

  return (
    EVENT_SIGNIFICANCE[
      normalizedType
    ] ?? EVENT_SIGNIFICANCE.OTHER
  );
}

/*
 * =========================================================
 * APPLY RECENCY
 * =========================================================
 *
 * Recent events should matter more than older events.
 *
 * 0–2 days   → 100%
 * 3–7 days   → 80%
 * 8–14 days  → 60%
 * 15–30 days → 30%
 *
 * The event type determines importance.
 * Recency determines how much of that importance is
 * still relevant.
 * =========================================================
 */

function calculateEventRecencyMultiplier(
  eventTime: Date,
  now: Date = new Date()
): number {
  const ageMs =
    now.getTime() -
    eventTime.getTime();

  if (
    !Number.isFinite(ageMs) ||
    ageMs < 0
  ) {
    return 0;
  }

  const ageDays =
    ageMs /
    (1000 * 60 * 60 * 24);

  if (ageDays <= 2) {
    return 1;
  }

  if (ageDays <= 7) {
    return 0.8;
  }

  if (ageDays <= 14) {
    return 0.6;
  }

  if (ageDays <= 30) {
    return 0.3;
  }

  return 0;
}

/*
 * =========================================================
 * CALCULATE EVENT SCORE
 * =========================================================
 */

function calculateEventSignificance(
  eventType: string,
  eventTime: Date,
  now: Date = new Date()
): number {
  const baseScore =
    getBaseSignificance(
      eventType
    );

  const recencyMultiplier =
    calculateEventRecencyMultiplier(
      eventTime,
      now
    );

  return Number(
    (
      baseScore *
      recencyMultiplier
    ).toFixed(2)
  );
}

/*
 * =========================================================
 * GET MOST RELEVANT EVENT
 * =========================================================
 *
 * Returns the strongest recent event for a stock.
 *
 * If no relevant event exists, returns null.
 * =========================================================
 */

export async function getRelevantMarketEvent(
  stockId: string,
  now: Date = new Date()
): Promise<MarketEventResult | null> {

  const lookbackStart =
    new Date(
      now.getTime() -
        EVENT_LOOKBACK_DAYS *
          24 *
          60 *
          60 *
          1000
    );

  const events =
    await MarketEvent.find({
      stockId,
      eventTime: {
        $gte: lookbackStart,
        $lte: now,
      },
    })
      .sort({
        eventTime: -1,
      })
      .limit(20)
      .lean();

  if (events.length === 0) {
    return null;
  }

  let strongestEvent:
    MarketEventResult | null =
    null;

  for (const event of events) {
    const significanceScore =
      calculateEventSignificance(
        event.eventType,
        event.eventTime,
        now
      );

    if (
      significanceScore <= 0
    ) {
      continue;
    }

    if (
      strongestEvent === null ||
      significanceScore >
        strongestEvent.significanceScore
    ) {
      strongestEvent = {
        event: {
          id: event._id.toString(),
          eventType:
            event.eventType,
          title: event.title,
          description:
            event.description,
          eventTime:
            event.eventTime,
          source: event.source,
        },

        significanceScore,
      };
    }
  }

  return strongestEvent;
}