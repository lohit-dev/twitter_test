// @ts-nocheck
import { createCanvas, loadImage } from "canvas";
import path from "path";
import fs from "fs";
import { SwapMetrics } from "../types";
import { ImageTemplate, TemplateOptions } from "./base";
import { formatCurrency, formatPercentage } from "../utils/formatters";
import { logger } from "../utils/logger";

// Minimal template with just key metrics and a clean design
export class MinimalTemplate implements ImageTemplate {
  name = "minimal";
  description = "Minimal template with clean design and key metrics only";

  private options: TemplateOptions;

  constructor(options: TemplateOptions = {}) {
    this.options = {
      width: 1080,
      height: 1080,
      backgroundColor: "#f5f5f5",
      textColor: "#333333",
      ...options,
    };
  }

  async generate(metrics: SwapMetrics): Promise<string> {
    try {
      logger.info("Generating metrics image with minimal template...");

      const { width, height, backgroundColor, textColor } = this.options;
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext("2d");

      // Fill background
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);

      // Draw border
      ctx.strokeStyle = "#dddddd";
      ctx.lineWidth = 10;
      ctx.strokeRect(40, 40, width - 80, height - 80);

      // Draw header
      ctx.fillStyle = textColor;
      ctx.font = "bold 72px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("METRICS", width / 2, 200);

      // Draw key metrics in a clean, minimal style
      const metricsY = 350;
      const metricsSpacing = 120;

      ctx.font = "bold 48px Arial, sans-serif";
      ctx.fillText(
        `${formatCurrency(metrics.allTimeVolume)}`,
        width / 2,
        metricsY
      );
      ctx.font = "32px Arial, sans-serif";
      ctx.fillText("TOTAL VOLUME", width / 2, metricsY + 50);

      ctx.font = "bold 48px Arial, sans-serif";
      ctx.fillText(
        `${metrics.last24HoursSwaps}`,
        width / 2,
        metricsY + metricsSpacing
      );
      ctx.font = "32px Arial, sans-serif";
      ctx.fillText("24H ORDERS", width / 2, metricsY + metricsSpacing + 50);

      ctx.font = "bold 48px Arial, sans-serif";
      ctx.fillText(
        `${formatPercentage(metrics.completionRate)}`,
        width / 2,
        metricsY + metricsSpacing * 2
      );
      ctx.font = "32px Arial, sans-serif";
      ctx.fillText(
        "SUCCESS RATE",
        width / 2,
        metricsY + metricsSpacing * 2 + 50
      );

      // Draw website
      ctx.font = "bold 36px Arial, sans-serif";
      ctx.fillText("https://garden.finance", width / 2, height - 100);

      // Save the image
      const ASSETS_DIR = path.join(__dirname, "../../assets");
      const outputPath = path.join(ASSETS_DIR, `metrics_${this.name}.png`);
      const buffer = canvas.toBuffer("image/png");
      fs.writeFileSync(outputPath, buffer);

      logger.info(
        `Metrics image with ${this.name} template generated: ${outputPath}`
      );
      return outputPath;
    } catch (error) {
      logger.error(`Error generating ${this.name} template:`, error);
      throw error;
    }
  }
}

export default new MinimalTemplate();
