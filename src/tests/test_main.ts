import { generateSummaryMetrics } from "../services/metrics";
import { generateMetricsImage } from "../utils/image_generator";
import { logger } from "../utils/logger";
import { formatMetricsToTweet } from "../utils/formatters";
import { db } from "../database/connection";
import fs from "fs";
import path from "path";
import orderTemplate from "../templates/order";
import { formatCurrency } from "../utils/formatters";
import { SuccessfulOrder } from "../types";
import { getDecimals } from "../database";
import { getAssetInfo } from "../services/api";
import { Asset } from "@gardenfi/orderbook";
import { getRelayFee } from "../services/timeAndFeeComparison/RelayFees";
import { getThorFee } from "../services/timeAndFeeComparison/ThorSwapFees";
import { getChainflipFee } from "../services/timeAndFeeComparison/ChainFlipFees";
import { comparisonMetric } from "../types";

const VOLUME_THRESHOLD = 1000;
const ORDER_VOLUME_THRESHOLD = 100;

const ORDERS_LOG_PATH = path.join(__dirname, "successful_orders.json");

const processedOrderIds = new Set<string>();

const startTimestamp = new Date().toISOString();

/**
 * Estimates the time for a transaction based on the input asset's chain
 * @param chain The chain of the input asset
 * @returns A string representation of the estimated time and minutes
 */
function getTimeEstimates(chain: string): {
  timeString: string;
  timeMinutes: number;
} {
  if (chain.toLowerCase() === "bitcoin" || chain.toLowerCase() === "btc") {
    return { timeString: "~10m", timeMinutes: 10 };
  }
  // For EVM chains (Ethereum, Arbitrum, etc.)
  return { timeString: "~30s", timeMinutes: 0.5 };
}

/**
 * Calculates the fee saved by comparing Garden's fee with other services
 * @param sourceAmount The source amount
 * @param destinationAmount The destination amount
 * @param inputTokenPrice The price of the input token
 * @param sourceChain The source chain
 * @param sourceAsset The source asset
 * @param destinationChain The destination chain
 * @param destinationAsset The destination asset
 * @returns The fee saved and time saved compared to other services
 */
async function calculateFeesAndTimeSaved(
  sourceAmount: number,
  destinationAmount: number,
  sourceChain: string,
  sourceAsset: string,
  destinationChain: string,
  destinationAsset: string
): Promise<{ feeSaved: number; timeSaved: string; timeSavedMinutes: number }> {
  try {
    const gardenFeeUsd = sourceAmount - destinationAmount;
    const gardenTimeEstimate = getTimeEstimates(sourceChain);

    const srcAsset: Asset = {
      chain: sourceChain,
      symbol: sourceAsset,
      decimals: 18, // Default, will be adjusted by the services
    };

    const destAsset: Asset = {
      chain: destinationChain,
      symbol: destinationAsset,
      decimals: 18, // Default, will be adjusted by the services
    };

    // Fetch fees and times from other services
    const sources = {
      Relay: getRelayFee,
      Thorswap: getThorFee,
      Chainflip: getChainflipFee,
    };

    const results = await Promise.all(
      Object.entries(sources).map(async ([key, fetchFn]) => {
        try {
          const { fee, time } = await fetchFn(
            srcAsset,
            destAsset,
            sourceAmount
          );
          return fee === 0 && time === 0 ? null : { key, fee, time };
        } catch (error) {
          logger.error(`Error fetching ${key} fee:`, error);
          return null;
        }
      })
    );

    const filteredResults = results.filter(Boolean) as {
      key: string;
      fee: number;
      time: number;
    }[];

    if (filteredResults.length === 0) {
      return {
        feeSaved: 0,
        timeSaved: "0s",
        timeSavedMinutes: 0,
      };
    }

    let maxFeeDiff = 0;
    let maxTimeDiff = 0;

    for (const { fee, time } of filteredResults) {
      const feeDiff = fee - gardenFeeUsd;
      const timeDiff = time - gardenTimeEstimate.timeMinutes * 60;

      if (feeDiff > maxFeeDiff) {
        maxFeeDiff = feeDiff;
      }

      if (timeDiff > maxTimeDiff) {
        maxTimeDiff = timeDiff;
      }
    }

    // Format the time saved
    let formattedTimeSaved = "0s";
    if (maxTimeDiff > 0) {
      if (maxTimeDiff >= 60) {
        formattedTimeSaved = `~${Math.floor(maxTimeDiff / 60)}m`;
      } else {
        formattedTimeSaved = `~${Math.floor(maxTimeDiff)}s`;
      }
    }

    return {
      feeSaved: maxFeeDiff,
      timeSaved: formattedTimeSaved,
      timeSavedMinutes: maxTimeDiff / 60,
    };
  } catch (error) {
    logger.error("Error calculating fees and time saved:", error);
    return {
      feeSaved: 0,
      timeSaved: "0s",
      timeSavedMinutes: 0,
    };
  }
}

