import { db } from "./connection";
import { HighValueOrder, SwapMetrics } from "../types";
import { logger } from "../utils/logger";
import { AssetConfig, getAssetInfo } from "../services/api";

export async function getAllSuccessfullOrders() {
  try {
    const result = await db.query(`
      SELECT COUNT(*) AS total_successful_orders
      FROM matched_orders mo
      JOIN swaps source_swap ON mo.source_swap_id = source_swap.swap_id
      JOIN swaps destination_swap ON mo.destination_swap_id = destination_swap.swap_id
      WHERE (
        (source_swap.redeem_tx_hash IS NOT NULL AND source_swap.redeem_tx_hash != '')
        OR 
        (destination_swap.redeem_tx_hash IS NOT NULL AND destination_swap.redeem_tx_hash != '')
      )
    `);

    return result.rows;
  } catch (error) {
    logger.error("Error fetching successful orders:", error);
    throw error;
  }
}

export async function getVolumeForIntervalDynamic(interval: string) {
  try {
    const networkInfo = await getAssetInfo();
    logger.info("Fetched network configurations for volume calculation");

    const decimalMapping = new Map<string, number>();

    for (const [network, info] of Object.entries(networkInfo)) {
      info.assetConfig.forEach((asset) => {
        const key = `${network.toLowerCase()}_${asset.tokenAddress.toLowerCase()}`;
        decimalMapping.set(key, asset.decimals);
        logger.debug(`Mapped ${key} to ${asset.decimals} decimals`);
      });
    }

    const result = await db.query(
      `
      WITH successful_orders AS (
        SELECT
          mo.create_order_id,
          LOWER(co.source_chain) AS source_chain,
          LOWER(co.destination_chain) AS destination_chain,
          LOWER(co.source_asset) AS source_asset,
          LOWER(co.destination_asset) AS destination_asset,
          CAST(co.source_amount AS DECIMAL(36,0)) AS source_amount,
          CAST(co.destination_amount AS DECIMAL(36,0)) AS destination_amount,
          CAST((co.additional_data->>'input_token_price') AS DECIMAL(36,8)) AS input_token_price,
          CAST((co.additional_data->>'output_token_price') AS DECIMAL(36,8)) AS output_token_price
        FROM matched_orders mo
        JOIN create_orders co ON mo.create_order_id = co.create_id
        JOIN swaps ss ON mo.source_swap_id = ss.swap_id
        JOIN swaps ds ON mo.destination_swap_id = ds.swap_id
        WHERE ss.redeem_tx_hash IS NOT NULL
          AND ss.redeem_tx_hash != ''
          AND ds.redeem_tx_hash IS NOT NULL
          AND ds.redeem_tx_hash != ''
          AND ss.created_at >= NOW() - $1::INTERVAL
      )

      SELECT
        so.*,
        $1 AS period
      FROM successful_orders so;
    `,
      [interval]
    );

    let totalVolume = 0;
    for (const row of result.rows) {
      const sourceKey = `${row.source_chain}_${row.source_asset}`;
      const sourceDecimals =
        decimalMapping.get(sourceKey) ||
        (row.source_chain === "bitcoin_testnet" &&
        row.source_asset === "primary"
          ? 8
          : 18);

      if (row.input_token_price > 0) {
        const amount = Number(row.source_amount) / Math.pow(10, sourceDecimals);
        totalVolume += amount * Number(row.input_token_price);
      }
    }

    logger.info(
      `Calculated total volume for interval ${interval}: ${totalVolume}`
    );

    return {
      period: interval,
      total_volume: totalVolume,
    };
  } catch (err) {
    logger.error("Error fetching dynamic volume for interval:", err);
    throw err;
  }
}

export async function getRecentSwaps(interval: string): Promise<number> {
  try {
    const result = await db.query(
      `SELECT COUNT(*) AS count 
       FROM public.swaps 
       WHERE created_at > NOW() - $1::INTERVAL`,
      [interval]
    );
    return parseInt(result.rows[0].count);
  } catch (error) {
    logger.error(`Error fetching swaps from last ${interval}:`, error);
    throw error;
  }
}

