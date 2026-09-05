import "dotenv/config";
import app from "./app.js";
import { connectDatabase } from "./config/database.js";

const PORT = process.env.PORT || 5001;

async function startServer() {
  try {
    await connectDatabase();

    app.listen(PORT, () => {
      console.log(`MarketPulse backend running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();