import { logger } from "../utils/logger";
import { formatCurrency } from "../utils/formatters";
import gardenOrderTemplate from "../templates/garden_order";
import { SuccessfulOrder } from "../types";

/**
 * Test function to generate a garden order image using the GardenOrderTemplate
 */
async function testGardenOrderTemplate() {
  try {
    logger.info("Starting Garden Order Template test...");

    // Create a mock order with all required fields
    const mockOrder: SuccessfulOrder = {
      create_order_id: "test123456789abcdef0123456789abcdef",
      source_chain: "starknet_sepolia",
      source_asset:
        "0x58ea74e863bc9a761aa20701e04b65854f5614db3eb79b2d3a76a8771694c02",
      destination_chain: "arbitrum_sepolia",
      destination_asset: "0x795Dcb58d1cd4789169D5F938Ea05E17ecEB68cA",
      source_swap_amount: "50000000000000000", // 0.05 ETH in wei
      destination_swap_amount: "119560", // In smallest unit
      input_token_price: 2500, // $2500 per ETH
      output_token_price: 103000, // $103,000 per BTC
      created_at: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      volume: 524500.0, // $524,500 volume
      feeSaved: 1234.31, // Hardcoded fee saved
      timeSaved: "31m 54s", // Hardcoded time saved
    };

    logger.info("Mock order created:", mockOrder);
    logger.info(`Order volume: ${formatCurrency(mockOrder.volume)}`);

    // Generate image using the garden order template
    logger.info("Generating garden order image...");
    const imagePath = await gardenOrderTemplate.generate(mockOrder);
    logger.info(`Garden order image generated at: ${imagePath}`);

    logger.info("Garden order template test completed successfully");
    return imagePath;
  } catch (error) {
    logger.error("Error in garden order template test:", error);
    throw error;
  }
}

/**
 * Run the test
 */
async function main() {
  try {
    const imagePath = await testGardenOrderTemplate();
    logger.info(`Test completed. Image saved at: ${imagePath}`);

    // Display the path to the image in a more visible way
    console.log("\n==================================================");
    console.log(`GARDEN ORDER IMAGE GENERATED AT: ${imagePath}`);
    console.log("==================================================\n");
  } catch (error) {
    logger.error("Test failed:", error);
  }
}

// Run the test
main();
