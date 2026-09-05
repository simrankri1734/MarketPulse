import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { apiFetch } from "../lib/api";
import "../styles/watchlist.css";

interface Stock {
  _id: string;
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
}

interface WatchlistStock {
  stockId: Stock | string;
  position: number;
  addedAt: string;
}

interface Watchlist {
  _id: string;
  name: string;
  stocks: WatchlistStock[];
}

interface SearchStock {
  _id: string;
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
}

interface SearchStocksResponse {
  success: boolean;
  stocks: SearchStock[];
}

interface AddStockResponse {
  success: boolean;
  message: string;
  watchlist: Watchlist;
  stock: SearchStock;
}

/*
 * =========================================================
 * MARKET DATA TYPES
 * =========================================================
 */

interface MarketData {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;

  price: number;
  volume: number;

  marketDataTime: string;
  fetchedAt: string;

  dataSource: string;
  dataStatus: "FRESH" | "DELAYED" | "STALE";

  /*
   * True when the external market provider failed
   * and the backend returned the last successful
   * persisted market snapshot.
   */
  isFallback?: boolean;

  previousClose?: number;
  change?: number;
  percentChange?: number;
}

interface PreviousCheck {
  price: number;
  volume: number;
  checkedAt: string;
}

interface ChangeSinceLastCheck {
  priceChange: number;
  percentChange: number;
  volumeChange: number;
  volumeChangePercent: number;
}

interface MarketStockResult {
  stock: Stock;
  market: MarketData | null;
  previousCheck: PreviousCheck | null;
  changeSinceLastCheck: ChangeSinceLastCheck | null;
  attention: AttentionResult | null;
  error?: string;
}
interface AttentionReason {
  type: "PRICE" | "VOLUME" | "EVENT" | "RECENCY";
  message: string;
  contribution: number;
}

interface AttentionResult {
  score: number;
  level: "NORMAL" | "WATCH" | "SIGNIFICANT" | "HIGH";
  reasons: AttentionReason[];
}

interface MarketWatchlistResponse {
  success: boolean;

  watchlist: {
    _id: string;
    name: string;
  };

  fetchedAt: string;

  stocks: MarketStockResult[];
}

