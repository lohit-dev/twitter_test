import { db } from "./connection";
import { SuccessfulOrder, SwapMetrics } from "../types";
import { logger } from "../utils/logger";
import { AssetConfig, getAssetInfo } from "../services/api";
import { queries } from "./queries";
import { formatCurrency } from "../utils/formatters";

/**
 * Returns the number of decimal places for a given asset
 * @param asset The asset to get decimals for
 * @param networkInfo The network information from Hashira API
 * @returns The number of decimal places for the asset
 * @throws Error if the asset is not found in the network info
 */
export function getDecimals(
  asset: { chain: string; asset: string },
  networkInfo: Record<string, any> = {}
): number {
  if (
    asset.asset ===
    "0x2448040b22b27f5a814756e67da005701e525658b162d4f0343d2e011bc6dad"
  ) {
    return 18;
  }

  if (!networkInfo[asset.chain]) {
    throw new Error(`Chain ${asset.chain} not found in network info`);
  }

  const assetConfig = networkInfo[asset.chain].assetConfig.find(
    (config: AssetConfig) =>
      config.symbol.toLowerCase() === asset.asset.toLowerCase() ||
      config.tokenAddress.toLowerCase() === asset.asset.toLowerCase() ||
      config.atomicSwapAddress.toLowerCase() === asset.asset.toLowerCase()
  );

  if (!assetConfig) {
    throw new Error(`Asset ${asset.asset} not found for chain ${asset.chain}`);
  }

  return assetConfig.decimals;
}

/**
 * VolumeRow interface for database query results
 */
export interface VolumeRow {
  create_order_id: string;
  source_swap_amount: number;
  destination_swap_amount: number;
  source_swap_tx_hash: string;
  destination_swap_tx_hash: string;
  source_chain: string;
  source_asset: string;
  destination_chain: string;
  destination_asset: string;
  input_token_price: number;
  output_token_price: number;
  created_at: string; // ISO timestamp
}

/**
 * Fetches new successful orders since a given timestamp
 * @returns Array of successful orders with volume information
 */
export async function getOrderMetrics(): Promise<SuccessfulOrder[]> {
  try {
    logger.info("Fetching new successful orders");
    const startTimestamp = new Date().toISOString();

    // Query to get new successful orders since the start timestamp
    const newOrdersQuery = `SELECT 
    mo.create_order_id,
    s1.amount as source_swap_amount,
    s2.amount as destination_swap_amount,
    co.source_chain,
    co.source_asset,
    co.destination_chain,
    co.destination_asset,
    (co.additional_data->>'input_token_price')::float as input_token_price,
    (co.additional_data->>'output_token_price')::float as output_token_price,
    mo.created_at AT TIME ZONE 'UTC' as created_at
  FROM matched_orders mo
  INNER JOIN create_orders co ON co.create_id = mo.create_order_id
  INNER JOIN swaps s1 ON s1.swap_id = mo.source_swap_id
  INNER JOIN swaps s2 ON s2.swap_id = mo.destination_swap_id
  WHERE s1.redeem_tx_hash != ''
    AND s2.redeem_tx_hash != ''
    AND co.create_id IS NOT NULL
    AND mo.created_at >= $1::timestamp
  ORDER BY mo.created_at DESC;
`;

    const result = await db.query(newOrdersQuery, [startTimestamp]);

    if (result.rows.length === 0) {
      logger.info("No new successful orders found");
      return [];
    }

    // Get network info for decimals calculation
    const networkInfo = await getAssetInfo(
      "https://testnet.api.hashira.io/info/assets"
    );

    // Calculate volume for each order
    const ordersWithVolume = await Promise.all(
      result.rows.map(async (order) => {
        let orderVolume = 0;
        try {
          const sourceAmount =
            Number(order.source_swap_amount) /
            Math.pow(
              10,
              getDecimals(
                {
                  chain: order.source_chain,
                  asset: order.source_asset,
                },
                networkInfo
              )
            );

          const destinationAmount =
            Number(order.source_swap_amount) /
            Math.pow(
              10,
              getDecimals(
                {
                  chain: order.destination_chain,
                  asset: order.destination_asset,
                },
                networkInfo
              )
            );

          orderVolume =
            sourceAmount * order.input_token_price +
            destinationAmount * order.output_token_price;

          logger.info(`Order volume: ${formatCurrency(orderVolume)}`);

          logger.info(
            `Order ${order.create_order_id} volume: $${orderVolume.toFixed(2)} (source: $${(order.source_amount * order.input_token_price).toFixed(2)}, destination: $${(order.destination_amount * order.output_token_price).toFixed(2)})`
          );
        } catch (error) {
          logger.error(
            `Error calculating volume for order ${order.create_order_id}: ${error}`
          );
        }

        return {
          ...order,
          orderVolume,
          timestamp: new Date().toISOString(),
        };
      })
    );

    return ordersWithVolume;
  } catch (error) {
    logger.error("Error fetching order metrics:", error);
    throw error;
  }
}