/**
 * Main function to generate metrics image and post it to Twitter
 * Only posts if the 24-hour volume exceeds the threshold
 */
async function postMetricsIfSignificant() {
  try {
    logger.info("Starting metrics check...");

    logger.info("Generating metrics report...");
    const metrics = await generateSummaryMetrics();
    logger.info("Metrics data:", metrics);

    if (metrics.last24HoursVolume < VOLUME_THRESHOLD) {
      logger.info(
        `24-hour volume (${metrics.last24HoursVolume} USD) is below threshold (${VOLUME_THRESHOLD} USD). Skipping post.`
      );
      return;
    }

    logger.info(
      `24-hour volume (${metrics.last24HoursVolume} USD) exceeds threshold (${VOLUME_THRESHOLD} USD). Proceeding with post.`
    );

    logger.info("Generating metrics image...");
    const imagePath = await generateMetricsImage(metrics, null, "minimal");
    logger.info(`Metrics image generated at: ${imagePath}`);

    const tweetText = formatMetricsToTweet(metrics);

    logger.info("Posting to Twitter...");
    // const result = await twitterService.postTweet(tweetText, imagePath);
    // logger.info(`Tweet posted successfully with ID: ${result.id}`);
  } catch (error) {
    logger.error("Error in metrics posting:", error);
  }
}

/**
 * Fetches new successful orders since the last check and logs them
 */
