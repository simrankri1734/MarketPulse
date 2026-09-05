import { Request, Response } from "express";
import mongoose from "mongoose";
import { User } from "../models/User.js";
import { Watchlist } from "../models/Watchlist.js";
import { Stock } from "../models/Stock.js";
import { AuthenticatedRequest } from "../middleware/authMiddleware.js";

export async function createWatchlist(
  req: Request,
  res: Response
) {
  try {
    const authenticatedRequest = req as AuthenticatedRequest;

    const name =
      typeof req.body?.name === "string"
        ? req.body.name.trim()
        : "";

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Watchlist name is required",
      });
    }

    if (name.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Watchlist name must be 100 characters or less",
      });
    }

    const user = await User.findOne({
      firebaseUid: authenticatedRequest.user.uid,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User profile not found",
      });
    }

    /*
     * Fast duplicate check for a friendly error message.
     *
     * MongoDB's unique compound index remains the final
     * protection against duplicate names and race conditions.
     */
    const existingWatchlist = await Watchlist.findOne({
      userId: user._id,
      name,
    }).collation({
      locale: "en",
      strength: 2,
    });

    if (existingWatchlist) {
      return res.status(409).json({
        success: false,
        message: "A watchlist with this name already exists",
      });
    }

    try {
      const watchlist = await Watchlist.create({
        userId: user._id,
        name,
        stocks: [],
      });

      return res.status(201).json({
        success: true,
        message: "Watchlist created successfully",
        watchlist,
      });
    } catch (error: unknown) {
      /*
       * MongoDB duplicate-key error.
       *
       * This protects against two requests trying to create
       * the same watchlist at nearly the same time.
       */
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000
      ) {
        return res.status(409).json({
          success: false,
          message: "A watchlist with this name already exists",
        });
      }

      throw error;
    }
  } catch (error) {
    console.error("Create watchlist error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create watchlist",
    });
  }
}

export async function getWatchlists(
  req: Request,
  res: Response
) {
  try {
    const authenticatedRequest = req as AuthenticatedRequest;

    const user = await User.findOne({
      firebaseUid: authenticatedRequest.user.uid,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User profile not found",
      });
    }

    const watchlists = await Watchlist.find({
      userId: user._id,
    })
      .populate("stocks.stockId")
      .sort({
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      watchlists,
    });
  } catch (error) {
    console.error("Get watchlists error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch watchlists",
    });
  }
}

/* =========================================================
   RENAME WATCHLIST
   ========================================================= */

export async function renameWatchlist(
  req: Request,
  res: Response
) {
  try {
    const authenticatedRequest = req as AuthenticatedRequest;

    /*
     * Express may type req.params.id as string | string[].
     * We normalize it to a single string before using it
     * with MongoDB.
     */
    const id = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    /*
     * Validate the MongoDB ObjectId before querying.
     */
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid watchlist ID",
      });
    }

    /*
     * Get and normalize the new watchlist name.
     */
    const name =
      typeof req.body?.name === "string"
        ? req.body.name.trim()
        : "";

    /*
     * Reject empty or whitespace-only names.
     */
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Watchlist name is required",
      });
    }

    /*
     * Enforce the same 100-character limit used
     * when creating a watchlist.
     */
    if (name.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Watchlist name must be 100 characters or less",
      });
    }

    /*
     * Find the authenticated MongoDB user.
     */
    const user = await User.findOne({
      firebaseUid: authenticatedRequest.user.uid,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User profile not found",
      });
    }

    /*
     * IMPORTANT:
     *
     * We search using BOTH:
     *
     *   _id
     *   userId
     *
     * This prevents a user from renaming another user's
     * watchlist even if they somehow know its MongoDB ID.
     */
    const watchlist = await Watchlist.findOne({
      _id: id,
      userId: user._id,
    });

    if (!watchlist) {
      return res.status(404).json({
        success: false,
        message: "Watchlist not found",
      });
    }

    /*
     * Check whether another watchlist owned by this same
     * user already has the requested name.
     *
     * strength: 2 makes the comparison case-insensitive.
     */
    const duplicateWatchlist = await Watchlist.findOne({
      _id: { $ne: id },
      userId: user._id,
      name,
    }).collation({
      locale: "en",
      strength: 2,
    });

    if (duplicateWatchlist) {
      return res.status(409).json({
        success: false,
        message: "A watchlist with this name already exists",
      });
    }

    try {
      /*
       * Update only the name.
       *
       * Existing stocks, position, createdAt, etc.
       * remain unchanged.
       */
      watchlist.name = name;

      await watchlist.save();

      return res.status(200).json({
        success: true,
        message: "Watchlist renamed successfully",
        watchlist,
      });
    } catch (error: unknown) {
      /*
       * The MongoDB unique index is the final protection
       * against concurrent rename/create operations.
       */
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000
      ) {
        return res.status(409).json({
          success: false,
          message: "A watchlist with this name already exists",
        });
      }

      throw error;
    }
  } catch (error) {
    console.error("Rename watchlist error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to rename watchlist",
    });
  }
}

