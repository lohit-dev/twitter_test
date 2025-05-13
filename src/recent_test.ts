const { queries } = require("./database/queries");
const fs = require("fs");
const path = require("path");
const { db } = require("./database/connection");
const { config } = require("dotenv");

// Load environment variables
config();

async function extractRecentOrders() {
  try {
    console.log("Connecting to database to extract recent orders...");

    const result = await db.query(queries.yesterDayVolumeQuery);
    const orders = result.rows;

    console.log(
      `Found ${orders.length} successful orders in the last 24 hours`
    );

    // Save to file
    const filePath = path.join(
      __dirname,
      "..",
      "recent_successful_orders.json"
    );
    fs.writeFileSync(filePath, JSON.stringify(orders, null, 2));

    console.log(`Successfully saved orders to ${filePath}`);
    console.log(
      `First few orders: ${JSON.stringify(orders.slice(0, 2), null, 2)}`
    );

    return orders;
  } catch (error) {
    console.error(`Error extracting recent orders:`, error);
    throw error;
  }
}

// Run the extraction
extractRecentOrders()
  .then(() => {
    console.log("Order extraction completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error(`Failed to extract orders:`, error);
    process.exit(1);
  });
