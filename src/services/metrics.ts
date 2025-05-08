import { getSwapMetrics, getHighValueOrders } from "../database/queries";
import { logger } from "../utils/logger";
import { SwapMetrics } from "../types";

export async function generateMetricsReport(): Promise<SwapMetrics> {
  try {
    logger.info("Generating metrics report");
    const metrics = await getSwapMetrics();
    const highValueOrders = await getHighValueOrders(18);

    return {
      ...metrics,
      highValueOrders,
    };
  } catch (error) {
    logger.error("Error generating metrics report:", error);
    throw error;
  }
}
