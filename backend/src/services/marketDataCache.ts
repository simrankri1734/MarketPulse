import type { MarketQuote } from "./marketDataService.js";

interface CacheEntry {
  data: MarketQuote;
  cachedAt: number;
}

const cache = new Map<string, CacheEntry>();

// Keep market data for 5 minutes.
const CACHE_TTL_MS = 5 * 60 * 1000;

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export function getCachedMarketQuote(
  symbol: string
): MarketQuote | null {
  const key = normalizeSymbol(symbol);

  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  const isExpired =
    Date.now() - entry.cachedAt > CACHE_TTL_MS;

  if (isExpired) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

export function setCachedMarketQuote(
  data: MarketQuote
): void {
  const key = normalizeSymbol(data.symbol);

  cache.set(key, {
    data,
    cachedAt: Date.now(),
  });
}

export function clearMarketDataCache(): void {
  cache.clear();
}