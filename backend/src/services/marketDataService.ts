import {
  getCachedMarketQuote,
  setCachedMarketQuote,
} from "./marketDataCache.js";

export type MarketDataStatus =
  | "FRESH"
  | "DELAYED"
  | "STALE";

export interface MarketQuote {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;

  price: number;
  volume: number;

  marketDataTime: Date;
  fetchedAt: Date;

  dataSource: string;
  dataStatus: MarketDataStatus;

  previousClose?: number;
  change?: number;
  percentChange?: number;
  isMarketOpen?: boolean;
}

interface BharatStockResponse {
  symbol?: string;
  company_name?: string;
  exchange?: string;

  latest_price?: {
    trade_date?: string;
    close?: number;
    prev_close?: number;
    volume?: number;
    delivery_pct?: number;
  };
}

const BHARATSTOCK_BASE_URL =
  "https://bharatstockapi.com";

const REQUEST_TIMEOUT_MS = 8000;

/**
 * BharatStock provides end-of-day market data.
 *
 * FRESH:
 * Latest trading day's data is from today.
 *
 * DELAYED:
 * Latest available trading data is within 3 calendar days.
 *
 * STALE:
 * Data is older than 3 calendar days.
 *
 * Weekends and market holidays can naturally cause
 * the latest trading date to be older than today.
 */
function determineDataStatus(
  marketDataTime: Date,
  fetchedAt: Date
): MarketDataStatus {
  const ageMs =
    fetchedAt.getTime() -
    marketDataTime.getTime();

  const ageDays =
    ageMs / (1000 * 60 * 60 * 24);

  if (ageDays <= 1) {
    return "FRESH";
  }

  if (ageDays <= 3) {
    return "DELAYED";
  }

  return "STALE";
}

function parseRequiredNumber(
  value: number | undefined,
  fieldName: string
): number {
  if (
    value === undefined ||
    value === null ||
    !Number.isFinite(value)
  ) {
    throw new Error(
      `BharatStock returned invalid ${fieldName}`
    );
  }

  return value;
}

function parseOptionalNumber(
  value: number | undefined
): number | undefined {
  if (
    value === undefined ||
    value === null ||
    !Number.isFinite(value)
  ) {
    return undefined;
  }

  return value;
}

/**
 * BharatStock provides an EOD trade date rather than
 * an exact intraday timestamp.
 *
 * We represent the trading date using midnight in
 * the Indian timezone instead of inventing a market time.
 */
function getMarketDataTime(
  tradeDate: string | undefined
): Date {
  if (!tradeDate) {
    throw new Error(
      "BharatStock returned no trade date"
    );
  }

  const parsedDate = new Date(
    `${tradeDate}T00:00:00+05:30`
  );

  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error(
      "BharatStock returned an invalid trade date"
    );
  }

  return parsedDate;
}

