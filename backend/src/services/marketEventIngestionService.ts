import { MarketEvent } from "../models/MarketEvent.js";

/*
 * =========================================================
 * TYPES
 * =========================================================
 */

interface BharatStockCorporateAction {
  action_type?: string;
  subject?: string;
  ex_date?: string;

  ratio_from?: number;
  ratio_to?: number;

  source?: string;
}

interface BharatStockCorporateActionsResponse {
  data?: BharatStockCorporateAction[];

  pagination?: {
    page?: number;
    page_size?: number;
    total_items?: number;
    total_pages?: number;
  };
}

export interface MarketEventIngestionResult {
  symbol: string;
  exchange: string;
  fetched: number;
  inserted: number;
  updated: number;
  skipped: number;
}

/*
 * =========================================================
 * CONFIGURATION
 * =========================================================
 */

const BHARATSTOCK_BASE_URL =
  "https://bharatstockapi.com";

const REQUEST_TIMEOUT_MS = 8000;

/*
 * We only need recent corporate actions for the
 * MarketPulse attention system.
 *
 * Older events do not contribute to the current
 * 30-day event relevance window.
 */
const EVENT_LOOKBACK_DAYS = 90;

/*
 * Fetch a reasonable number of corporate actions.
 *
 * This prevents unnecessary API response size while
 * still giving us enough recent events.
 */
const PAGE_SIZE = 50;

/*
 * =========================================================
 * VALID EVENT TYPES
 * =========================================================
 *
 * These are the action types documented by BharatStock.
 */

const VALID_EVENT_TYPES = new Set([
  "DIVIDEND",
  "BONUS",
  "SPLIT",
  "RIGHTS",
  "BUYBACK",
  "OTHER",
]);

/*
 * =========================================================
 * NORMALIZE EVENT TYPE
 * =========================================================
 */

function normalizeEventType(
  eventType: string | undefined
): string {
  if (!eventType) {
    return "OTHER";
  }

  const normalized =
    eventType.trim().toUpperCase();

  if (
    VALID_EVENT_TYPES.has(normalized)
  ) {
    return normalized;
  }

  return "OTHER";
}

/*
 * =========================================================
 * NORMALIZE SYMBOL
 * =========================================================
 */

function normalizeSymbol(
  symbol: string
): string {
  return symbol
    .trim()
    .toUpperCase();
}

/*
 * =========================================================
 * NORMALIZE EXCHANGE
 * =========================================================
 */

function normalizeExchange(
  exchange: string
): string {
  return exchange
    .trim()
    .toUpperCase();
}

/*
 * =========================================================
 * PARSE EVENT DATE
 * =========================================================
 *
 * BharatStock provides ex_date as a calendar date.
 *
 * We deliberately represent it as midnight UTC rather
 * than inventing an exact announcement time.
 *
 * This keeps the event timestamp deterministic.
 * =========================================================
 */

function parseEventDate(
  exDate: string | undefined
): Date | null {
  if (!exDate) {
    return null;
  }

  const value =
    exDate.trim();

  if (!value) {
    return null;
  }

  /*
   * Expected format:
   *
   * YYYY-MM-DD
   */

  const parsed =
    new Date(
      `${value}T00:00:00.000Z`
    );

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return null;
  }

  return parsed;
}

/*
 * =========================================================
 * BUILD EVENT TITLE
 * =========================================================
 */

function buildEventTitle(
  action: BharatStockCorporateAction,
  eventType: string
): string {
  const subject =
    action.subject?.trim();

  if (subject) {
    return subject;
  }

  switch (eventType) {
    case "DIVIDEND":
      return "Dividend announcement";

    case "BONUS":
      return "Bonus issue";

    case "SPLIT":
      return "Stock split";

    case "RIGHTS":
      return "Rights issue";

    case "BUYBACK":
      return "Share buyback";

    default:
      return "Corporate action";
  }
}

/*
 * =========================================================
 * BUILD EVENT DESCRIPTION
 * =========================================================
 *
 * We keep this optional.
 *
 * Ratios are useful context for bonus/split/rights events.
 * =========================================================
 */

function buildEventDescription(
  action: BharatStockCorporateAction
): string | undefined {
  const parts: string[] = [];

  if (
    Number.isFinite(
      action.ratio_from
    ) &&
    Number.isFinite(
      action.ratio_to
    )
  ) {
    parts.push(
      `Ratio ${action.ratio_from}:${action.ratio_to}`
    );
  }

  if (parts.length === 0) {
    return undefined;
  }

  return parts.join(" · ");
}

/*
 * =========================================================
 * FETCH CORPORATE ACTIONS
 * =========================================================
 */

