import express from "express";
import cors from "cors";
import pinoHttp from "pino-http";

import authRoutes from "./routes/authRoutes.js";
import watchlistRoutes from "./routes/watchlistRoutes.js";
import stockRoutes from "./routes/stockRoutes.js";
import marketRoutes from "./routes/marketRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use(
  pinoHttp({
    redact: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
    ],
  })
);

app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "MarketPulse backend is running",
  });
});

app.use("/api/auth", authRoutes);

app.use("/api/watchlists", watchlistRoutes);
app.use("/api/stocks", stockRoutes);
app.use("/api/market", marketRoutes);

export default app;