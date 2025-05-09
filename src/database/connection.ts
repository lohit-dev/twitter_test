import { Pool } from "pg";
import { dbConfig } from "../config/database";
import { logger } from "../utils/logger";

const pool = new Pool(dbConfig);

pool.on("connect", () => {
  logger.info("Connected to PostgreSQL database");
});

pool.on("error", (err) => {
  logger.error("PostgreSQL pool error:", err);
});

export const db = {
  query: async (text: string, params?: any[]) => {
    try {
      const start = Date.now();
      const res = await pool.query(text, params);
      const duration = Date.now() - start;
      logger.debug(
        `Executed query: ${text} - Duration: ${duration}ms - Rows: ${res.rowCount}`,
      );
      return res;
    } catch (error) {
      logger.error("Database query error:", error);
      throw error;
    }
  },
  pool,
};