export async function getSwapMetrics(): Promise<SwapMetrics> {
  try {
    logger.info("Fetching swap metrics using queries from queries.ts");

    const totalOrdersResult = await db.query(queries.totalOrdersQuery);
    const totalOrdersData = totalOrdersResult.rows[0];

    const yesterdayOrdersResult = await db.query(queries.yesterdayOrdersQuery);
    const yesterdayOrdersData = yesterdayOrdersResult.rows[0];

    const volumeResult = await db.query(queries.volumeQuery);
    const volumeData: VolumeRow[] = volumeResult.rows;

    const yesterdayVolumeResult = await db.query(queries.yesterDayVolumeQuery);
    const yesterdayVolumeData = yesterdayVolumeResult.rows;

    const usersResult = await db.query(queries.users);
    const totalUsers = parseInt(usersResult.rows[0]?.total_users || "0");

    const networkInfo = await getAssetInfo(
      "https://testnet.api.hashira.io/info/assets"
    );
    let allTimeVolume = 0;
    let last24HoursVolume = 0;

    for (const order of volumeData) {
      // logger.info(`Order: ${JSON.stringify(order)}`);

      if (order.input_token_price && order.source_swap_amount) {
        try {
          let decimals = getDecimals(
            { chain: order.source_chain, asset: order.source_asset },
            networkInfo
          );

          const source_amount =
            Number(order.source_swap_amount) / Math.pow(10, decimals);

          let destination_decimals;
          try {
            destination_decimals = getDecimals(
              {
                chain: order.destination_chain,
                asset: order.destination_asset,
              },
              networkInfo
            );

            const destination_amount =
              Number(order.destination_swap_amount) /
              Math.pow(10, destination_decimals);

            allTimeVolume +=
              source_amount * order.input_token_price +
              destination_amount * order.output_token_price;
          } catch (error: any) {
            logger.warn(
              `Skipping destination amount calculation for order ${order.create_order_id}: ${error.message}`
            );
            // If we can't calculate destination amount, just use source amount
            allTimeVolume += source_amount * order.input_token_price;
          }
        } catch (error: any) {
          logger.warn(
            `Skipping order ${order.create_order_id}: ${error.message}`
          );
        }
      }
    }

    // Calculate 24-hour volume
    for (const order of yesterdayVolumeData) {
      if (order.input_token_price && order.source_swap_amount) {
        try {
          let decimals = getDecimals(
            { chain: order.source_chain, asset: order.source_asset },
            networkInfo
          );

          const source_amount =
            Number(order.source_swap_amount) / Math.pow(10, decimals);

          let destination_decimals;
          try {
            // Check if destination chain and asset are defined
            if (!order.destination_chain || !order.destination_asset) {
              throw new Error(`Missing destination chain or asset information`);
            }

            destination_decimals = getDecimals(
              {
                chain: order.destination_chain,
                asset: order.destination_asset,
              },
              networkInfo
            );

            const destination_amount =
              Number(order.destination_swap_amount) /
              Math.pow(10, destination_decimals);

            last24HoursVolume +=
              source_amount * order.input_token_price +
              destination_amount * order.output_token_price;
          } catch (error: any) {
            logger.warn(
              `Skipping destination amount calculation for order ${order.create_order_id}: ${error.message}`
            );
            // If we can't calculate destination amount, just use source amount
            last24HoursVolume += source_amount * order.input_token_price;
          }
        } catch (error: any) {
          logger.warn(
            `Skipping order ${order.create_order_id}: ${error.message}`
          );
        }
      }
    }

    // Count orders by chain
    const chainCounts = new Map<string, { count: number; volume: number }>();
    for (const order of volumeData) {
      if (!order.source_chain) continue;

      const chain = order.source_chain.toLowerCase();
      if (!chainCounts.has(chain)) {
        chainCounts.set(chain, { count: 0, volume: 0 });
      }

      const chainData = chainCounts.get(chain)!;
      chainData.count += 1;

      if (order.input_token_price && order.source_swap_amount) {
        try {
          let decimals = getDecimals(
            { chain: order.source_chain, asset: order.source_asset },
            networkInfo
          );

          const amount =
            Number(order.source_swap_amount) / Math.pow(10, decimals);
          chainData.volume += amount * order.input_token_price;
        } catch (error: any) {
          logger.warn(
            `Skipping order ${order.create_order_id}: ${error.message}`
          );
        }
      }
    }

    // Find the chain with the most orders
    let topChainEntry: [string, { count: number; volume: number }] | null =
      null;
    for (const entry of chainCounts.entries()) {
      if (!topChainEntry || entry[1].count > topChainEntry[1].count) {
        topChainEntry = entry;
      } else if (
        entry[1].count === topChainEntry[1].count &&
        entry[1].volume > topChainEntry[1].volume
      ) {
        topChainEntry = entry;
      }
    }

    // Get chain name from network info
    const chainIdentifier = topChainEntry ? topChainEntry[0] : null;
    const chainInfo = chainIdentifier ? networkInfo[chainIdentifier] : null;

    const topChain = topChainEntry
      ? {
          name: chainInfo?.name || chainIdentifier || "unknown",
          count: topChainEntry[1].count,
        }
      : { name: "unknown", count: 0 };

    // Find top asset pair
    const assetPairCounts = new Map<
      string,
      { count: number; volume: number; chain: string; asset: string }
    >();
    for (const order of volumeData) {
      if (!order.source_chain || !order.source_asset) continue;

      const key = `${order.source_chain.toLowerCase()}_${order.source_asset.toLowerCase()}`;
      if (!assetPairCounts.has(key)) {
        assetPairCounts.set(key, {
          count: 0,
          volume: 0,
          chain: order.source_chain.toLowerCase(),
          asset: order.source_asset.toLowerCase(),
        });
      }

      const pairData = assetPairCounts.get(key)!;
      pairData.count += 1;

      if (order.input_token_price && order.source_swap_amount) {
        try {
          let decimals = getDecimals(
            { chain: order.source_chain, asset: order.source_asset },
            networkInfo
          );

          const amount =
            Number(order.source_swap_amount) / Math.pow(10, decimals);
          pairData.volume += amount * order.input_token_price;
        } catch (error: any) {
          logger.warn(
            `Skipping order ${order.create_order_id}: ${error.message}`
          );
        }
      }
    }

    // Find the top asset pair
    let topAssetPairEntry:
      | [
          string,
          { count: number; volume: number; chain: string; asset: string },
        ]
      | null = null;
    for (const entry of assetPairCounts.entries()) {
      if (!topAssetPairEntry || entry[1].count > topAssetPairEntry[1].count) {
        topAssetPairEntry = entry;
      } else if (
        entry[1].count === topAssetPairEntry[1].count &&
        entry[1].volume > topAssetPairEntry[1].volume
      ) {
        topAssetPairEntry = entry;
      }
    }

    // Get asset info for proper name
    const assetChain = topAssetPairEntry ? topAssetPairEntry[1].chain : null;
    const assetAddress = topAssetPairEntry ? topAssetPairEntry[1].asset : null;
    let assetName = assetAddress || "unknown";

    if (assetChain && assetAddress && networkInfo[assetChain]) {
      const assetConfig = networkInfo[assetChain].assetConfig.find(
        (asset) =>
          asset.tokenAddress.toLowerCase() === assetAddress.toLowerCase()
      );
      if (assetConfig) {
        assetName = `${assetConfig.symbol} (${assetConfig.name})`;
      }
    }

    const topAssetPair = topAssetPairEntry
      ? {
          pair: assetName,
          count: topAssetPairEntry[1].count,
        }
      : { pair: "unknown", count: 0 };

    // Calculate completion rate
    const totalMatchedOrders = parseInt(totalOrdersData?.total_orders || "0");
    const totalSuccessfulOrders = parseInt(
      totalOrdersData?.fulfilled_orders || "0"
    );
    const completionRate =
      totalMatchedOrders > 0 ? totalSuccessfulOrders / totalMatchedOrders : 0;

    return {
      allOrders: parseInt(totalOrdersData?.total_orders || "0"),
      totalSwaps: totalSuccessfulOrders,
      last24HoursSwaps: parseInt(yesterdayOrdersData?.total_orders || "0"),
      last24HoursVolume: last24HoursVolume,
      allTimeVolume: allTimeVolume,
      topChain,
      topAssetPair,
      completionRate,
    };
  } catch (error) {
    logger.error("Error calculating swap metrics:", error);
    throw error;
  }
}
