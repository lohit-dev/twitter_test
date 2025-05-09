import { createCanvas, loadImage } from "canvas";
import path from "path";
import fs from "fs";
import { SwapMetrics } from "../types";
import {
  formatNumber,
  formatCurrency,
  formatPercentage,
  formatChainName,
} from "./formatters";
import { logger } from "./logger";

// Constants for image generation
const WIDTH = 1080;
const HEIGHT = 1080;
const TEXT_COLOR = "#414770";

// Asset paths
const ASSETS_DIR = path.join(__dirname, "../../assets");
const ICONS_DIR = path.join(ASSETS_DIR, "icons");
const BACKGROUNDS_DIR = path.join(ASSETS_DIR, "backgrounds");

/**
 * Generates a metrics image based on the provided swap metrics
 * @param metrics The metrics data to display in the image
 * @returns Path to the generated image
 */
export async function generateMetricsImage(
  metrics: SwapMetrics,
): Promise<string> {
  try {
    logger.info("Generating metrics image with background and icons...");

    // Create canvas
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");

    // 1. Load and draw the background image
    try {
      const backgroundPath = path.join(BACKGROUNDS_DIR, "bg.png");

      if (fs.existsSync(backgroundPath)) {
        const backgroundImage = await loadImage(backgroundPath);
        // Draw the background image to fill the entire canvas
        ctx.drawImage(backgroundImage, 0, 0, WIDTH, HEIGHT);
        logger.info("Background image loaded successfully");
      } else {
        // Fallback to solid color if image not found
        logger.warn(
          `Background image not found at ${backgroundPath}, using solid color`,
        );
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
      }
    } catch (error) {
      logger.warn("Error loading background image:", error);
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    // Draw header
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "bold 64px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SWAP SUMMARY", WIDTH / 2, 180);

    // Draw main metrics
    ctx.font = "bold 48px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      `Volume: ${formatCurrency(metrics.allTimeVolume)}`,
      WIDTH / 2,
      300,
    );

    // 2. Draw Bitcoin icon (PNG)
    const btcX = 360;
    const btcY = 460;
    const iconSize = 120;

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
        logger.info("Bitcoin PNG icon loaded successfully");
      } else {
        logger.warn(`Bitcoin icon not found at ${btcIconPath}`);
      }
    } catch (error) {
      logger.warn("Error loading Bitcoin icon:", error);
    }

    // 3. Draw Starknet icon (PNG)
    const starkX = 740;
    const starkY = 460;

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
        logger.info("Starknet PNG icon loaded successfully");
      } else {
        logger.warn(`Starknet icon not found at ${starknetIconPath}`);
      }
    } catch (error) {
      logger.warn("Error loading Starknet icon:", error);
    }

    // Draw an arrow between the icons
    const arrowStartX = btcX + iconSize / 2;
    const arrowEndX = starkX - iconSize / 2;

    ctx.beginPath();
    ctx.moveTo(arrowStartX, btcY);
    ctx.lineTo(arrowEndX, starkY);
    ctx.strokeStyle = TEXT_COLOR;
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
    ctx.fillStyle = TEXT_COLOR;
    ctx.fill();

    // Draw additional metrics
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "bold 42px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`24h Orders: ${metrics.last24HoursSwaps}`, WIDTH / 2, 600);
    ctx.fillText(
      `Success Rate: ${formatPercentage(metrics.completionRate)}`,
      WIDTH / 2,
      660,
    );

    // Draw website
    ctx.font = "bold 42px Arial, sans-serif";
    ctx.fillText("https://garden.finance", WIDTH / 2, HEIGHT - 100);

    // Ensure the assets directory exists
    if (!fs.existsSync(ASSETS_DIR)) {
      fs.mkdirSync(ASSETS_DIR, { recursive: true });
    }

    // Save the image
    const outputPath = path.join(ASSETS_DIR, "metrics_with_icons.png");
    const buffer = canvas.toBuffer("image/png");
    fs.writeFileSync(outputPath, buffer);

    logger.info(
      `Metrics image with icons generated and saved to ${outputPath}`,
    );
    return outputPath;
  } catch (error) {
    logger.error("Error generating metrics image:", error);
    throw error;
  }
}
