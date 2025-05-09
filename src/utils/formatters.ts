import { HighValueOrder, SwapMetrics } from "../types";
import { logger } from "./logger";
// ======================================================================
// MAIN FORMATTING FUNCTIONS
// ======================================================================

/**
 * Formats swap metrics data into a well-structured tweet
 * that fits within Twitter's character limit
 */
export function formatMetricsToTweet(metrics: SwapMetrics): string {
  const date = new Date().toISOString().split("T")[0];

  const tweet = [
    `📊 SWAP SUMMARY (${date})`,
    "",
    `📈 Orders: ${formatNumber(
      metrics.last24HoursSwaps
    )} in 24h (${formatNumber(metrics.allOrders)} total)`,
    `💰 Volume: ${formatCurrency(metrics.last24HoursVolume)} (${formatCurrency(
      metrics.allTimeVolume
    )} total)`,
    `🎯 Success rate: ${formatPercentage(metrics.completionRate)}`,
    `🔝 Chain: ${formatChainName(metrics.topChain.name)} (${formatNumber(
      metrics.topChain.count
    )})`,
    `Visit us at 👇`,
    "",
    `🌐 #DeFi #CrossChain #Crypto #Garden`,
    `✨ https://garden.finance`,
  ].join("\n");

  // Log the character count for debugging
  logger.info(`Tweet character count: ${tweet.length}`);

  return tweet;
}

/**
 * Creates a full detailed metrics report
 */
export function formatDetailedMetrics(metrics: SwapMetrics): string {
  const date = new Date().toISOString().split("T")[0];

  // Build the main summary section
  const summary = [
    `📊 SWAP METRICS REPORT (${date}) 📊`,
    "",
    "📈 ORDER STATISTICS",
    `   • Total Orders: ${formatNumber(metrics.allOrders)}`,
    `   • Total Successful: ${formatNumber(metrics.totalSwaps)}`,
    `   • Last 24h Orders: ${formatNumber(metrics.last24HoursSwaps)}`,
    `   • Completion Rate: ${formatPercentage(metrics.completionRate)}`,
    "",
    "💰 VOLUME INFORMATION",
    `   💫 ${formatNumber(metrics.last24HoursSwaps)} orders processed`,
    `   💰 Volume: ${formatCurrency(metrics.last24HoursVolume)}`,
    `   🎯 Success Rate: ${formatPercentage(metrics.completionRate)}`,
    "",
    "🔝 TOP PERFORMERS",
    `   • Most Used Chain: ${formatChainName(
      metrics.topChain.name
    )} (${formatNumber(metrics.topChain.count)} orders)`,
    `   • Top Asset Pair: ${metrics.topAssetPair.pair} (${formatNumber(
      metrics.topAssetPair.count
    )} orders)`,
    "",
    "🌐 #DeFi #CrossChain #Crypto #Blockchain #Garden",
  ].join("\n");

  return summary;
}

/**
 * Formats high-value orders into a tweet-friendly format
 * Focuses on a single high-value order with detailed information
 */
export function formatHighVolumeOrders(orders: HighValueOrder[]): string {
  if (!orders || orders.length === 0) {
    return "No high-value orders to display";
  }

  // Just take the first (highest value) order
  const order = orders[0];

  const destAmount =
    Number(order.destination_amount) /
    Math.pow(
      10,
      order.destination_chain === "bitcoin_testnet" &&
        order.destination_asset === "primary"
        ? 8
        : 18
    );

  const delta = order.usd_value - destAmount * (order.output_token_price || 1);
  const deltaPercent = (delta / order.usd_value) * 100;

  // Determine if delta is positive or negative for emoji
  const deltaEmoji = delta < 0 ? "🔴" : "🟢";

  // Create a compact tweet with more detailed information about a single order
  const result = [
    `🐳 WHALE ALERT!`,
    `💰 ${formatCurrency(order.usd_value)}`,
    `🔄 ${formatChainName(order.source_chain)} → ${formatChainName(
      order.destination_chain
    )}`,
    `⏱️ Took: ${calculateTimeDifference(order.created_at)}`,
    `${deltaEmoji} Delta: ${formatCurrency(Math.abs(delta))} (${Math.abs(
      deltaPercent
    ).toFixed(2)}%)`,
    `🏦 via Garden Bridge`,
    `#DeFi #CrossChain #Crypto #Garden`,
    `✨ https://garden.finance/orders/${order.create_id}`,
  ].join("\n");

  // Log the character count for debugging
  logger.info(`High volume order tweet character count: ${result.length}`);

  return result;
}

// ======================================================================
// NUMBER AND CURRENCY FORMATTERS
// ======================================================================

/**
 * Formats a number with thousands separators
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US").format(num);
}

/**
 * Formats a number as currency with appropriate suffix (B, M, K)
 * based on the magnitude of the value
 */
export function formatCurrency(num: number): string {
  const value = Math.abs(num);

  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  } else if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  } else if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Formats a decimal as a percentage with 1 decimal place
 */
export function formatPercentage(num: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(num);
}

// ======================================================================
// BLOCKCHAIN AND TIME FORMATTERS
// ======================================================================

/**
 * Converts chain identifier to a user-friendly display name
 */
function formatChainName(chain: string): string {
  const chainMap: { [key: string]: string } = {
    arbitrum_sepolia: "Arbitrum",
    starknet_sepolia: "StarkNet",
    bitcoin_testnet: "Bitcoin",
    ethereum: "Ethereum",
    polygon: "Polygon",
    optimism: "Optimism",
    base: "Base",
  };

  return chainMap[chain.toLowerCase()] || chain;
}

/**
 * Calculates and formats the time difference between now and a given timestamp
 */
function calculateTimeDifference(createdAt: string): string {
  const created = new Date(createdAt);
  const now = new Date();
  const diffInHours = Math.abs(now.getTime() - created.getTime()) / 36e5;

  if (diffInHours < 1) {
    const minutes = Math.floor(diffInHours * 60);
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  } else {
    const hours = Math.floor(diffInHours);
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
}
