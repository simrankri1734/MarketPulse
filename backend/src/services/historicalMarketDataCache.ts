import type { HistoricalBaseline } from "./historicalMarketDataService.js";

interface CacheEntry {
  data: HistoricalBaseline;
  cachedAt: number;
}

const cache = new Map<string, CacheEntry>();

const CACHE_TTL_MS = 60 * 60 * 1000;

function normalizeKey(
  symbol: string,
  exchange: string
): string {
  return `${symbol.trim().toUpperCase()}:${exchange.trim().toUpperCase()}`;
}

export function getCachedHistoricalBaseline(
  symbol: string,
  exchange: string
): HistoricalBaseline | null {
  const key = normalizeKey(symbol, exchange);

  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  if (
    Date.now() - entry.cachedAt >=
    CACHE_TTL_MS
  ) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

export function setCachedHistoricalBaseline(
  data: HistoricalBaseline,
  exchange: string
): void {
  const key = normalizeKey(
    data.symbol,
    exchange
  );

  cache.set(key, {
    data,
    cachedAt: Date.now(),
  });
}

export function clearHistoricalBaselineCache(): void {
  cache.clear();
}