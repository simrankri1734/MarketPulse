import {
  getCachedHistoricalBaseline,
  setCachedHistoricalBaseline,
} from "./historicalMarketDataCache.js";

export interface HistoricalPricePoint {
  tradeDate: Date;
  close: number;
  adjustedClose: number;
  volume: number;
}

export interface HistoricalBaseline {
  symbol: string;

  observations: number;

  averageDailyReturn: number;
  returnVolatility: number;

  averageVolume: number;
  volumeVolatility: number;

  latestHistoricalDate: Date;
}

interface BharatStockHistoricalResponse {
  data?: Array<{
    trade_date?: string;
    close?: number;
    adjusted_close?: number;
    volume?: number;
  }>;

  pagination?: {
    page?: number;
    page_size?: number;
    total_items?: number;
    total_pages?: number;
  };

  detail?: unknown;
}

const BHARATSTOCK_BASE_URL =
  "https://bharatstockapi.com";

const REQUEST_TIMEOUT_MS = 8000;

const HISTORY_DAYS = 60;

const MINIMUM_OBSERVATIONS = 10;


/*
 * =========================================================
 * HELPERS
 * =========================================================
 */

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


function parseTradeDate(
  tradeDate: string | undefined
): Date {
  if (!tradeDate) {
    throw new Error(
      "BharatStock returned no trade date"
    );
  }

  const parsed = new Date(
    `${tradeDate}T00:00:00+05:30`
  );

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(
      "BharatStock returned an invalid trade date"
    );
  }

  return parsed;
}


/*
 * =========================================================
 * MEAN
 * =========================================================
 */

function calculateMean(
  values: number[]
): number {
  if (values.length === 0) {
    return 0;
  }

  return (
    values.reduce(
      (sum, value) => sum + value,
      0
    ) / values.length
  );
}


/*
 * =========================================================
 * STANDARD DEVIATION
 * =========================================================
 */

function calculateStandardDeviation(
  values: number[],
  mean: number
): number {
  if (values.length === 0) {
    return 0;
  }

  const squaredDifferences =
    values.map(
      (value) =>
        Math.pow(value - mean, 2)
    );

  const variance =
    calculateMean(squaredDifferences);

  return Math.sqrt(variance);
}


/*
 * =========================================================
 * DATE RANGE
 * =========================================================
 */

function getDateString(
  date: Date
): string {
  return date
    .toISOString()
    .slice(0, 10);
}


/*
 * =========================================================
 * FETCH HISTORICAL PRICES
 * =========================================================
 */

export async function getHistoricalPrices(
  symbol: string,
  exchange: string
): Promise<HistoricalPricePoint[]> {

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
   * Fetch approximately the previous
   * 60 calendar days.
   *
   * This normally gives us several weeks
   * of trading observations.
   */

  const toDate = new Date();

  const fromDate = new Date(
    toDate.getTime() -
      HISTORY_DAYS *
        24 *
        60 *
        60 *
        1000
  );


  const url = new URL(
    `${BHARATSTOCK_BASE_URL}/v1/stocks/${encodeURIComponent(
      normalizedSymbol
    )}/prices`
  );


  url.searchParams.set(
    "exchange",
    normalizedExchange
  );

  url.searchParams.set(
    "from",
    getDateString(fromDate)
  );

  url.searchParams.set(
    "to",
    getDateString(toDate)
  );

  url.searchParams.set(
    "page",
    "1"
  );

  url.searchParams.set(
    "page_size",
    "100"
  );


  const controller =
    new AbortController();

  const timeout = setTimeout(
    () =>
      controller.abort(),
    REQUEST_TIMEOUT_MS
  );


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


    let data:
      BharatStockHistoricalResponse;


    try {

      data =
        (await response.json()) as
          BharatStockHistoricalResponse;

    } catch {

      throw new Error(
        "BharatStock returned an invalid historical response"
      );
    }


    if (!response.ok) {

      const detail =
        data &&
        typeof data.detail === "string"
          ? data.detail
          : `BharatStock historical request failed with status ${response.status}`;

      throw new Error(detail);
    }


    if (!Array.isArray(data.data)) {

      throw new Error(
        "BharatStock returned no historical price data"
      );
    }


    const prices:
      HistoricalPricePoint[] = [];


    for (const row of data.data) {

      try {

        const tradeDate =
          parseTradeDate(
            row.trade_date
          );

        const close =
          parseRequiredNumber(
            row.close,
            "historical close"
          );

        const adjustedClose =
          row.adjusted_close !==
            undefined &&
          row.adjusted_close !== null &&
          Number.isFinite(
            row.adjusted_close
          )
            ? row.adjusted_close
            : close;

        const volume =
          parseRequiredNumber(
            row.volume,
            "historical volume"
          );


        /*
         * Invalid negative values should
         * never enter our baseline.
         */

        if (
          close < 0 ||
          adjustedClose < 0 ||
          volume < 0
        ) {
          continue;
        }


        prices.push({
          tradeDate,
          close,
          adjustedClose,
          volume,
        });

      } catch {

        /*
         * Ignore an individual malformed
         * historical row instead of failing
         * the entire baseline.
         */

        continue;
      }
    }


    /*
     * Historical data should be ordered
     * from oldest → newest for return
     * calculations.
     */

    prices.sort(
      (a, b) =>
        a.tradeDate.getTime() -
        b.tradeDate.getTime()
    );


    return prices;

  } catch (error) {

    if (
      error instanceof Error &&
      error.name === "AbortError"
    ) {
      throw new Error(
        "BharatStock historical request timed out"
      );
    }

    throw error;

  } finally {

    clearTimeout(timeout);
  }
}


