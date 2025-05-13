import {
  getOrderMetrics,
  getSwapMetrics as getSummaryMetrics,
} from "../database/index";
import { logger } from "../utils/logger";
import { SwapMetrics, SuccessfulOrder } from "../types";
import fs from "fs";
import path from "path";
import { twitterService } from "./twitter";
import { formatCurrency } from "../utils/formatters";
import orderTemplate from "../templates/order";

// Path for storing successful orders
const ORDERS_LOG_PATH = path.join(
  __dirname,
  "..",
  "..",
  "successful_orders.json"
);

// Set to track order IDs we've already processed
const processedOrderIds = new Set<string>();

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

/**
 * Process new orders, check volume thresholds, and post tweets for high-volume orders
 * @param volumeThreshold USD threshold for posting tweets
 * @returns Array of order IDs that were processed
 */
export async function processNewOrders(
  volumeThreshold: number
): Promise<string[]> {
  try {
    logger.info("Processing new orders");

    // Get new orders with volume calculations
    const newOrders = await getOrderMetrics();

    if (newOrders.length === 0) {
      logger.info("No new orders to process");
      return [];
    }

    // Filter out orders we've already processed
    const unprocessedOrders = newOrders.filter(
      (order) => !processedOrderIds.has(order.create_order_id)
    );

    if (unprocessedOrders.length === 0) {
      logger.info("No new unprocessed orders found");
      return [];
    }

    logger.info(`Found ${unprocessedOrders.length} new unprocessed orders`);

    const processedIds: string[] = [];

    // Process each new order
    for (const order of unprocessedOrders) {
      // Add to processed set
      processedOrderIds.add(order.create_order_id);
      processedIds.push(order.create_order_id);

      // Log the order details
      logger.info(`New Successful Order: ${JSON.stringify(order, null, 2)}`);

      // Check if order volume exceeds threshold
      if (order.volume >= volumeThreshold) {
        logger.info(
          `Order volume (${formatCurrency(order.volume)}) exceeds threshold (${formatCurrency(volumeThreshold)}). Generating image and posting to Twitter.`
        );

        try {
          // Generate image for the order
          const imagePath = await orderTemplate.generate(order);

          // Create tweet text
          const tweetText = `New high-volume swap: ${formatCurrency(order.volume)} from ${order.source_chain} to ${order.destination_chain}`;

          // Post to Twitter
          const result = await twitterService.postTweet(tweetText, imagePath);
          logger.info(`Tweet posted successfully with ID: ${result.id}`);
        } catch (error) {
          logger.error(
            `Error posting tweet for order ${order.create_order_id}: ${error}`
          );
        }
      } else {
        logger.info(
          `Order volume (${formatCurrency(order.volume)}) is below threshold (${formatCurrency(volumeThreshold)}). Skipping post.`
        );
      }

      // Save to file
      saveOrderToFile(order);
    }

    return processedIds;
  } catch (error) {
    logger.error("Error processing new orders:", error);
    throw error;
  }
}

/**
 * Save an order to the JSON file
 * @param order Order to save
 */
function saveOrderToFile(order: SuccessfulOrder): void {
  try {
    let orders: SuccessfulOrder[] = [];

    // Read existing orders if file exists
    if (fs.existsSync(ORDERS_LOG_PATH)) {
      try {
        const data = fs.readFileSync(ORDERS_LOG_PATH, "utf8");
        orders = JSON.parse(data);
      } catch (err) {
        logger.error(`Error reading orders log: ${err}`);
      }
    }

    // Add new order
    orders.push(order);

    // Keep only the last 1000 orders
    if (orders.length > 1000) {
      orders = orders.slice(-1000);
    }

    // Write back to file
    fs.writeFileSync(ORDERS_LOG_PATH, JSON.stringify(orders, null, 2));
    logger.info(`Order ${order.create_order_id} saved to file`);
  } catch (error) {
    logger.error(`Error saving order to file: ${error}`);
  }
}

export async function generateMetricForOrder() {
  try {
    logger.info("Generating Order metrics");

    const metrics = await getOrderMetrics();

    return { ...metrics };
  } catch (error) {
    logger.error("Error generating metrics report:", error);
    throw error;
  }
}
