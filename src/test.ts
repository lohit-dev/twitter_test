// src/test.ts
import { generateMetricsReport } from "./services/metrics";
import { generateMetricsImage } from "./utils/image_generator";
import { logger } from "./utils/logger";

async function testImageGeneration() {
  try {
    logger.info("Starting test image generation...");

    // Generate metrics report
    const metrics = await generateMetricsReport();
    logger.info("Metrics report generated successfully");

    // Generate and save the image
    const imagePath = await generateMetricsImage(metrics);
    logger.info(`Image generated successfully and saved to: ${imagePath}`);

    // Print metrics data for reference
    logger.info("Metrics data used in the image:");
    logger.info(JSON.stringify(metrics, null, 2));
  } catch (error) {
    logger.error("Error in test image generation:", error);
  }
}

// Run the test
testImageGeneration();
