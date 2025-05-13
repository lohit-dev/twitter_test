import { ChainflipAssetAndChain, ChainflipPriceResponse } from "./constants";
import { getChainId, getFormattedAsset } from "./utils";
import { Asset } from "@gardenfi/orderbook";
import {
  API_URLS,
  ChainflipQuote,
  comparisonMetric,
  SwapPlatform,
} from "./constants";
import axios from "axios";

export const getChainflipFee = async (
  srcAsset: Asset,
  destAsset: Asset,
  amount: number,
): Promise<comparisonMetric> => {
  if (!srcAsset || !destAsset) {
    return { fee: 0, time: 0 };
  }

  const srcFormat = getFormattedAsset(
    srcAsset,
    SwapPlatform.CHAINFLIP,
  ) as ChainflipAssetAndChain;

  const destFormat = getFormattedAsset(
    destAsset,
    SwapPlatform.CHAINFLIP,
  ) as ChainflipAssetAndChain;

  if (!srcFormat || !destFormat) {
    return { fee: 0, time: 0 };
  }

  const sendAmount = (amount * 10 ** srcAsset.decimals).toString();

  const quoteRequest = {
    amount: sendAmount,
    srcChain: srcFormat.chain,
    srcAsset: srcFormat.asset,
    destChain: destFormat.chain,
    destAsset: destFormat.asset,
    isVaultSwap: false,
    brokerCommissionBps: 15,
    dcaEnabled: true,
  };

  try {
    const quoteData = await axios.get(API_URLS.chainflip, {
      params: quoteRequest,
    });
    const quotes = quoteData.data as ChainflipQuote[];

    let bestQuote: ChainflipQuote | null = null;
    let bestAmount = BigInt(0);

    for (const quote of quotes) {
      const amount = quote.boostQuote
        ? BigInt(quote.boostQuote.egressAmount)
        : BigInt(quote.egressAmount);
      if (amount > bestAmount) {
        bestAmount = amount;
        bestQuote = quote;
      }
    }

    if (bestQuote) {
      const priceQuery = {
        query: `
            query GetTokenPrices($tokens: [PriceQueryInput!]!) {
              tokenPrices: getTokenPrices(input: $tokens) {
                chainId
                address
                usdPrice
              }
            }
          `,
        variables: {
          tokens: [
            {
              chainId: getChainId(srcFormat.chain.toString()),
              address: srcFormat.address,
            },
            {
              chainId: getChainId(destFormat.chain.toString()),
              address: destFormat.address,
            },
          ],
        },
      };

      const { data: priceData } = await axios.post<ChainflipPriceResponse>(
        API_URLS.fiatValue,
        priceQuery,
      );

      const srcTokenPrice =
        priceData.data.tokenPrices.find(
          (price) =>
            price.chainId === getChainId(srcFormat.chain.toString()) &&
            price.address.toLowerCase() === srcFormat.address.toLowerCase(),
        )?.usdPrice || 0;

      const destTokenPrice =
        priceData.data.tokenPrices.find(
          (price) =>
            price.chainId === getChainId(destFormat.chain.toString()) &&
            price.address.toLowerCase() === destFormat.address.toLowerCase(),
        )?.usdPrice || 0;

      const inputAmountInUSD = amount * srcTokenPrice;
      const outputValue =
        Number(bestQuote.boostQuote?.egressAmount || bestQuote.egressAmount) /
        10 ** destAsset.decimals;
      const outputValueInUSD = outputValue * destTokenPrice;

      const fee = inputAmountInUSD - outputValueInUSD;

      return {
        fee,
        time:
          bestQuote.boostQuote?.estimatedDurationSeconds ||
          bestQuote.estimatedDurationSeconds,
      };
    } else {
      return { fee: 0, time: 0 };
    }
  } catch {
    return { fee: 0, time: 0 };
  }
};
