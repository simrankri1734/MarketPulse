import { Router } from "express";

import { searchStocks } from "../controllers/stockController.js";

import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);

router.get("/search", searchStocks);

export default router;