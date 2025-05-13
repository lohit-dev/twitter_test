import { twitterService } from "./services/twitter";
import { generateSummaryMetrics, processNewOrders } from "./services/metrics";
import { generateMetricsImage } from "./utils/image_generator";
import { logger } from "./utils/logger";
import { formatMetricsToTweet } from "./utils/formatters";

// Volume threshold in USD
// - only post if 24h volume exceeds this amount
const VOLUME_THRESHOLD = 1000;
const ORDER_VOLUME_THRESHOLD = 100;

// Timestamp to track orders after this time
const startTimestamp = new Date().toISOString();

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

    // Check if volume exceeds threshold
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
    const imagePath = await generateMetricsImage(metrics, "minimal");
    logger.info(`Metrics image generated at: ${imagePath}`);

    // Create a tweet with the metrics data
    const tweetText = formatMetricsToTweet(metrics);

    logger.info("Posting to Twitter...");
    const result = await twitterService.postTweet(tweetText, imagePath);
    logger.info(`Tweet posted successfully with ID: ${result.id}`);
  } catch (error) {
    logger.error("Error in metrics posting:", error);
  }
}

/**
 * Check for new orders and process them
 */
async function checkAndProcessNewOrders() {
  try {
    logger.info("Checking for new orders...");
    await processNewOrders(ORDER_VOLUME_THRESHOLD);
  } catch (error) {
    logger.error("Error checking for new orders:", error);
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
  checkAndProcessNewOrders();

  // Schedule to run every 10 seconds
  setInterval(checkAndProcessNewOrders, 10 * 1000);

  logger.info(`Scheduled new order fetching to run every 10 seconds`);
}

// Start the schedulers
scheduleDaily();
scheduleOrderFetching();