export async function getRecentOrders(interval: string): Promise<number> {
  try {
    const result = await db.query(
      `SELECT COUNT(*) AS count 
       FROM public.create_orders 
       WHERE created_at > NOW() - $1::INTERVAL`,
      [interval]
    );
    return parseInt(result.rows[0].count);
  } catch (error) {
    logger.error(`Error fetching orders from last ${interval}:`, error);
    throw error;
  }
}

export async function getSuccessfulOrdersForInterval(interval: string) {
  try {
    const result = await db.query(
      `
      SELECT COUNT(*) AS successful_orders
       FROM matched_orders mo
      JOIN swaps source_swap ON mo.source_swap_id = source_swap.swap_id
      JOIN swaps destination_swap ON mo.destination_swap_id = destination_swap.swap_id
      WHERE (
        source_swap.redeem_tx_hash IS NOT NULL 
        AND source_swap.redeem_tx_hash != ''
        AND destination_swap.redeem_tx_hash IS NOT NULL 
        AND destination_swap.redeem_tx_hash != ''
        AND source_swap.created_at >= NOW() - $1::INTERVAL
      )
    `,
      [interval]
    );

    return parseInt(result.rows[0].successful_orders);
  } catch (err) {
    console.error("❌ Error retrieving successful orders for interval:", err);
    throw err;
  }
}

export async function getAllOrders() {
  try {
    const result = await db.query(
      `SELECT COUNT(*) as count 
       FROM create_orders`
    );
    return parseInt(result.rows[0].count);
  } catch (error) {
    logger.error("Error fetching all orders:", error);
    throw error;
  }
}

export async function getTotalVolumeAllTime() {
  try {
    const networkInfo = await getAssetInfo();
    logger.info(
      "Fetched network configurations for all-time volume calculation"
    );

    const decimalMapping = new Map<string, number>();

    for (const [network, info] of Object.entries(networkInfo)) {
      info.assetConfig.forEach((asset) => {
        const key = `${network.toLowerCase()}_${asset.tokenAddress.toLowerCase()}`;
        decimalMapping.set(key, asset.decimals);
        logger.debug(`Mapped ${key} to ${asset.decimals} decimals`);
      });
    }

    const result = await db.query(
      `
      WITH successful_orders AS (
        SELECT
          mo.create_order_id,
          LOWER(co.source_chain) AS source_chain,
          LOWER(co.destination_chain) AS destination_chain,
          LOWER(co.source_asset) AS source_asset,
          LOWER(co.destination_asset) AS destination_asset,
          CAST(co.source_amount AS DECIMAL(36,0)) AS source_amount,
          CAST(co.destination_amount AS DECIMAL(36,0)) AS destination_amount,
          CAST((co.additional_data->>'input_token_price') AS DECIMAL(36,8)) AS input_token_price,
          CAST((co.additional_data->>'output_token_price') AS DECIMAL(36,8)) AS output_token_price
        FROM matched_orders mo
        JOIN create_orders co ON mo.create_order_id = co.create_id
        JOIN swaps ss ON mo.source_swap_id = ss.swap_id
        JOIN swaps ds ON mo.destination_swap_id = ds.swap_id
        WHERE (ss.redeem_tx_hash IS NOT NULL AND ss.redeem_tx_hash != '')
          AND (ds.redeem_tx_hash IS NOT NULL AND ds.redeem_tx_hash != '')
          AND co.source_amount IS NOT NULL
          AND co.additional_data->>'input_token_price' IS NOT NULL
      )

      SELECT
        so.*
      FROM successful_orders so;
    `
    );

    let totalVolume = 0;
    for (const row of result.rows) {
      const sourceKey = `${row.source_chain}_${row.source_asset}`;
      const sourceDecimals =
        decimalMapping.get(sourceKey) ||
        (row.source_chain === "bitcoin_testnet" &&
        row.source_asset === "primary"
          ? 8
          : 18);

      if (row.input_token_price > 0) {
        const amount = Number(row.source_amount) / Math.pow(10, sourceDecimals);
        totalVolume += amount * Number(row.input_token_price);
      }
    }

    logger.info(`Calculated total all-time volume: ${totalVolume}`);

    return {
      total_volume: totalVolume,
    };
  } catch (err) {
    logger.error("Error fetching all-time volume:", err);
    throw err;
  }
}

