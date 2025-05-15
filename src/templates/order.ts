// @ts-nocheck
import { createCanvas, loadImage } from "canvas";
import path from "path";
import fs from "fs";
import { ImageTemplate, TemplateOptions } from "./base";
import { formatCurrency, formatChainName } from "../utils/formatters";
import { logger } from "../utils/logger";
import { SuccessfulOrder } from "../types";

// Order template for displaying individual successful orders
export class OrderTemplate implements ImageTemplate {
  name = "order";
  description = "Template for displaying individual successful orders";

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

  async generate(orderData: SuccessfulOrder): Promise<string> {
    try {
      logger.info("Generating order image...");

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
      ctx.fillText("HIGH VOLUME SWAP", width / 2, 200);

      // Draw order details
      const detailsY = 350;
      const detailsSpacing = 120;

      // Volume
      ctx.font = "bold 64px Arial, sans-serif";
      ctx.fillText(`${formatCurrency(orderData.volume)}`, width / 2, detailsY);
      ctx.font = "32px Arial, sans-serif";
      ctx.fillText("VOLUME", width / 2, detailsY + 50);

      // Fee and Time Saved (new section)
      if (
        orderData.feeSaved !== undefined &&
        orderData.timeSaved !== undefined
      ) {
        ctx.font = "bold 36px Arial, sans-serif";
        ctx.fillText(
          `SAVED: ${formatCurrency(orderData.feeSaved)} & ${orderData.timeSaved}`,
          width / 2,
          detailsY + detailsSpacing * 0.6
        );
      }

      // From chain/asset
      ctx.font = "bold 36px Arial, sans-serif";
      ctx.fillText(
        `FROM: ${formatChainName(orderData.source_chain)}`,
        width / 2,
        detailsY + detailsSpacing
      );

      // Handle long asset addresses by truncating
      const sourceAssetDisplay =
        orderData.source_asset.length > 20
          ? `${orderData.source_asset.substring(0, 10)}...${orderData.source_asset.substring(orderData.source_asset.length - 10)}`
          : orderData.source_asset;

      ctx.font = "28px Arial, sans-serif";
      ctx.fillText(
        sourceAssetDisplay,
        width / 2,
        detailsY + detailsSpacing + 50
      );

      // To chain/asset
      ctx.font = "bold 36px Arial, sans-serif";
      ctx.fillText(
        `TO: ${formatChainName(orderData.destination_chain)}`,
        width / 2,
        detailsY + detailsSpacing * 2
      );

      // Handle long asset addresses by truncating
      const destAssetDisplay =
        orderData.destination_asset.length > 20
          ? `${orderData.destination_asset.substring(0, 10)}...${orderData.destination_asset.substring(orderData.destination_asset.length - 10)}`
          : orderData.destination_asset;

      ctx.font = "28px Arial, sans-serif";
      ctx.fillText(
        destAssetDisplay,
        width / 2,
        detailsY + detailsSpacing * 2 + 50
      );

      // Draw timestamp
      const timestamp = new Date(orderData.created_at).toLocaleString();
      ctx.font = "24px Arial, sans-serif";
      ctx.fillText(
        `Completed: ${timestamp}`,
        width / 2,
        detailsY + detailsSpacing * 3 + 20
      );

      // Draw website
      ctx.font = "bold 36px Arial, sans-serif";
      ctx.fillText("https://garden.finance", width / 2, height - 100);

      // Save the image
      const ASSETS_DIR = path.join(__dirname, "../../assets");
      if (!fs.existsSync(ASSETS_DIR)) {
        fs.mkdirSync(ASSETS_DIR, { recursive: true });
      }
      const outputPath = path.join(
        ASSETS_DIR,
        `order_${orderData.create_order_id.substring(0, 8)}.png`
      );
      const buffer = canvas.toBuffer("image/png");
      fs.writeFileSync(outputPath, buffer);

      logger.info(`Order image generated: ${outputPath}`);
      return outputPath;
    } catch (error) {
      logger.error("Error generating order template:", error);
      throw error;
    }
  }
}

export default new OrderTemplate();
