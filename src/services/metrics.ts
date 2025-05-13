import { getSwapMetrics } from "../database/index";
import { logger } from "../utils/logger";
import { SwapMetrics } from "../types";

export async function generateMetricsReport(): Promise<SwapMetrics> {
  try {
    logger.info("Generating metrics report");
    const metrics = await getSwapMetrics();

    return {
      ...metrics,
    };
  } catch (error) {
    logger.error("Error generating metrics report:", error);
    throw error;
  }
}
