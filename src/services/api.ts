import axios from "axios";
import { logger } from "../utils/logger";

export interface AssetConfig {
  name: string;
  decimals: number;
  symbol: string;
  logo: string;
  tokenAddress: string;
  atomicSwapAddress: string;
  min_amount: string;
  max_amount: string;
}

interface NetworkInfo {
  chainId: string;
  networkLogo: string;
  explorer: string;
  networkType: string;
  name: string;
  assetConfig: AssetConfig[];
  identifier: string;
}

export type HashiraNetworkResponse = Record<string, NetworkInfo>;

export async function getAssetInfo(): Promise<HashiraNetworkResponse> {
  try {
    logger.info("Fetching network and asset information from Hashira API");
    const response = await axios.get<HashiraNetworkResponse>(
      "https://testnet.api.hashira.io/info/assets",
    );

    const networks = Object.keys(response.data);
    logger.info(
      `Successfully received information for ${networks.length} networks: ${networks.join(", ")}`,
    );

    // Log asset information for each network
    for (const [network, info] of Object.entries(response.data)) {
      logger.info(
        `Network ${network} has ${info.assetConfig.length} assets configured`,
      );
      info.assetConfig.forEach((asset) => {
        logger.debug(
          `Asset on ${network}: ${asset.symbol} (${asset.name}) with ${asset.decimals} decimals`,
        );
      });
    }

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error(`Hashira API request failed: ${error.message}`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });
    } else {
      logger.error("Unexpected error while fetching asset information:", error);
    }
    throw error;
  }
}