export async function getHighValueOrders(
  minValueUsd: number
): Promise<HighValueOrder[]> {
  try {
    const networkInfo = await getAssetInfo();
    logger.info("Fetching high-value orders...");

    const query = `
      WITH successful_orders AS (
        SELECT
          mo.create_order_id,
          LOWER(co.source_chain) AS source_chain,
          LOWER(co.destination_chain) AS destination_chain,
          LOWER(co.source_asset) AS source_asset,
          LOWER(co.destination_asset) AS destination_asset,
          CAST(co.source_amount AS DECIMAL(36,0)) AS source_amount,
          CAST(co.destination_amount AS DECIMAL(36,0)) AS destination_amount,
          CAST((co.additional_data->>'input_token_price') AS DECIMAL(36,8)) AS input_token_price,
          CAST((co.additional_data->>'output_token_price') AS DECIMAL(36,8)) AS output_token_price,
          co.created_at,
          co.create_id
        FROM matched_orders mo
        JOIN create_orders co ON mo.create_order_id = co.create_id
        JOIN swaps ss ON mo.source_swap_id = ss.swap_id
        JOIN swaps ds ON mo.destination_swap_id = ds.swap_id
        WHERE (ss.redeem_tx_hash IS NOT NULL AND ss.redeem_tx_hash != '')
          AND (ds.redeem_tx_hash IS NOT NULL AND ds.redeem_tx_hash != '')
          AND co.source_amount IS NOT NULL
          AND co.additional_data->>'input_token_price' IS NOT NULL
      )
      SELECT * FROM successful_orders
    `;

    const result = await db.query(query);

    const highValueOrders = result.rows.filter((row) => {
      let sourceDecimals = 18;

      if (
        row.source_chain === "bitcoin_testnet" &&
        row.source_asset === "primary"
      ) {
        sourceDecimals = 8;
      } else if (networkInfo[row.source_chain]) {
        const assetConfig = networkInfo[row.source_chain].assetConfig.find(
          (asset: AssetConfig) =>
            asset.tokenAddress.toLowerCase() === row.source_asset.toLowerCase()
        );
        if (assetConfig) {
          sourceDecimals = assetConfig.decimals;
        }
      }

      const amount = Number(row.source_amount) / Math.pow(10, sourceDecimals);
      const usdValue = amount * Number(row.input_token_price);

      return usdValue > minValueUsd;
    });

    return highValueOrders.map((order) => ({
      create_id: order.create_id,
      source_chain: order.source_chain,
      destination_chain: order.destination_chain,
      source_asset: order.source_asset,
      destination_asset: order.destination_asset,
      source_amount: order.source_amount,
      destination_amount: order.destination_amount,
      input_token_price: order.input_token_price,
      output_token_price: order.output_token_price,
      usd_value:
        (Number(order.source_amount) /
          Math.pow(
            10,
            order.source_chain === "bitcoin_testnet" &&
              order.source_asset === "primary"
              ? 8
              : 18
          )) *
        Number(order.input_token_price),
      created_at: order.created_at,
    }));
  } catch (err) {
    logger.error("Error retrieving high-value orders:", err);
    throw err;
  }
}