async function fetchCorporateActions(
  symbol: string,
  exchange: string
): Promise<BharatStockCorporateAction[]> {
  const apiKey =
    process.env.BHARATSTOCK_API_KEY;

  if (!apiKey) {
    throw new Error(
      "BHARATSTOCK_API_KEY is not configured"
    );
  }

  const url = new URL(
    `${BHARATSTOCK_BASE_URL}/v1/stocks/${encodeURIComponent(
      symbol
    )}/corporate-actions`
  );

  /*
   * Exchange is important because the same ticker can
   * exist on NSE and BSE.
   */
  url.searchParams.set(
    "exchange",
    exchange
  );

  /*
   * Request only the first page because we are interested
   * in the most recent corporate actions.
   */
  url.searchParams.set(
    "page",
    "1"
  );

  url.searchParams.set(
    "page_size",
    PAGE_SIZE.toString()
  );

  const controller =
    new AbortController();

  const timeout =
    setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

  try {
    const response =
      await fetch(
        url.toString(),
        {
          method: "GET",

          headers: {
            "X-API-Key": apiKey,
            Accept: "application/json",
          },

          signal:
            controller.signal,
        }
      );

    let data:
      | BharatStockCorporateActionsResponse
      | Record<string, unknown>;

    try {
      data =
        (await response.json()) as
          | BharatStockCorporateActionsResponse
          | Record<string, unknown>;
    } catch {
      throw new Error(
        "BharatStock returned an invalid corporate actions response"
      );
    }

    if (!response.ok) {
      let errorMessage =
        `BharatStock corporate actions request failed with status ${response.status}`;

      if (
        typeof data === "object" &&
        data !== null &&
        "detail" in data
      ) {
        const detail =
          (
            data as {
              detail?: unknown;
            }
          ).detail;

        if (detail !== undefined) {
          errorMessage =
            String(detail);
        }
      }

      throw new Error(
        errorMessage
      );
    }



        if (
        typeof data !== "object" ||
        data === null
        ) {
        console.error(
            "BharatStock corporate actions raw response:",
            data
        );

        throw new Error(
            "BharatStock returned an invalid corporate actions response"
        );
        }

        if (
        !("data" in data)
        ) {
        console.error(
            "BharatStock corporate actions response without data field:"
        );

        console.error(
            JSON.stringify(
            data,
            null,
            2
            )
        );

        throw new Error(
            "BharatStock corporate actions response does not contain a data field"
        );
        }

    const responseData =
      data as BharatStockCorporateActionsResponse;

    if (
      !Array.isArray(
        responseData.data
      )
    ) {
      throw new Error(
        "BharatStock corporate actions response contains no data array"
      );
    }

    return responseData.data;
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "AbortError"
    ) {
      throw new Error(
        "BharatStock corporate actions request timed out"
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/*
 * =========================================================
 * EVENT IS WITHIN LOOKBACK WINDOW
 * =========================================================
 */

function isRecentEnough(
  eventTime: Date,
  now: Date
): boolean {
  const lookbackStart =
    new Date(
      now.getTime() -
        EVENT_LOOKBACK_DAYS *
          24 *
          60 *
          60 *
          1000
    );

  return (
    eventTime.getTime() >=
      lookbackStart.getTime() &&
    eventTime.getTime() <=
      now.getTime()
  );
}

/*
 * =========================================================
 * BUILD DEDUPLICATION QUERY
 * =========================================================
 *
 * The same corporate action may appear again when the
 * API is fetched later.
 *
 * We identify an event using:
 *
 * stockId
 * eventType
 * eventTime
 * title
 *
 * This avoids creating duplicate MarketEvent documents.
 * =========================================================
 */

function buildDuplicateQuery(
  stockId: string,
  eventType: string,
  eventTime: Date,
  title: string
) {
  return {
    stockId,
    eventType,
    eventTime,
    title,
  };
}

/*
 * =========================================================
 * SYNC MARKET EVENTS
 * =========================================================
 *
 * Main public function.
 *
 * Fetches recent corporate actions for one stock and
 * stores them in MongoDB.
 * =========================================================
 */

export async function syncMarketEvents(
  stockId: string,
  symbol: string,
  exchange: string,
  now: Date = new Date()
): Promise<MarketEventIngestionResult> {
  const normalizedSymbol =
    normalizeSymbol(symbol);

  const normalizedExchange =
    normalizeExchange(exchange);

  if (!stockId.trim()) {
    throw new Error(
      "Stock ID is required"
    );
  }

  if (!normalizedSymbol) {
    throw new Error(
      "Stock symbol is required"
    );
  }

  if (!normalizedExchange) {
    throw new Error(
      "Stock exchange is required"
    );
  }

  const actions =
    await fetchCorporateActions(
      normalizedSymbol,
      normalizedExchange
    );

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const action of actions) {
    /*
     * Normalize event type.
     */
    const eventType =
      normalizeEventType(
        action.action_type
      );

    /*
     * Parse ex-date.
     */
    const eventTime =
      parseEventDate(
        action.ex_date
      );

    /*
     * Invalid dates cannot safely participate in
     * event relevance calculations.
     */
    if (!eventTime) {
      skipped++;
      continue;
    }

    /*
     * Ignore future-dated or old events.
     */
    if (
      !isRecentEnough(
        eventTime,
        now
      )
    ) {
      skipped++;
      continue;
    }

    const title =
      buildEventTitle(
        action,
        eventType
      );

    const description =
      buildEventDescription(
        action
      );

    const source =
      action.source?.trim() ||
      "bharatstock";

    const fetchedAt =
      new Date();

    const duplicateQuery =
      buildDuplicateQuery(
        stockId,
        eventType,
        eventTime,
        title
      );

    /*
     * Upsert means:
     *
     * - create the event if it doesn't exist
     * - update it if it already exists
     *
     * Therefore repeated synchronization does not
     * create duplicate events.
     */
    const result =
      await MarketEvent.updateOne(
        duplicateQuery,
        {
          $set: {
            description,
            source,
            fetchedAt,
          },

          $setOnInsert: {
            stockId,
            eventType,
            title,
            eventTime,
          },
        },
        {
          upsert: true,
        }
      );

    if (
      result.upsertedCount > 0
    ) {
      inserted++;
    } else if (
      result.modifiedCount > 0
    ) {
      updated++;
    } else {
      /*
       * The event already existed and no values changed.
       */
      skipped++;
    }
  }

  return {
    symbol:
      normalizedSymbol,

    exchange:
      normalizedExchange,

    fetched:
      actions.length,

    inserted,

    updated,

    skipped,
  };
}