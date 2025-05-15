// @ts-nocheck
import { createCanvas, loadImage, registerFont } from "canvas";
import path from "path";
import fs from "fs";
import { ImageTemplate, TemplateOptions } from "./base";
import { formatCurrency, formatChainName } from "../utils/formatters";
import { logger } from "../utils/logger";
import { SuccessfulOrder } from "../types";

/**
 * Registers the Satoshi font for use in the canvas
 * This function checks if font files exist and registers them with the canvas library
 */
const registerSatoshiFont = (): void => {
  try {
    // Define font paths
    const fontPaths = {
      regular: path.join(__dirname, "../../assets/fonts/Satoshi-Regular.otf"),
      medium: path.join(__dirname, "../../assets/fonts/Satoshi-Medium.otf"),
      bold: path.join(__dirname, "../../assets/fonts/Satoshi-Bold.otf"),
      black: path.join(__dirname, "../../assets/fonts/Satoshi-Black.otf"),
    };

    // Check if directories exist, create if they don't
    const fontsDir = path.join(__dirname, "../../assets/fonts");
    if (!fs.existsSync(fontsDir)) {
      fs.mkdirSync(fontsDir, { recursive: true });
      logger.info(`Created fonts directory at ${fontsDir}`);
    }

    // Register each font weight if the file exists
    Object.entries(fontPaths).forEach(([weight, fontPath]) => {
      if (fs.existsSync(fontPath)) {
        registerFont(fontPath, {
          family: "Satoshi",
          weight: weight,
        });
        logger.info(`Registered Satoshi ${weight} font`);
      } else {
        logger.warn(`Satoshi ${weight} font file not found at ${fontPath}`);
      }
    });

    logger.info("Satoshi font registration completed");
  } catch (error) {
    logger.warn(
      `Failed to register Satoshi fonts: ${error.message}. Falling back to system fonts.`
    );
  }
};

/**
 * Garden Order template for displaying transaction metrics in a card format
 */
export class GardenOrderTemplate implements ImageTemplate {
  name = "garden_order";
  description =
    "Template for displaying transaction metrics in a garden card format";

  private options: TemplateOptions;
  private assetsDir = path.join(__dirname, "../../assets");
  private fontsDir = path.join(__dirname, "../../assets/fonts");

  constructor(options: TemplateOptions = {}) {
    this.options = {
      width: 1000,
      height: 1000,
      textColor: "#333333",
      ...options,
    };

    // Ensure assets directories exist
    this.ensureDirectoriesExist();

    // Register Satoshi font when the template is instantiated
    registerSatoshiFont();
  }

