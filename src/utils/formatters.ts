import { HighValueOrder, SwapMetrics } from "../types";

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

// ======================================================================
// TWEET FORMATTING
// ======================================================================

/**
 * Formats swap metrics data into a well-structured tweet
 */
export function formatMetricsToTweet(metrics: SwapMetrics): string {
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
  ];

  // Format high-value orders section if any exist
  const highValueSwaps: string[] = [];

  if (metrics.highValueOrders && metrics.highValueOrders.length > 0) {
    highValueSwaps.push("", "🐳 HIGH VALUE SWAPS");

    metrics.highValueOrders.forEach((order: HighValueOrder, index: number) => {
      // Calculate normalized amounts based on chain and asset
      const sourceAmount =
        Number(order.source_amount) /
        Math.pow(
          10,
          order.source_chain === "bitcoin_testnet" &&
            order.source_asset === "primary"
            ? 8
            : 18
        );

      const destAmount =
        Number(order.destination_amount) /
        Math.pow(
          10,
          order.destination_chain === "bitcoin_testnet" &&
            order.destination_asset === "primary"
            ? 8
            : 18
        );

      const delta =
        order.usd_value - destAmount * (order.output_token_price || 1);
      const deltaPercent = (delta / order.usd_value) * 100;

      // Format amounts to avoid showing 0 or very small decimals
      const formattedSourceAmount =
        sourceAmount < 0.01
          ? sourceAmount.toFixed(5)
          : formatNumber(sourceAmount);

      const formattedDestAmount =
        destAmount < 0.01
          ? destAmount === 0
            ? "< 0.00001"
            : destAmount.toFixed(5)
          : formatNumber(destAmount);

      const destValue = destAmount * (order.output_token_price || 1);
      const formattedDestValue =
        destValue < 0.01
          ? destValue === 0
            ? "$0.00001"
            : formatCurrency(destValue)
          : formatCurrency(destValue);

      highValueSwaps.push(
        "",
        `🔄 Order #${index + 1}`,
        `🔗 https://stage-explorer.hashira.io/orders/${order.create_id}`,
        `📥 ${formattedSourceAmount} on ${formatChainName(
          order.source_chain
        )} (${formatCurrency(order.usd_value)})`,
        `📤 ${formattedDestAmount} on ${formatChainName(
          order.destination_chain
        )} (${formattedDestValue})`,
        `⏱️ Took: ${calculateTimeDifference(order.created_at)}`,
        `⚪️ Delta: ${formatCurrency(delta)} (${deltaPercent.toFixed(2)}%)`,
        `🏦 via Garden Bridge`
      );
    });
  }

  // Add hashtags at the end
  const hashtags = ["", "🌐 #DeFi #CrossChain #Crypto #Blockchain #Garden"];

  // Combine all sections and filter out any empty lines
  return [...summary, ...highValueSwaps, ...hashtags]
    .filter((line) => line !== undefined && line !== null)
    .join("\n");
}