async function fetchAndLogNewSuccessfulOrders() {
  try {
    const newOrdersQuery = `
      SELECT 
        mo.create_order_id,
        s1.amount as source_swap_amount,
        s2.amount as destination_swap_amount,
        co.source_chain,
        co.source_asset,
        co.destination_chain,
        co.destination_asset,
        (co.additional_data->>'input_token_price')::float as input_token_price,
        (co.additional_data->>'output_token_price')::float as output_token_price,
        mo.created_at AT TIME ZONE 'UTC' as created_at
      FROM matched_orders mo
      INNER JOIN create_orders co ON co.create_id = mo.create_order_id
      INNER JOIN swaps s1 ON s1.swap_id = mo.source_swap_id
      INNER JOIN swaps s2 ON s2.swap_id = mo.destination_swap_id
      WHERE s1.redeem_tx_hash != ''
        AND s2.redeem_tx_hash != ''
        AND co.create_id IS NOT NULL
        AND mo.created_at >= $1::timestamp
      ORDER BY mo.created_at DESC;
    `;

    const result = await db.query(newOrdersQuery, [startTimestamp]);

    if (result.rows.length === 0) {
      logger.info("No new successful orders found since last check");
      return;
    }

    // Filter out orders we've already processed
    const newOrders = result.rows.filter(
      (order) => !processedOrderIds.has(order.create_order_id)
    );

    if (newOrders.length === 0) {
      logger.info("No new unprocessed orders found");
      return;
    }

    logger.info(`Found ${newOrders.length} new successful orders`);

    for (const order of newOrders) {
      processedOrderIds.add(order.create_order_id);

      logger.info(`New Successful Order: ${JSON.stringify(order, null, 2)}`);

      const networkInfo = await getAssetInfo();

      let orderVolume = 0;
      try {
        const sourceAmount =
          Number(order.source_swap_amount) /
          Math.pow(
            10,
            getDecimals(
              {
                chain: order.source_chain,
                asset: order.source_asset,
              },
              networkInfo
            )
          );

        const destinationAmount =
          Number(order.destination_swap_amount) /
          Math.pow(
            10,
            getDecimals(
              {
                chain: order.destination_chain,
                asset: order.destination_asset,
              },
              networkInfo
            )
          );

        orderVolume =
          sourceAmount * order.input_token_price +
          destinationAmount * order.output_token_price;

        const { feeSaved, timeSaved, timeSavedMinutes } =
          await calculateFeesAndTimeSaved(
            sourceAmount,
            destinationAmount,
            order.source_chain,
            order.source_asset,
            order.destination_chain,
            order.destination_asset
          );

        logger.info(`Order volume: ${formatCurrency(orderVolume)}`);
        logger.info(
          `Time saved: ${timeSaved}, Fee saved: ${formatCurrency(feeSaved)}`
        );

        if (orderVolume >= ORDER_VOLUME_THRESHOLD) {
          logger.info(
            `Order volume (${formatCurrency(orderVolume)}) exceeds threshold (${formatCurrency(ORDER_VOLUME_THRESHOLD)}). Generating image and posting to Twitter.`
          );

          const orderWithVolume: SuccessfulOrder = {
            ...order,
            volume: orderVolume,
            timeSaved: timeSaved,
            timeSavedMinutes: timeSavedMinutes,
            feeSaved: feeSaved,
          };

          logger.info("Order with time and fee: ", orderWithVolume);

          const imagePath = await orderTemplate.generate(orderWithVolume);

          const tweetText = `New high-volume swap: ${formatCurrency(orderVolume)} from ${orderWithVolume.source_chain} to ${orderWithVolume.destination_chain}\nSaved: ${timeSaved} & ${formatCurrency(feeSaved)} compared to other services`;

          // const result = await twitterService.postTweet(tweetText, imagePath);
          // logger.info(`Tweet posted successfully with ID: ${result.id}`);
        } else {
          logger.info(
            `Order volume (${formatCurrency(orderVolume)}) is below threshold (${formatCurrency(ORDER_VOLUME_THRESHOLD)}). Skipping post.`
          );
        }
      } catch (error) {
        logger.error(`Error processing order volume: ${error}`);
      }

      let orders: SuccessfulOrder[] = [];

      if (fs.existsSync(ORDERS_LOG_PATH)) {
        try {
          const data = fs.readFileSync(ORDERS_LOG_PATH, "utf8");
          orders = JSON.parse(data);
        } catch (err) {
          logger.error(`Error reading orders log: ${err}`);
        }
      }

      orders.push(order);

      if (orders.length > 1000) {
        orders = orders.slice(-1000);
      }

      fs.writeFileSync(ORDERS_LOG_PATH, JSON.stringify(orders, null, 2));
    }
  } catch (error) {
    logger.error("Error fetching new successful orders:", error);
  }
}

/**
 * Schedule the metrics posting to run every 24 hours
 */
function scheduleDaily() {
  postMetricsIfSignificant();

  // Calculate milliseconds in 24 hours
  const oneDayMs = 24 * 60 * 60 * 1000;

  // Schedule to run every 24 hours
  setInterval(postMetricsIfSignificant, oneDayMs);

  logger.info(
    `Scheduled metrics posting to run every 24 hours with volume threshold of ${VOLUME_THRESHOLD} USD`
  );
}

/**
 * Schedule fetching successful orders every 10 seconds
 */
function scheduleOrderFetching() {
  // Run immediately
  fetchAndLogNewSuccessfulOrders();

  // Schedule to run every 10 seconds
  setInterval(fetchAndLogNewSuccessfulOrders, 10 * 1000);

  logger.info(
    `Scheduled new order fetching to run every 10 seconds (tracking orders since ${startTimestamp})`
  );
}

scheduleDaily();
scheduleOrderFetching();
