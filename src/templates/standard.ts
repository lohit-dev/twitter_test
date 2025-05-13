// @ts-nocheck
import { createCanvas, loadImage } from "canvas";
import path from "path";
import fs from "fs";
import { SwapMetrics } from "../types";
import { ImageTemplate, TemplateOptions } from "./base";
import { formatCurrency, formatPercentage } from "../utils/formatters";
import { logger } from "../utils/logger";

// Standard template with icons, background, and detailed metrics
export class StandardTemplate implements ImageTemplate {
  name = "standard";
  description =
    "Standard template with icons, background, and detailed metrics";

  private options: TemplateOptions;

  constructor(options: TemplateOptions = {}) {
    this.options = {
      width: 1080,
      height: 1080,
      textColor: "#414770",
      ...options,
    };
  }

  async generate(metrics: SwapMetrics): Promise<string> {
    try {
      logger.info("Generating metrics image with standard template...");

      const { width, height, textColor } = this.options;
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext("2d");

      // Load background
      const ASSETS_DIR = path.join(__dirname, "../../assets");
      const BACKGROUNDS_DIR = path.join(ASSETS_DIR, "backgrounds");
      const ICONS_DIR = path.join(ASSETS_DIR, "icons");

      try {
        const backgroundPath = path.join(BACKGROUNDS_DIR, "bg.png");
        if (fs.existsSync(backgroundPath)) {
          const backgroundImage = await loadImage(backgroundPath);
          ctx.drawImage(backgroundImage, 0, 0, width, height);
        } else {
          ctx.fillRect(0, 0, width, height);
        }
      } catch (error) {
        ctx.fillRect(0, 0, width, height);
      }

      // Draw header
      ctx.fillStyle = textColor;
      ctx.font = "bold 64px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("SWAP SUMMARY", width / 2, 180);

      // Draw metrics
      ctx.font = "bold 48px Arial, sans-serif";
      ctx.fillText(
        `Volume: ${formatCurrency(metrics.allTimeVolume)}`,
        width / 2,
        300,
      );

      // Draw icons and arrow
      const btcX = 360;
      const btcY = 460;
      const starkX = 740;
      const starkY = 460;
      const iconSize = 120;

      // Draw Bitcoin icon
      try {
        const btcIconPath = path.join(ICONS_DIR, "bitcoin.png");
        if (fs.existsSync(btcIconPath)) {
          const btcIcon = await loadImage(btcIconPath);
          ctx.drawImage(
            btcIcon,
            btcX - iconSize / 2,
            btcY - iconSize / 2,
            iconSize,
            iconSize,
          );
        }
      } catch (error) {
        logger.warn("Error loading Bitcoin icon:", error);
      }

      // Draw Starknet icon
      try {
        const starknetIconPath = path.join(ICONS_DIR, "starknet.png");
        if (fs.existsSync(starknetIconPath)) {
          const starknetIcon = await loadImage(starknetIconPath);
          ctx.drawImage(
            starknetIcon,
            starkX - iconSize / 2,
            starkY - iconSize / 2,
            iconSize,
            iconSize,
          );
        }
      } catch (error) {
        logger.warn("Error loading Starknet icon:", error);
      }

      // Draw arrow between icons
      const arrowStartX = btcX + iconSize / 2;
      const arrowEndX = starkX - iconSize / 2;

      ctx.beginPath();
      ctx.moveTo(arrowStartX, btcY);
      ctx.lineTo(arrowEndX, starkY);
      ctx.strokeStyle = textColor;
      ctx.lineWidth = 5;
      ctx.stroke();

      // Draw arrowhead
      const arrowHeadSize = 15;
      const angle = Math.atan2(starkY - btcY, arrowEndX - arrowStartX);

      ctx.beginPath();
      ctx.moveTo(arrowEndX, starkY);
      ctx.lineTo(
        arrowEndX - arrowHeadSize * Math.cos(angle - Math.PI / 6),
        starkY - arrowHeadSize * Math.sin(angle - Math.PI / 6),
      );
      ctx.lineTo(
        arrowEndX - arrowHeadSize * Math.cos(angle + Math.PI / 6),
        starkY - arrowHeadSize * Math.sin(angle + Math.PI / 6),
      );
      ctx.closePath();
      ctx.fillStyle = textColor;
      ctx.fill();

      // Draw additional metrics
      ctx.font = "bold 42px Arial, sans-serif";
      ctx.fillText(`24h Orders: ${metrics.last24HoursSwaps}`, width / 2, 600);
      ctx.fillText(
        `Success Rate: ${formatPercentage(metrics.completionRate)}`,
        width / 2,
        660,
      );

      // Draw website
      ctx.font = "bold 42px Arial, sans-serif";
      ctx.fillText("https://garden.finance", width / 2, height - 100);

      // Save the image
      const outputPath = path.join(ASSETS_DIR, `metrics_${this.name}.png`);
      const buffer = canvas.toBuffer("image/png");
      fs.writeFileSync(outputPath, buffer);

      logger.info(
        `Metrics image with ${this.name} template generated: ${outputPath}`,
      );
      return outputPath;
    } catch (error) {
      logger.error(`Error generating ${this.name} template:`, error);
      throw error;
    }
  }
}

export default new StandardTemplate();