  /**
   * Ensures that necessary directories exist
   */
  private ensureDirectoriesExist(): void {
    const directories = [
      this.assetsDir,
      this.fontsDir,
      path.join(this.assetsDir, "backgrounds"),
      path.join(this.assetsDir, "icons"),
    ];

    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info(`Created directory: ${dir}`);
      }
    }
  }

  /**
   * Generates an image based on the provided order data
   * @param orderData - Successful order data to render
   * @returns Promise with the path to the generated image
   */
  async generate(orderData: SuccessfulOrder): Promise<string> {
    try {
      logger.info("Generating garden order image...");

      const { width, height, textColor } = this.options;
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext("2d");

      await this.drawBackground(ctx);
      this.renderTransactionValue(ctx, orderData.volume);
      this.renderAmounts(ctx);
      await this.renderChainIcons(ctx);
      this.renderTimeMetrics(ctx, orderData.timeSaved || "31m 54s");
      this.renderCostMetrics(ctx, orderData.feeSaved);

      return this.saveImage(canvas, orderData.create_order_id);
    } catch (error) {
      logger.error("Error generating garden order template:", error);
      throw error;
    }
  }

  /**
   * Draws the background image on the canvas
   */
  private async drawBackground(ctx: CanvasRenderingContext2D): Promise<void> {
    const backgroundPath = path.join(
      this.assetsDir,
      "backgrounds/actual_bg.png"
    );
    const backgroundImage = await loadImage(backgroundPath);
    ctx.drawImage(
      backgroundImage,
      0,
      0,
      this.options.width,
      this.options.height
    );
  }

  /**
   * Renders the transaction value in the top right
   */
  private renderTransactionValue(
    ctx: CanvasRenderingContext2D,
    volume: number
  ): void {
    ctx.fillStyle = "#554B6A";
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 0;
    ctx.font = "bold 28px Satoshi";
    ctx.textAlign = "right";
    ctx.fillText(`~$${volume.toFixed(2)}`, 910, 280);
    ctx.shadowOffsetX = 0;
  }

  /**
   * Renders source and destination amounts
   */
  private renderAmounts(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "#444466";
    ctx.textAlign = "left";

    // Use Satoshi font with fallback to system fonts
    try {
      ctx.font = "bold 68px Satoshi";
    } catch (error) {
      logger.warn("Error using Satoshi font, falling back to Arial");
      ctx.font = "bold 65px Arial, sans-serif";
    }

    // Source amount (left side)
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 0;
    ctx.fillText("5.1234", 90, 395);
    // Reset shadow after drawing
    ctx.shadowOffsetX = 0;

    // Destination amount (right side)
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 0;
    ctx.fillText("5.1234", 570, 395);
    ctx.shadowOffsetX = 0;
  }

  /**
   * Renders chain icons for source and destination
   */
  private async renderChainIcons(ctx: CanvasRenderingContext2D): Promise<void> {
    // Source chain icon (Bitcoin in this example)
    const sourceIconPath = path.join(this.assetsDir, "icons/bitcoin.png");
    const sourceIcon = await loadImage(sourceIconPath);
    ctx.drawImage(sourceIcon, 320, 340, 62, 62);
    // Destination source
    ctx.drawImage(sourceIcon, 795, 340, 62, 62);

    const destinationIconPath = path.join(this.assetsDir, "icons/starknet.png");
    const destiantionIcon = await loadImage(destinationIconPath);
    ctx.drawImage(destiantionIcon, 850, 340, 62, 62);
  }

  /**
   * Renders time metrics on the bottom left card
   */
  private renderTimeMetrics(
    ctx: CanvasRenderingContext2D,
    timeSaved: string
  ): void {
    // Time saved
    ctx.fillStyle = "#5FC29F";
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 0;
    ctx.font = "bold 60px Satoshi";
    ctx.textAlign = "left";
    ctx.fillText(timeSaved, 90, 670);
    ctx.shadowOffsetX = 0;

    // Actual time
    ctx.fillStyle = "#444466";
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 0;
    ctx.font = "bold 28px Satoshi";
    ctx.textAlign = "right";
    ctx.fillText("10m 24s", 445, 560);
    ctx.shadowOffsetX = 0;
  }

  /**
   * Renders cost metrics on the bottom right card
   */
  private renderCostMetrics(
    ctx: CanvasRenderingContext2D,
    feeSaved: number
  ): void {
    // Cost saved
    ctx.fillStyle = "#5FC29F";
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 0;
    ctx.font = "bold 60px Satoshi";
    ctx.textAlign = "left";
    ctx.fillText(`$${feeSaved.toLocaleString()}`, 550, 670);
    ctx.shadowOffsetX = 0;

    // Actual cost
    ctx.fillStyle = "#444466";
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 0;
    ctx.font = "bold 28px Satoshi";
    ctx.textAlign = "right";
    ctx.fillText("$120.42", 910, 560);
    ctx.shadowOffsetX = 1;
  }

  /**
   * Saves the rendered image to disk
   */
  private saveImage(canvas: any, orderId: string): string {
    const outputPath = path.join(
      this.assetsDir,
      `garden_order_${orderId.substring(0, 8)}.png`
    );

    const buffer = canvas.toBuffer("image/png");
    fs.writeFileSync(outputPath, buffer);

    logger.info(`Garden order image generated: ${outputPath}`);
    return outputPath;
  }
}

export default new GardenOrderTemplate();
