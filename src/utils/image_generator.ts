import { SwapMetrics } from "../types";
import { generateImage } from "../templates";
import { logger } from "./logger";

export type TemplateName = "minimal" | "standard";

/**
 * Generates a metrics image based on the provided swap metrics and template
 * @param metrics The metrics data to display in the image
 * @param templateName The name of the template to use (default: "standard")
 * @returns Path to the generated image
 */
export async function generateMetricsImage(
  metrics: SwapMetrics,
  templateName: TemplateName = "minimal"
): Promise<string> {
  try {
    logger.info(`Generating metrics image with ${templateName} template...`);
    return await generateImage(templateName, metrics);
  } catch (error) {
    logger.error("Error generating metrics image:", error);
    throw error;
  }
}