export async function getSwapMetrics() {
  try {
    const successfulOrdersResult = await getAllSuccessfullOrders();
    const totalSuccessfulOrders = parseInt(
      successfulOrdersResult[0].total_successful_orders
    );

    const allOrders = await getAllOrders();
    const last24HoursOrders = await getRecentOrders("24 hours");
    const last24HoursVolume = await getVolumeForIntervalDynamic("24 hours");
    const allTimeVolumeResult = await getTotalVolumeAllTime();

    // Top chain
    const topChainResult = await db.query(
      `SELECT 
        LOWER(co.source_chain) as chain,
        COUNT(*) as count,
        SUM(
          CAST(co.source_amount AS DECIMAL(36,0)) * 
          CAST((co.additional_data->>'input_token_price') AS DECIMAL(36,8))
        ) as volume
      FROM matched_orders mo
      JOIN create_orders co ON mo.create_order_id = co.create_id
      JOIN swaps ss ON mo.source_swap_id = ss.swap_id
      JOIN swaps ds ON mo.destination_swap_id = ds.swap_id
      WHERE ss.redeem_tx_hash IS NOT NULL AND ss.redeem_tx_hash != ''
        AND ds.redeem_tx_hash IS NOT NULL AND ds.redeem_tx_hash != ''
        AND co.source_amount IS NOT NULL
        AND co.additional_data->>'input_token_price' IS NOT NULL
       GROUP BY LOWER(co.source_chain)
      ORDER BY count DESC, volume DESC
       LIMIT 1`
    );

    // Get network info for chain name
    const networkInfo = await getAssetInfo();
    const chainIdentifier = topChainResult.rows[0]?.chain;
    const chainInfo = chainIdentifier ? networkInfo[chainIdentifier] : null;

    const topChain = topChainResult.rows[0]
      ? {
          name: chainInfo?.name || chainIdentifier || "unknown",
          count: parseInt(topChainResult.rows[0].count),
        }
      : { name: "unknown", count: 0 };

    // Top asset pair
    const topAssetPairResult = await db.query(
      `SELECT 
        LOWER(co.source_chain) as chain,
        LOWER(co.source_asset) as asset,
        COUNT(*) as count,
        SUM(
          CAST(co.source_amount AS DECIMAL(36,0)) * 
          CAST((co.additional_data->>'input_token_price') AS DECIMAL(36,8))
        ) as volume
      FROM matched_orders mo
      JOIN create_orders co ON mo.create_order_id = co.create_id
      JOIN swaps ss ON mo.source_swap_id = ss.swap_id
      JOIN swaps ds ON mo.destination_swap_id = ds.swap_id
      WHERE ss.redeem_tx_hash IS NOT NULL AND ss.redeem_tx_hash != ''
        AND ds.redeem_tx_hash IS NOT NULL AND ds.redeem_tx_hash != ''
        AND co.source_amount IS NOT NULL
        AND co.additional_data->>'input_token_price' IS NOT NULL
      GROUP BY LOWER(co.source_chain), LOWER(co.source_asset)
      ORDER BY count DESC, volume DESC
       LIMIT 1`
    );

    // Get asset info for proper name
    const assetChain = topAssetPairResult.rows[0]?.chain;
    const assetAddress = topAssetPairResult.rows[0]?.asset;
    let assetName = assetAddress;

    if (assetChain && assetAddress && networkInfo[assetChain]) {
      const assetConfig = networkInfo[assetChain].assetConfig.find(
        (asset) =>
          asset.tokenAddress.toLowerCase() === assetAddress.toLowerCase()
      );
      if (assetConfig) {
        assetName = `${assetConfig.symbol} (${assetConfig.name})`;
      }
    }

    const topAssetPair = topAssetPairResult.rows[0]
      ? {
          pair: assetName,
          count: parseInt(topAssetPairResult.rows[0].count),
        }
      : { pair: "unknown", count: 0 };

    const totalOrdersResult = await db.query(
      `SELECT COUNT(*) FROM matched_orders`
    );
    const totalMatchedOrders = parseInt(totalOrdersResult.rows[0].count);
    const completionRate =
      totalMatchedOrders > 0 ? totalSuccessfulOrders / totalMatchedOrders : 0;

    return {
      allOrders: allOrders,
      totalSwaps: totalSuccessfulOrders,
      last24HoursSwaps: last24HoursOrders,
      last24HoursVolume: last24HoursVolume.total_volume || 0,
      allTimeVolume: allTimeVolumeResult.total_volume || 0,
      topChain,
      topAssetPair,
      completionRate,
    };
  } catch (error) {
    logger.error("Error calculating swap metrics:", error);
    throw error;
  }
}
