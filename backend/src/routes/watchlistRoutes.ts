import { Router } from "express";

import {
  createWatchlist,
  getWatchlists,
  renameWatchlist,
  deleteWatchlist,
  addStockToWatchlist,
  removeStockFromWatchlist,
} from "../controllers/watchlistController.js";

import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);

router.post("/", createWatchlist);

router.get("/", getWatchlists);

router.patch("/:id", renameWatchlist);

router.delete("/:id", deleteWatchlist);

router.post("/:id/stocks", addStockToWatchlist);

router.delete(
  "/:id/stocks/:stockId",
  removeStockFromWatchlist
);

export default router;