export default function WatchlistPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [watchlist, setWatchlist] = useState<Watchlist | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchStock[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [addingStock, setAddingStock] = useState<string | null>(null);

  const [removingStock, setRemovingStock] = useState<string | null>(null);

  /*
   * =========================================================
   * MARKET DATA STATE
   * =========================================================
   */

  const [marketData, setMarketData] = useState<MarketStockResult[]>(
    []
  );

  const [marketLoading, setMarketLoading] = useState(false);

  const [marketError, setMarketError] = useState("");

  /*
   * =========================================================
   * LOAD WATCHLIST
   * =========================================================
   */

  useEffect(() => {
    if (!id) {
      setError("Invalid watchlist.");
      setLoading(false);
      return;
    }

    loadWatchlist();
  }, [id]);

  async function loadWatchlist() {
    try {
      setLoading(true);
      setError("");

      /*
       * GET /api/watchlists returns the authenticated
       * user's watchlists.
       *
       * We use it here to locate the requested watchlist.
       */

      const response = (await apiFetch(
        "/watchlists"
      )) as {
        success: boolean;
        watchlists: Watchlist[];
      };

      const foundWatchlist = response.watchlists?.find(
        (item) => item._id === id
      );

      if (!foundWatchlist) {
        throw new Error("Watchlist not found.");
      }

      setWatchlist(foundWatchlist);
    } catch (error) {
      console.error("Failed to load watchlist:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Unable to load watchlist."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * =========================================================
   * LOAD MARKET DATA
   * =========================================================
   *
   * This calls the backend market endpoint.
   *
   * The backend is responsible for:
   *
   * 1. Getting the latest available market data
   * 2. Looking up the user's previous successful check
   * 3. Comparing current data with that previous check
   * 4. Returning the comparison to the frontend
   *
   * IMPORTANT:
   * The frontend does not calculate the official
   * "since last check" baseline itself.
   */

  async function loadMarketData() {
    if (!id) {
      return;
    }

    try {
      setMarketLoading(true);
      setMarketError("");

      const response = (await apiFetch(
        `/market/watchlists/${id}`
      )) as MarketWatchlistResponse;

      if (!response.success) {
        throw new Error(
          "Failed to load market data."
        );
      }

      setMarketData(response.stocks ?? []);
    } catch (error) {
      console.error(
        "Failed to load market data:",
        error
      );

      setMarketError(
        error instanceof Error
          ? error.message
          : "Unable to load market data."
      );

      setMarketData([]);
    } finally {
      setMarketLoading(false);
    }
  }



    async function checkMarketData() {
    if (!id) {
      return;
    }

    try {
      setMarketLoading(true);
      setMarketError("");

      const response = (await apiFetch(
        `/market/watchlists/${id}/check`,
        {
          method: "POST",
        }
      )) as MarketWatchlistResponse;

      if (!response.success) {
        throw new Error(
          "Failed to check market data."
        );
      }

      setMarketData(response.stocks ?? []);
    } catch (error) {
      console.error(
        "Failed to check market data:",
        error
      );

      setMarketError(
        error instanceof Error
          ? error.message
          : "Unable to check market data."
      );

      setMarketData([]);
    } finally {
      setMarketLoading(false);
    }
  }
  /*
   * =========================================================
   * LOAD MARKET DATA WHEN WATCHLIST OPENS
   * =========================================================
   */

  useEffect(() => {
    if (!id) {
      return;
    }

    loadMarketData();
  }, [id]);

  /*
   * =========================================================
   * SEARCH STOCKS
   * =========================================================
   */

  async function handleSearch(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const query = searchQuery.trim();

    try {
      setSearchLoading(true);
      setSearchError("");

      const response = (await apiFetch(
        `/stocks/search?q=${encodeURIComponent(query)}`
      )) as SearchStocksResponse;

      setSearchResults(response.stocks ?? []);
    } catch (error) {
      console.error(
        "Failed to search stocks:",
        error
      );

      setSearchError(
        error instanceof Error
          ? error.message
          : "Unable to search stocks."
      );

      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }

  /*
   * =========================================================
   * ADD STOCK
   * =========================================================
   */

  async function handleAddStock(
    stock: SearchStock
  ) {

    if (!id) {
      return;
    }

    try {
      setAddingStock(stock._id);
      setSearchError("");

      const response = (await apiFetch(
        `/watchlists/${id}/stocks`,
        {
          method: "POST",

          body: JSON.stringify({
            symbol: stock.symbol,
            name: stock.name,
            exchange: stock.exchange,
            currency: stock.currency,
          }),
        }
      )) as AddStockResponse;

      if (!response.success) {
        throw new Error(
          response.message ||
            "Failed to add stock."
        );
      }

      setWatchlist(response.watchlist);

      /*
       * Remove the added stock from search results
       * so it cannot accidentally be added again.
       */

      setSearchResults(
        (currentResults) =>
          currentResults.filter(
            (result) =>
              result._id !== stock._id
          )
      );

      /*
       * Refresh market data so the newly added
       * stock can appear immediately.
       *
       * The backend determines whether this is
       * a first check or a comparison.
       */

      await loadMarketData();
    } catch (error) {
      console.error(
        "Failed to add stock:",
        error
      );

      setSearchError(
        error instanceof Error
          ? error.message
          : "Unable to add stock."
      );
    } finally {
      setAddingStock(null);
    }
  }

  async function handleRemoveStock(stock: Stock) {
    if (!id) {
      return;
    }

    const confirmed = window.confirm(
      `Remove ${stock.symbol} from this watchlist?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setRemovingStock(stock._id);
      setError("");

      const response = (await apiFetch(
        `/watchlists/${id}/stocks/${stock._id}`,
        {
          method: "DELETE",
        }
      )) as {
        success: boolean;
        message: string;
      };

      if (!response.success) {
        throw new Error(
          response.message || "Failed to remove stock."
        );
      }

      await loadWatchlist();

      await loadMarketData();
    } catch (error) {
      console.error(
        "Failed to remove stock:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Unable to remove stock."
      );
    } finally {
      setRemovingStock(null);
    }
  }

  /*
   * =========================================================
   * HELPER FUNCTIONS
   * =========================================================
   */

  function formatPrice(value: number) {
    return value.toLocaleString(
      "en-IN",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );
  }

  function formatNumber(value: number) {
    return value.toLocaleString(
      "en-IN"
    );
  }

  function formatPercent(value: number) {
    return `${value >= 0 ? "+" : ""}${value.toFixed(
      2
    )}%`;
  }

  function formatDateTime(value: string) {
    return new Date(value).toLocaleString(
      "en-IN"
    );
  }

  function getChangeClass(value: number) {
    if (value > 0) {
      return "positive";
    }

    if (value < 0) {
      return "negative";
    }

    return "";
  }

  /*
   * =========================================================
   * LOADING
   * =========================================================
   */

  if (loading) {
    return (
      <div className="watchlist-page">
        <div className="watchlist-page-loading">
          <div className="loading-spinner" />

          <p>
            Loading watchlist...
          </p>
        </div>
      </div>
    );
  }

  /*
   * =========================================================
   * ERROR
   * =========================================================
   */

  if (error || !watchlist) {
    return (
      <div className="watchlist-page">
        <div className="watchlist-page-error">
          <h2>
            Unable to open watchlist
          </h2>

          <p>
            {error ||
              "Watchlist not found."}
          </p>

          <button
            type="button"
            onClick={() =>
              navigate("/dashboard")
            }
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  /*
   * =========================================================
   * UI
   * =========================================================
   */

  return (
    <div className="watchlist-page">

      {/* ================= HEADER ================= */}

      <header className="watchlist-header">

        <button
          type="button"
          className="watchlist-back-button"
          onClick={() =>
            navigate("/dashboard")
          }
        >
          ← Dashboard
        </button>

        <div className="watchlist-header-brand">

          <div className="dashboard-brand-mark">

            <svg
              viewBox="0 0 32 32"
              width="22"
              height="22"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M5 23L11 16L16 20L26 8"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              <path
                d="M21 8H26V13"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

          </div>

          <span>
            MarketPulse
          </span>

        </div>

      </header>

      {/* ================= MAIN ================= */}

      <main className="watchlist-main">

        {/* ================= TITLE ================= */}

        <section className="watchlist-title-section">

          <div>

            <p className="dashboard-eyebrow">
              WATCHLIST
            </p>

            <h1>
              {watchlist.name}
            </h1>

            <p>
              {watchlist.stocks.length}{" "}
              {watchlist.stocks.length === 1
                ? "stock"
                : "stocks"}{" "}
              in this watchlist
            </p>

          </div>

        </section>

        {/* ================= ADD STOCK ================= */}

        <section className="add-stock-section">

          <div className="section-heading">

            <div>

              <span className="section-label">
                ADD STOCK
              </span>

              <h2>
                Find a stock to track
              </h2>

            </div>

          </div>

          <form
            className="stock-search-form"
            onSubmit={handleSearch}
          >

            <div className="stock-search-input-wrapper">

              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  cx="11"
                  cy="11"
                  r="6"
                  stroke="currentColor"
                  strokeWidth="2"
                />

                <path
                  d="M16 16L21 21"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>

              <input
                type="text"
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(
                    event.target.value
                  )
                }
                placeholder="Search by company name or symbol..."
              />

            </div>

            <button
              type="submit"
              disabled={searchLoading}
            >
              {searchLoading
                ? "Searching..."
                : "Search"}
            </button>

          </form>

          {searchError && (
            <div className="stock-search-error">
              {searchError}
            </div>
          )}

          {/* ================= SEARCH RESULTS ================= */}

          {searchResults.length > 0 && (
            <div className="stock-search-results">

              {searchResults.map(
                (stock) => {

                  const alreadyAdded =
                    watchlist.stocks.some(
                      (item) =>
                        typeof item.stockId !==
                          "string" &&
                        item.stockId._id ===
                          stock._id
                    );

                  return (
                    <div
                      key={stock._id}
                      className="stock-result-card"
                    >

                      <div className="stock-result-info">

                        <div className="stock-symbol">
                          {stock.symbol}
                        </div>

                        <div>

                          <h3>
                            {stock.name}
                          </h3>

                          <p>
                            {stock.exchange} ·{" "}
                            {stock.currency}
                          </p>

                        </div>

                      </div>

                      <button
                        type="button"
                        className="stock-add-button"
                        disabled={
                          alreadyAdded ||
                          addingStock ===
                            stock._id
                        }
                        onClick={() =>
                          handleAddStock(
                            stock
                          )
                        }
                      >
                        {alreadyAdded
                          ? "Added"
                          : addingStock ===
                              stock._id
                            ? "Adding..."
                            : "Add"}
                      </button>

                    </div>
                  );
                }
              )}

            </div>
          )}

          {!searchLoading &&
            searchQuery.trim() &&
            searchResults.length === 0 &&
            !searchError && (
              <div className="stock-no-results">
                No supported stocks found.
              </div>
            )}

        </section>

        {/* =====================================================
            MARKET DATA
            ===================================================== */}

        <section className="market-data-section">

          <div className="section-heading">

            <div>

              <span className="section-label">
                MARKET CHECK
              </span>

              <h2>
                Latest available market data
              </h2>

              <p className="market-data-subtitle">
                EOD data from BharatStock ·
                compared with your last check
              </p>

            </div>

            <button
              type="button"
              className="market-refresh-button"
              onClick={checkMarketData}
              disabled={marketLoading}
            >
              {marketLoading
                ? "Checking..."
                : "Check again"}
            </button>

          </div>

          {/* ================= MARKET ERROR ================= */}

          {marketError && (
            <div className="market-data-error">

              <div>
                <strong>
                  Couldn't load market data.
                </strong>

                <p>
                  {marketError}
                </p>
              </div>

              <button
                type="button"
                onClick={checkMarketData}
              >
                Try again
              </button>

            </div>
          )}

          {/* ================= MARKET LOADING ================= */}

          {marketLoading &&
            !marketError && (
              <div className="market-data-loading">

                <div className="loading-spinner" />

                <p>
                  Checking the latest
                  available market data...
                </p>

              </div>
            )}

          {/* ================= MARKET RESULTS ================= */}

          {!marketLoading &&
            !marketError &&
            marketData.length > 0 && (

              <div className="market-stock-list">

                {marketData.map(
                  (item) => {

                    /*
                     * =========================================
                     * MARKET DATA UNAVAILABLE
                     * =========================================
                     */

                    if (!item.market) {

                      return (
                        <article
                          key={item.stock._id}
                          className="market-stock-card market-stock-unavailable"
                        >

                          <div className="market-stock-main">

                            <div className="current-stock-symbol">
                              {item.stock.symbol}
                            </div>

                            <div className="current-stock-info">

                              <h3>
                                {item.stock.name}
                              </h3>

                              <p>
                                {item.stock.exchange} ·{" "}
                                {item.stock.currency}
                              </p>

                            </div>

                          </div>

                          <div className="market-unavailable-message">

                            {item.error ||
                              "Market data temporarily unavailable"}

                          </div>

                        </article>
                      );
                    }

                    /*
                     * =========================================
                     * MARKET DATA AVAILABLE
                     * =========================================
                     */

                    const market =
                      item.market;

                    const previous =
                      item.previousCheck;

                    const change =
                      item.changeSinceLastCheck;

                    const hasPreviousCheck =
                      previous !== null &&
                      change !== null;

                    return (
                      <article
                        key={item.stock._id}
                        className="market-stock-card"
                      >

                          {/* ================= STOCK HEADER ================= */}

                          <div className="market-stock-main">

                            <div className="current-stock-symbol">
                              {item.stock.symbol}
                            </div>

                            <div className="current-stock-info">

                              <h3>
                                {item.stock.name}
                              </h3>

                              <p>
                                {item.stock.exchange} ·{" "}
                                {item.stock.currency}
                              </p>

                            </div>

                            <div className="market-data-status">
                              {market.isFallback
                                ? "LAST SUCCESSFUL DATA"
                                : market.dataStatus}
                            </div>

                          </div>


                          {/* ================= FALLBACK NOTICE ================= */}

                          {market.isFallback && (
                            <div className="market-fallback-notice">
                              <strong>
                                Showing last successful market data
                              </strong>

                              <span>
                                The market data provider is temporarily unavailable.
                                No new baseline was created from this fallback data.
                              </span>
                            </div>
                          )}


                          {/* ================= CURRENT PRICE ================= */}

                          <div className="market-current-value">

                            <span className="market-price">
                              ₹
                              {formatPrice(
                                market.price
                              )}
                            </span>

                            {market.percentChange !==
                              undefined && (
                              <span
                                className={`market-price-change ${getChangeClass(
                                  market.percentChange
                                )}`}
                              >
                                {formatPercent(
                                  market.percentChange
                                )}
                              </span>
                            )}

                          </div>

                        {/* ================= VOLUME ================= */}

                        <div className="market-metric">

                          <span>
                            Volume
                          </span>

                          <strong>
                            {formatNumber(
                              market.volume
                            )}
                          </strong>

                        </div>

                        {/* ================= LAST CHECK ================= */}

                        <div className="market-comparison">

                          <div className="market-comparison-heading">

                            <span>
                              SINCE YOUR LAST CHECK
                            </span>

                          </div>

                          {!hasPreviousCheck ? (

                            <p className="market-first-check">
                              First successful check.
                              This data becomes your
                              baseline for the next check.
                            </p>

                          ) : (

                            <>

                              <div className="market-comparison-grid">

                                {/* Previous Price */}

                                <div>

                                  <span>
                                    Previous price
                                  </span>

                                  <strong>
                                    ₹
                                    {formatPrice(
                                      previous!.price
                                    )}
                                  </strong>

                                </div>

                                {/* Price Change */}

                                <div>

                                  <span>
                                    Price change
                                  </span>

                                  <strong
                                    className={getChangeClass(
                                      change!.priceChange
                                    )}
                                  >
                                    {change!.priceChange >=
                                    0
                                      ? "+"
                                      : ""}
                                    ₹
                                    {change!.priceChange.toFixed(
                                      2
                                    )}
                                  </strong>

                                </div>

                                {/* Percentage Change */}

                                <div>

                                  <span>
                                    Change
                                  </span>

                                  <strong
                                    className={getChangeClass(
                                      change!.percentChange
                                    )}
                                  >
                                    {formatPercent(
                                      change!.percentChange
                                    )}
                                  </strong>

                                </div>

                                {/* Volume Change */}

                                <div>

                                  <span>
                                    Volume change
                                  </span>

                                  <strong
                                    className={getChangeClass(
                                      change!
                                        .volumeChangePercent
                                    )}
                                  >
                                    {formatPercent(
                                      change!
                                        .volumeChangePercent
                                    )}
                                  </strong>

                                </div>

                              </div>

                              <p className="market-checked-at">
                                Previous check:{" "}
                                {formatDateTime(
                                  previous!.checkedAt
                                )}
                              </p>

                            </>

                          )}

                        </div>

                        {/* ================= ATTENTION ================= */}

                        {item.attention && (
                          <div className="attention-section">

                            <div className="attention-header">
                              <div>
                                <span className="attention-eyebrow">
                                  WHAT DESERVES ATTENTION
                                </span>

                                <h4>
                                  {item.attention.level === "NORMAL"
                                    ? item.attention.reasons.length > 0
                                      ? "Notable activity detected"
                                      : "No meaningful change detected"
                                    : `${item.attention.level} attention`}
                                </h4>
                              </div>

                              <div className="attention-score">
                                {item.attention.score}
                              </div>
                            </div>

                            {item.attention.reasons.length > 0 ? (
                              <div className="attention-reasons">
                                {item.attention.reasons.map(
                                  (reason, reasonIndex) => (
                                    <div
                                      key={`${reason.type}-${reasonIndex}`}
                                      className="attention-reason"
                                    >
                                      <div className="attention-reason-type">
                                        {reason.type}
                                      </div>

                                      <div className="attention-reason-content">
                                        <span>
                                          {reason.message}
                                        </span>

                                        <span className="attention-contribution">
                                          +{reason.contribution.toFixed(1)}
                                        </span>
                                      </div>
                                    </div>
                                  )
                                )}
                              </div>
                            ) : (
                              <p className="attention-empty">
                                Nothing significant has changed since your last check.
                              </p>
                            )}

                          </div>
                        )}

                        {/* ================= ATTENTION UNAVAILABLE ================= */}

                        {market.isFallback && (
                          <div className="attention-unavailable">
                            Attention analysis is unavailable because the
                            market provider is temporarily unavailable.
                          </div>
                        )}

                        {/* ================= DATA SOURCE ================= */}

                        <div className="market-data-footer">

                          <span>
                            EOD ·{" "}
                            {market.dataSource}
                          </span>

                          <span>
                            Market data:{" "}
                            {new Date(
                              market.marketDataTime
                            ).toLocaleDateString(
                              "en-IN"
                            )}
                          </span>

                        </div>

                      </article>
                    );
                  }
                )}

              </div>
            )}

          {/* ================= EMPTY MARKET STATE ================= */}

          {!marketLoading &&
            !marketError &&
            marketData.length === 0 &&
            watchlist.stocks.length > 0 && (

              <div className="market-empty-state">

                <p>
                  No market data is available
                  for the stocks in this
                  watchlist.
                </p>

              </div>
            )}

          {/* ================= NO STOCKS ================= */}

          {!marketLoading &&
            !marketError &&
            watchlist.stocks.length === 0 && (

              <div className="market-empty-state">

                <p>
                  Add stocks to this watchlist
                  to start checking market
                  changes.
                </p>

              </div>
            )}

        </section>

        {/* =====================================================
            CURRENT STOCKS
            ===================================================== */}

        <section className="current-stocks-section">

          <div className="section-heading">

            <div>

              <span className="section-label">
                YOUR STOCKS
              </span>

              <h2>
                Stocks you're tracking
              </h2>

            </div>

          </div>

          {watchlist.stocks.length ===
          0 ? (

            <div className="no-stocks-state">

              <div className="empty-chart">

                <svg
                  viewBox="0 0 120 70"
                  fill="none"
                  aria-hidden="true"
                >

                  <path
                    d="M5 58L28 43L47 49L68 27L84 36L115 8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  <circle
                    cx="115"
                    cy="8"
                    r="4"
                    fill="currentColor"
                  />

                </svg>

              </div>

              <h3>
                No stocks yet
              </h3>

              <p>
                Search for a company or
                stock symbol above to start
                tracking it.
              </p>

            </div>

          ) : (

            <div className="current-stock-list">

              {watchlist.stocks
                .slice()
                .sort(
                  (a, b) =>
                    a.position -
                    b.position
                )
                .map((item) => {

                  if (
                    typeof item.stockId ===
                    "string"
                  ) {
                    return null;
                  }

                  const stock =
                    item.stockId;

                  return (
                    <article
                      key={stock._id}
                      className="current-stock-card"
                    >

                      <div className="current-stock-symbol">
                        {stock.symbol}
                      </div>

                      <div className="current-stock-info">

                        <h3>
                          {stock.name}
                        </h3>

                        <p>
                          {stock.exchange} ·{" "}
                          {stock.currency}
                        </p>

                      </div>

                      <div className="current-stock-status">
                        Tracking
                      </div>

                      <button
                        type="button"
                        className="current-stock-remove-button"
                        onClick={() => handleRemoveStock(stock)}
                        disabled={removingStock === stock._id}
                      >
                        {removingStock === stock._id
                          ? "Removing..."
                          : "Remove"}
                      </button>

                    </article>
                  );
                })}

            </div>

          )}

        </section>

      </main>

    </div>
  );
}