/*
 * =========================================================
 * BUILD HISTORICAL BASELINE
 * =========================================================
 */

export function calculateHistoricalBaseline(
  symbol: string,
  prices: HistoricalPricePoint[]
): HistoricalBaseline {

  if (
    prices.length <
    MINIMUM_OBSERVATIONS
  ) {

    throw new Error(
      `Not enough historical data for ${symbol}. ` +
      `Required at least ${MINIMUM_OBSERVATIONS} observations, ` +
      `received ${prices.length}.`
    );
  }

  /*
   * =======================================================
   * DAILY RETURNS
   * =======================================================
   *
   * We use adjusted close so corporate actions
   * such as splits/bonuses don't create artificial
   * jumps in our baseline.
   */

  const dailyReturns: number[] = [];


  for (
    let index = 1;
    index < prices.length;
    index++
  ) {

    const previousClose =
      prices[index - 1]
        .adjustedClose;

    const currentClose =
      prices[index]
        .adjustedClose;


    if (
      previousClose <= 0 ||
      currentClose <= 0
    ) {
      continue;
    }


    const dailyReturn =
      ((currentClose -
        previousClose) /
        previousClose) *
      100;


    if (
      Number.isFinite(
        dailyReturn
      )
    ) {

      dailyReturns.push(
        dailyReturn
      );
    }
  }

  if (
    dailyReturns.length <
    MINIMUM_OBSERVATIONS - 1
  ) {

    throw new Error(
      `Not enough valid return observations for ${symbol}.`
    );
  }


  /*
   * =======================================================
   * VOLUME
   * =======================================================
   */

  const volumes =
    prices
      .map(
        (price) =>
          price.volume
      )
      .filter(
        (volume) =>
          Number.isFinite(
            volume
          )
      );


  if (
    volumes.length <
    MINIMUM_OBSERVATIONS
  ) {

    throw new Error(
      `Not enough valid volume observations for ${symbol}.`
    );
  }


  /*
   * =======================================================
   * STATISTICS
   * =======================================================
   */

  const averageDailyReturn =
    calculateMean(
      dailyReturns
    );


  const returnVolatility =
    calculateStandardDeviation(
      dailyReturns,
      averageDailyReturn
    );


  const averageVolume =
    calculateMean(
      volumes
    );


  const volumeVolatility =
    calculateStandardDeviation(
      volumes,
      averageVolume
    );


  return {

    symbol,

    observations:
      prices.length,

    averageDailyReturn,

    returnVolatility,

    averageVolume,

    volumeVolatility,

    latestHistoricalDate:
      prices[
        prices.length - 1
      ].tradeDate,
  };
}


/*
 * =========================================================
 * FETCH + CALCULATE BASELINE
 * =========================================================
 */

export async function getHistoricalBaseline(
  symbol: string,
  exchange: string
): Promise<HistoricalBaseline> {

  const cachedBaseline =
    getCachedHistoricalBaseline(
      symbol,
      exchange
    );

  if (cachedBaseline) {
    return cachedBaseline;
  }

  const prices =
    await getHistoricalPrices(
      symbol,
      exchange
    );

  const baseline =
    calculateHistoricalBaseline(
      symbol,
      prices
    );

  setCachedHistoricalBaseline(
    baseline,
    exchange
  );

  return baseline;
}