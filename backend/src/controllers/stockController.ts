import { Request, Response } from "express";
import { Stock } from "../models/Stock.js";

/*
 * Initial supported stock catalog.
 *
 * This is intentionally small for the challenge MVP.
 * Market data will be fetched separately later.
 */
const STOCK_CATALOG = [
  {
    symbol: "RELIANCE",
    name: "Reliance Industries",
    exchange: "NSE",
    currency: "INR",
  },
  {
    symbol: "TCS",
    name: "Tata Consultancy Services",
    exchange: "NSE",
    currency: "INR",
  },
  {
    symbol: "INFY",
    name: "Infosys",
    exchange: "NSE",
    currency: "INR",
  },
  {
    symbol: "HDFCBANK",
    name: "HDFC Bank",
    exchange: "NSE",
    currency: "INR",
  },
  {
    symbol: "ICICIBANK",
    name: "ICICI Bank",
    exchange: "NSE",
    currency: "INR",
  },
  {
    symbol: "SBIN",
    name: "State Bank of India",
    exchange: "NSE",
    currency: "INR",
  },
  {
    symbol: "ITC",
    name: "ITC",
    exchange: "NSE",
    currency: "INR",
  },
  {
    symbol: "BHARTIARTL",
    name: "Bharti Airtel",
    exchange: "NSE",
    currency: "INR",
  },
  {
    symbol: "LT",
    name: "Larsen & Toubro",
    exchange: "NSE",
    currency: "INR",
  },
  {
    symbol: "AXISBANK",
    name: "Axis Bank",
    exchange: "NSE",
    currency: "INR",
  },
  {
    symbol: "KOTAKBANK",
    name: "Kotak Mahindra Bank",
    exchange: "NSE",
    currency: "INR",
  },
  {
    symbol: "MARUTI",
    name: "Maruti Suzuki India",
    exchange: "NSE",
    currency: "INR",
  },
  {
    symbol: "SUNPHARMA",
    name: "Sun Pharmaceutical Industries",
    exchange: "NSE",
    currency: "INR",
  },
  {
    symbol: "TATAMOTORS",
    name: "Tata Motors",
    exchange: "NSE",
    currency: "INR",
  },
  {
    symbol: "HINDUNILVR",
    name: "Hindustan Unilever",
    exchange: "NSE",
    currency: "INR",
  },
  {
    symbol: "ADANIENT",
    name: "Adani Enterprises",
    exchange: "NSE",
    currency: "INR",
  },
  {
    symbol: "WIPRO",
    name: "Wipro",
    exchange: "NSE",
    currency: "INR",
  },
  {
    symbol: "HCLTECH",
    name: "HCL Technologies",
    exchange: "NSE",
    currency: "INR",
  },
  {
    symbol: "TECHM",
    name: "Tech Mahindra",
    exchange: "NSE",
    currency: "INR",
  },
  {
    symbol: "BAJFINANCE",
    name: "Bajaj Finance",
    exchange: "NSE",
    currency: "INR",
  },
];

/*
 * Search supported stocks.
 *
 * GET /api/stocks/search?q=reliance
 */
export async function searchStocks(
  req: Request,
  res: Response
) {
  try {
    const query =
      typeof req.query.q === "string"
        ? req.query.q.trim().toLowerCase()
        : "";

    /*
     * Empty search returns the first few supported stocks.
     * This is useful for showing initial suggestions.
     */
    const matchingStocks = STOCK_CATALOG.filter((stock) => {
      if (!query) {
        return true;
      }

      return (
        stock.symbol.toLowerCase().includes(query) ||
        stock.name.toLowerCase().includes(query)
      );
    }).slice(0, 10);

    /*
     * Make sure matching catalog entries exist in MongoDB.
     *
     * upsert prevents duplicate Stock documents while allowing
     * the catalog to be deterministic during development.
     */
    const stocks = await Promise.all(
      matchingStocks.map(async (stockData) => {
        return Stock.findOneAndUpdate(
          {
            symbol: stockData.symbol,
          },
          {
            $set: {
              name: stockData.name,
              exchange: stockData.exchange,
              currency: stockData.currency,
            },
          },
          {
            returnDocument: "after",
            upsert: true,
            setDefaultsOnInsert: true,
          }
        );
      })
    );

    return res.status(200).json({
      success: true,
      stocks,
    });
  } catch (error) {
    console.error("Search stocks error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to search stocks",
    });
  }
}