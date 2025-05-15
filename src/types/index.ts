import {
  ASSET_MAPPINGS,
  SwapPlatform,
} from "../services/timeAndFeeComparison/constants";
import { Asset } from "@gardenfi/orderbook";
import { Chain, Asset as ChainflipAsset } from "@chainflip/sdk/swap";

export interface SwapMetrics {
  allOrders: number;
  totalSwaps: number;
  last24HoursSwaps: number;
  last24HoursVolume: number;
  allTimeVolume: number;
  topChain: {
    name: string;
    count: number;
  };
  topAssetPair: {
    pair: string;
    count: number;
  };
  completionRate: number;
}

export interface SuccessfulOrder {
  create_order_id: string;
  source_chain: string;
  source_asset: string;
  destination_chain: string;
  destination_asset: string;
  source_swap_amount: string;
  destination_swap_amount: string;
  input_token_price: number;
  output_token_price: number;
  created_at: string;
  timestamp: string;
  volume: number;
  timeSaved?: string;
  timeSavedMinutes?: number;
  feeSaved?: number;
}

// Define types for token data
export interface TokenData {
  codeVerifier?: string;
  state?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  authenticated?: boolean;
}

// Define tweet log entry type
export interface TweetLogEntry {
  id: string;
  message: string;
  timestamp: string;
}

// Interface for tweet response
export interface TweetResponse {
  id: string;
  text: string;
}

export const getFormattedAsset = (asset: Asset, type: AssetMappingType) =>
  ASSET_MAPPINGS[type]?.[`${asset.chain}:${asset.symbol}`];

export type AssetMappings = {
  [SwapPlatform.THORSWAP]: Record<string, string>;
  [SwapPlatform.RELAY]: Record<string, { chainId: string; currency: string }>;
  [SwapPlatform.CHAINFLIP]: Record<
    string,
    {
      chain: Chain;
      asset: ChainflipAsset;
      htlc_address: string;
      address: string;
    }
  >;
};

export type comparisonMetric = { fee: number; time: number };

export type AssetMappingType = keyof AssetMappings;
