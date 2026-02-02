import { createConfig, getQuote, type QuoteRequest } from "@lifi/sdk";
import { SUPPORTED_CHAINS } from "./chains";

// Initialize LI.FI SDK
createConfig({
  integrator: process.env.NEXT_PUBLIC_LIFI_INTEGRATOR || "payflow-hackathon",
});

export interface PaymentQuoteParams {
  fromAddress: string;
  fromChainId: number;
  toChainId: number;
  fromTokenAddress: string;
  toTokenAddress: string;
  toAddress: string;
  amount: string; // in smallest unit (wei)
}

export async function getPaymentQuote(params: PaymentQuoteParams) {
  const request: QuoteRequest = {
    fromAddress: params.fromAddress,
    fromChain: params.fromChainId,
    toChain: params.toChainId,
    fromToken: params.fromTokenAddress,
    toToken: params.toTokenAddress,
    toAddress: params.toAddress,
    fromAmount: params.amount,
  };

  const quote = await getQuote(request);
  return quote;
}

export interface WalletTokenBalance {
  symbol: string;
  name: string;
  amount: string;
  chainId: number;
  address: string;
  decimals: number;
  priceUSD: string;
}

export async function getWalletBalances(
  walletAddress: string,
  chainIds: number[]
): Promise<WalletTokenBalance[]> {
  // Use LI.FI token balances API endpoint directly
  const chainsParam = chainIds.join(",");
  const res = await fetch(
    `https://li.quest/v1/token/balances?walletAddress=${walletAddress}&chains=${chainsParam}`
  );

  if (!res.ok) return [];

  const data = await res.json();
  const balances: WalletTokenBalance[] = [];

  // Response is keyed by chainId, each containing an array of token balances
  for (const [chainIdStr, tokens] of Object.entries(data)) {
    const chainId = parseInt(chainIdStr, 10);
    if (!Array.isArray(tokens)) continue;

    for (const token of tokens) {
      const t = token as Record<string, unknown>;
      const amount = t.amount?.toString() || "0";
      if (amount === "0") continue;

      balances.push({
        symbol: (t.symbol as string) || "???",
        name: (t.name as string) || "",
        amount,
        chainId,
        address: (t.address as string) || "",
        decimals: (t.decimals as number) || 18,
        priceUSD: (t.priceUSD as string) || "0",
      });
    }
  }

  return balances;
}

export function getChainDisplayName(chainId: number): string {
  return (
    Object.values(SUPPORTED_CHAINS).find((c) => c.id === chainId)?.displayName ||
    String(chainId)
  );
}