export async function getMarketQuote(
  symbol: string,
  exchange: string
): Promise<MarketQuote> {
  const apiKey =
    process.env.BHARATSTOCK_API_KEY;

  if (!apiKey) {
    throw new Error(
      "BHARATSTOCK_API_KEY is not configured"
    );
  }

  const normalizedSymbol =
    symbol.trim().toUpperCase();

  const normalizedExchange =
    exchange.trim().toUpperCase();

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

  /*
   * Check the in-memory cache before calling
   * BharatStock.
   */
  const cachedQuote =
    getCachedMarketQuote(normalizedSymbol);

  if (
    cachedQuote &&
    cachedQuote.exchange === normalizedExchange
  ) {
    return cachedQuote;
  }

  const url = new URL(
    `${BHARATSTOCK_BASE_URL}/v1/stocks/${encodeURIComponent(
      normalizedSymbol
    )}`
  );

  url.searchParams.set(
    "exchange",
    normalizedExchange
  );

  const controller =
    new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  const fetchedAt = new Date();

  try {
    const response = await fetch(
      url.toString(),
      {
        method: "GET",

        headers: {
          "X-API-Key": apiKey,
          Accept: "application/json",
        },

        signal: controller.signal,
      }
    );

    let data: BharatStockResponse;

    try {
      data =
        (await response.json()) as BharatStockResponse;
    } catch {
      throw new Error(
        "BharatStock returned an invalid response"
      );
    }

    if (!response.ok) {
      const errorMessage =
        typeof data === "object" &&
        data !== null &&
        "detail" in data
          ? String(
              (data as {
                detail?: unknown;
              }).detail
            )
          : `BharatStock request failed with status ${response.status}`;

      throw new Error(errorMessage);
    }

    if (!data.latest_price) {
      throw new Error(
        `No market price available for ${normalizedSymbol}`
      );
    }

    const price =
      parseRequiredNumber(
        data.latest_price.close,
        "price"
      );

    const volume =
      parseRequiredNumber(
        data.latest_price.volume,
        "volume"
      );

    const marketDataTime =
      getMarketDataTime(
        data.latest_price.trade_date
      );

    const dataStatus =
      determineDataStatus(
        marketDataTime,
        fetchedAt
      );

    const previousClose =
      parseOptionalNumber(
        data.latest_price.prev_close
      );

    let change:
      | number
      | undefined;

    let percentChange:
      | number
      | undefined;

    if (
      previousClose !== undefined
    ) {
      change =
        price - previousClose;

      if (
        previousClose !== 0
      ) {
        percentChange =
          (change / previousClose) *
          100;
      }
    }

    const quote: MarketQuote = {
      symbol:
        data.symbol ||
        normalizedSymbol,

      name:
        data.company_name ||
        normalizedSymbol,

      exchange:
        data.exchange ||
        normalizedExchange,

      currency: "INR",

      price,
      volume,

      marketDataTime,
      fetchedAt,

      dataSource: "BHARATSTOCK",
      dataStatus,

      previousClose,
      change,
      percentChange,

      /*
       * BharatStock provides EOD data, so it does not
       * provide an intraday market-open status here.
       */
      isMarketOpen: undefined,
    };

    /*
     * Store the successful response in the
     * in-memory cache.
     */
    setCachedMarketQuote(quote);

    return quote;
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "AbortError"
    ) {
      throw new Error(
        "BharatStock request timed out"
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/*
 * Batch endpoint.
 *
 * This is intentionally NOT connected to the main
 * market-data flow yet because the BharatStock batch
 * response does not provide volume or trade_date,
 * which our anomaly and snapshot pipeline requires.
 */
export async function getMarketQuotes(
  symbols: string[]
): Promise<MarketQuote[]> {
  const apiKey =
    process.env.BHARATSTOCK_API_KEY;

  if (!apiKey) {
    throw new Error(
      "BHARATSTOCK_API_KEY is not configured"
    );
  }

  const normalizedSymbols = [
    ...new Set(
      symbols
        .map((symbol) =>
          symbol.trim().toUpperCase()
        )
        .filter(Boolean)
    ),
  ];

  if (
    normalizedSymbols.length === 0
  ) {
    return [];
  }

  if (
    normalizedSymbols.length > 50
  ) {
    throw new Error(
      "BharatStock batch request supports a maximum of 50 symbols."
    );
  }

  const url = new URL(
    `${BHARATSTOCK_BASE_URL}/v1/stocks/quotes`
  );

  url.searchParams.set(
    "symbols",
    normalizedSymbols.join(",")
  );

  const controller =
    new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(
      url.toString(),
      {
        method: "GET",

        headers: {
          "X-API-Key": apiKey,
          Accept: "application/json",
        },

        signal: controller.signal,
      }
    );

    let data: Array<{
      symbol?: string;
      close?: number;
      change_pct?: number;
      found?: boolean;
    }>;

    try {
      data =
        (await response.json()) as typeof data;
    } catch {
      throw new Error(
        "BharatStock returned an invalid batch response"
      );
    }

    if (!response.ok) {
      const errorMessage =
        typeof data === "object" &&
        data !== null &&
        !Array.isArray(data) &&
        "detail" in data
          ? String(
              (
                data as {
                  detail?: unknown;
                }
              ).detail
            )
          : `BharatStock batch request failed with status ${response.status}`;

      throw new Error(
        errorMessage
      );
    }

    if (!Array.isArray(data)) {
      throw new Error(
        "BharatStock returned an invalid batch response"
      );
    }

    /*
     * The batch endpoint gives us the latest close and
     * change percentage, but not volume or trade_date.
     *
     * Therefore this function currently only validates
     * the batch response.
     *
     * We will complete the mapping when we redesign the
     * market-data response around the batch endpoint.
     */
    console.log(
      `BharatStock batch returned ${data.length} quote(s)`
    );

    return [];
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "AbortError"
    ) {
      throw new Error(
        "BharatStock batch request timed out"
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}