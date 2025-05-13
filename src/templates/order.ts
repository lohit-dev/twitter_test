// @ts-nocheck
import { createCanvas, loadImage } from "canvas";
import path from "path";
import fs from "fs";
import { ImageTemplate, TemplateOptions } from "./base";
import { formatCurrency } from "../utils/formatters";
import { logger } from "../utils/logger";

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

  async generate(orderData): Promise<string> {
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
      ctx.fillText("NEW SWAP", width / 2, 200);

      // Calculate order volume in USD
      let sourceVolume = 0;
      if (orderData.input_token_price && orderData.source_swap_amount) {
        // Assuming source_swap_amount is in the smallest unit (e.g., wei, satoshi)
        // For simplicity, using a fixed decimal of 18 here
        const decimals = 18;
        const sourceAmount =
          Number(orderData.source_swap_amount) / Math.pow(10, decimals);
        sourceVolume = sourceAmount * orderData.input_token_price;
      }

      // Draw order details
      const detailsY = 350;
      const detailsSpacing = 120;

      // Volume
      ctx.font = "bold 48px Arial, sans-serif";
      ctx.fillText(`${formatCurrency(sourceVolume)}`, width / 2, detailsY);
      ctx.font = "32px Arial, sans-serif";
      ctx.fillText("VOLUME", width / 2, detailsY + 50);

      // From chain/asset
      ctx.font = "bold 36px Arial, sans-serif";
      ctx.fillText(
        `FROM: ${orderData.source_chain}`,
        width / 2,
        detailsY + detailsSpacing
      );
      ctx.font = "28px Arial, sans-serif";
      ctx.fillText(
        `${orderData.source_asset.substring(0, 20)}...`,
        width / 2,
        detailsY + detailsSpacing + 50
      );

      // To chain/asset
      ctx.font = "bold 36px Arial, sans-serif";
      ctx.fillText(
        `TO: ${orderData.destination_chain}`,
        width / 2,
        detailsY + detailsSpacing * 2
      );
      ctx.font = "28px Arial, sans-serif";
      ctx.fillText(
        `${orderData.destination_asset.substring(0, 20)}...`,
        width / 2,
        detailsY + detailsSpacing * 2 + 50
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
