import { twitterService } from "./services/twitter";
import { generateMetricsReport } from "./services/metrics";
import { generateMetricsImage } from "./utils/image_generator";
import { logger } from "./utils/logger";

/**
 * Test function to generate metrics image and post it to Twitter
 */
async function testTwitterImagePosting() {
  try {
    logger.info("Starting Twitter image posting test...");

    logger.info("Generating metrics report...");
    const metrics = await generateMetricsReport();
    logger.info("Metrics report generated successfully");

    logger.info("Generating metrics image...");
    const imagePath = await generateMetricsImage(metrics);
    logger.info(`Metrics image generated at: ${imagePath}`);

    // Create a tweet with the metrics data
    const tweetText = `hello`;

    logger.info("Using twitterService.postTweet to post image and text");

    const result = await twitterService.postTweet(tweetText, imagePath);
    logger.info(`Tweet posted successfully with ID: ${result.id}`);
  } catch (error) {
    logger.error("Error in Twitter image posting test:", error);
  }
}

testTwitterImagePosting();