export async function deleteWatchlist(
  req: Request,
  res: Response
) {
  try {
    const authenticatedRequest = req as AuthenticatedRequest;

    /*
     * Express may type req.params.id as string | string[].
     * Normalize it to a single string before using it
     * with MongoDB.
     */
    const id = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    /*
     * Validate MongoDB ObjectId.
     */
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid watchlist ID",
      });
    }

    /*
     * Find the authenticated user.
     */
    const user = await User.findOne({
      firebaseUid: authenticatedRequest.user.uid,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User profile not found",
      });
    }

    /*
     * Delete only when BOTH:
     * 1. The watchlist ID matches.
     * 2. The watchlist belongs to the authenticated user.
     *
     * This prevents one user from deleting another user's
     * watchlist even if they somehow know its MongoDB ID.
     */
    const deletedWatchlist = await Watchlist.findOneAndDelete({
      _id: id,
      userId: user._id,
    });

    if (!deletedWatchlist) {
      return res.status(404).json({
        success: false,
        message: "Watchlist not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Watchlist deleted successfully",
      watchlistId: deletedWatchlist._id,
    });
  } catch (error) {
    console.error("Delete watchlist error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete watchlist",
    });
  }
}

interface AddStockRequest {
  symbol?: string;
  name?: string;
  exchange?: string;
  currency?: string;
}

