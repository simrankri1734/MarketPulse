import { Router } from "express";

import {
  getWatchlistMarketData,
  checkWatchlistMarketData,
} from "../controllers/marketController.js";

import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);

router.get(
  "/watchlists/:id",
  getWatchlistMarketData
);

router.post(
  "/watchlists/:id/check",
  checkWatchlistMarketData
);

export default router;