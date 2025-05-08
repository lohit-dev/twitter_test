export interface HighValueOrder {
  create_id: string;
  source_chain: string;
  destination_chain: string;
  source_asset: string;
  destination_asset: string;
  source_amount: string;
  destination_amount: string;
  usd_value: number;
  created_at: string;
  input_token_price: number;
  output_token_price: number;
}

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
  highValueOrders: HighValueOrder[];
}