export async function addStockToWatchlist(
  req: Request,
  res: Response
) {
  try {
    const authenticatedRequest = req as AuthenticatedRequest;

    /*
     * Normalize the watchlist ID.
     */
    const watchlistId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    /*
     * Validate MongoDB ObjectId.
     */
    if (!mongoose.Types.ObjectId.isValid(watchlistId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid watchlist ID",
      });
    }

    /*
     * Validate request body.
     */
    const body = req.body as AddStockRequest;

    const symbol =
      typeof body.symbol === "string"
        ? body.symbol.trim().toUpperCase()
        : "";

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : "";

    const exchange =
      typeof body.exchange === "string"
        ? body.exchange.trim().toUpperCase()
        : "";

    const currency =
      typeof body.currency === "string"
        ? body.currency.trim().toUpperCase()
        : "";

    if (!symbol || !name || !exchange || !currency) {
      return res.status(400).json({
        success: false,
        message:
          "Symbol, name, exchange, and currency are required",
      });
    }

    /*
     * Basic field-length protection.
     */
    if (symbol.length > 20) {
      return res.status(400).json({
        success: false,
        message: "Symbol must be 20 characters or less",
      });
    }

    if (name.length > 200) {
      return res.status(400).json({
        success: false,
        message: "Stock name must be 200 characters or less",
      });
    }

    if (exchange.length > 20) {
      return res.status(400).json({
        success: false,
        message: "Exchange must be 20 characters or less",
      });
    }

    if (currency.length > 10) {
      return res.status(400).json({
        success: false,
        message: "Currency must be 10 characters or less",
      });
    }

    /*
     * Find authenticated user.
     */
    const user = await User.findOne({
      firebaseUid: authenticatedRequest.user.uid,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User profile not found",
      });
    }

    /*
     * Find watchlist AND verify ownership.
     */
    const watchlist = await Watchlist.findOne({
      _id: watchlistId,
      userId: user._id,
    });

    if (!watchlist) {
      return res.status(404).json({
        success: false,
        message: "Watchlist not found",
      });
    }

    /*
     * Find existing stock by normalized symbol.
     */
    let stock = await Stock.findOne({
      symbol,
    });

    /*
     * Create stock if it doesn't already exist.
     */
    if (!stock) {
      try {
        stock = await Stock.create({
          symbol,
          name,
          exchange,
          currency,
        });
      } catch (error: unknown) {
        /*
         * Another request may have created the same stock
         * between findOne() and create().
         *
         * Re-read it instead of failing unnecessarily.
         */
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === 11000
        ) {
          stock = await Stock.findOne({
            symbol,
          });
        } else {
          throw error;
        }
      }
    }

    /*
     * Defensive check in case the duplicate-key recovery
     * could not retrieve the stock.
     */
    if (!stock) {
      return res.status(500).json({
        success: false,
        message: "Unable to create or find stock",
      });
    }

    /*
     * Prevent duplicate stock inside the same watchlist.
     */
    const alreadyAdded = watchlist.stocks.some(
      (watchlistStock) =>
        watchlistStock.stockId.toString() ===
        stock!._id.toString()
    );

    if (alreadyAdded) {
      return res.status(409).json({
        success: false,
        message: "This stock is already in the watchlist",
      });
    }

    /*
     * Calculate the next position.
     */
    const nextPosition =
      watchlist.stocks.length === 0
        ? 0
        : Math.max(
            ...watchlist.stocks.map(
              (watchlistStock) => watchlistStock.position
            )
          ) + 1;

    /*
     * Add stock to watchlist.
     */
    watchlist.stocks.push({
      stockId: stock._id,
      position: nextPosition,
      addedAt: new Date(),
    });

    await watchlist.save();

    /*
     * Return the updated watchlist.
     */
    return res.status(200).json({
      success: true,
      message: "Stock added to watchlist successfully",
      watchlist,
      stock,
    });
  } catch (error) {
    console.error(
      "Add stock to watchlist error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to add stock to watchlist",
    });
  }
}

export async function removeStockFromWatchlist(
  req: Request,
  res: Response
) {
  try {
    const authenticatedRequest = req as AuthenticatedRequest;

    const watchlistId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    const stockId = Array.isArray(req.params.stockId)
      ? req.params.stockId[0]
      : req.params.stockId;

    if (!mongoose.Types.ObjectId.isValid(watchlistId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid watchlist ID",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(stockId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid stock ID",
      });
    }

    const user = await User.findOne({
      firebaseUid: authenticatedRequest.user.uid,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User profile not found",
      });
    }

    /*
     * Find the watchlist AND verify ownership.
     */
    const watchlist = await Watchlist.findOne({
      _id: watchlistId,
      userId: user._id,
    });

    if (!watchlist) {
      return res.status(404).json({
        success: false,
        message: "Watchlist not found",
      });
    }

    /*
     * Find the stock inside this watchlist.
     */
    const stockIndex = watchlist.stocks.findIndex(
      (watchlistStock) =>
        watchlistStock.stockId.toString() === stockId
    );

    if (stockIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Stock is not in this watchlist",
      });
    }

    /*
     * Remove only the stock reference from the watchlist.
     *
     * We intentionally do NOT delete the Stock document,
     * because the same stock may belong to other users/watchlists.
     */
    watchlist.stocks.splice(stockIndex, 1);

    await watchlist.save();

    return res.status(200).json({
      success: true,
      message: "Stock removed from watchlist successfully",
      watchlist,
    });
  } catch (error) {
    console.error(
      "Remove stock from watchlist error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to remove stock from watchlist",
    });
  }
}