import { getSwapMetrics as getSummaryMetrics } from "../database/index";
import { logger } from "../utils/logger";
import { SwapMetrics } from "../types";

export async function generateSummaryMetrics(): Promise<SwapMetrics> {
  try {
    logger.info("Generating metrics report");
    const metrics = await getSummaryMetrics();

    return {
      ...metrics,
    };
  } catch (error) {
    logger.error("Error generating metrics report:", error);
    throw error;
  }
}
