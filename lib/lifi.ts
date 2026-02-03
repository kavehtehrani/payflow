import {
  createConfig,
  EVM,
  getQuote,
  getRoutes,
  executeRoute,
  convertQuoteToRoute,
  getStatus,
  type ExecutionOptions,
  type RouteExtended,
} from "@lifi/sdk";
import type { Route, LiFiStep, RoutesRequest, StatusResponse } from "@lifi/types";
import { createWalletClient, createPublicClient, custom, http, type WalletClient, type Chain, erc20Abi, encodeFunctionData } from "viem";
import { mainnet, arbitrum, optimism, polygon, base } from "viem/chains";
import { SUPPORTED_CHAINS } from "./chains";

// Map chain IDs to viem chain objects
const viemChains: Record<number, Chain> = {
  1: mainnet,
  42161: arbitrum,
  10: optimism,
  137: polygon,
  8453: base,
};

// Initialize LI.FI SDK once
let initialized = false;

function ensureInitialized() {
  if (initialized) return;
  createConfig({
    integrator: process.env.NEXT_PUBLIC_LIFI_INTEGRATOR || "payflow-hackathon",
    providers: [EVM()],
  });
  initialized = true;
}

// ---- Wallet integration ----

/**
 * Creates a viem WalletClient from a Privy EIP-1193 provider.
 * This is what LI.FI needs for transaction signing.
 */
export function createViemWalletClient(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eip1193Provider: { request: (...args: any[]) => Promise<any> },
  chainId: number,
  account: `0x${string}`
): WalletClient {
  const chain = viemChains[chainId] || mainnet;
  return createWalletClient({
    account,
    chain,
    transport: custom(eip1193Provider),
  });
}

/**
 * Build execution options that connect LI.FI to the user's Privy wallet.
 */
export function buildExecutionOptions(
  getWalletClientForChain: (chainId: number) => Promise<WalletClient>,
  onStatusUpdate?: (route: RouteExtended) => void
): ExecutionOptions {
  return {
    switchChainHook: async (chainId: number) => {
      const client = await getWalletClientForChain(chainId);
      return client;
    },
    updateRouteHook: (updatedRoute: RouteExtended) => {
      onStatusUpdate?.(updatedRoute);
    },
    acceptExchangeRateUpdateHook: async () => {
      // Auto-accept rate updates for hackathon demo
      return true;
    },
  };
}

// ---- Quotes ----

export interface QuoteParams {
  fromAddress: string;
  fromChainId: number;
  toChainId: number;
  fromTokenAddress: string;
  toTokenAddress: string;
  toAddress: string;
  fromAmount: string;
}

export async function fetchQuote(params: QuoteParams): Promise<LiFiStep> {
  ensureInitialized();
  const quote = await getQuote({
    fromAddress: params.fromAddress,
    fromChain: params.fromChainId,
    toChain: params.toChainId,
    fromToken: params.fromTokenAddress,
    toToken: params.toTokenAddress,
    toAddress: params.toAddress,
    fromAmount: params.fromAmount,
  });
  return quote;
}

// ---- Routes (multiple options) ----

export interface RouteParams {
  fromChainId: number;
  toChainId: number;
  fromTokenAddress: string;
  toTokenAddress: string;
  fromAmount: string;
  fromAddress?: string;
  toAddress?: string;
}

export async function fetchRoutes(params: RouteParams) {
  ensureInitialized();
  const request: RoutesRequest = {
    fromChainId: params.fromChainId,
    toChainId: params.toChainId,
    fromTokenAddress: params.fromTokenAddress,
    toTokenAddress: params.toTokenAddress,
    fromAmount: params.fromAmount,
    fromAddress: params.fromAddress,
    toAddress: params.toAddress,
  };
  const result = await getRoutes(request);
  return result;
}

// ---- Execution ----

export async function executePayment(
  quote: LiFiStep,
  executionOptions: ExecutionOptions
): Promise<RouteExtended> {
  ensureInitialized();
  const route: Route = convertQuoteToRoute(quote);
  const result = await executeRoute(route, executionOptions);
  return result;
}

// ---- Status tracking ----

export async function checkTransactionStatus(
  txHash: string,
  fromChainId: number,
  toChainId: number,
  bridge?: string
): Promise<StatusResponse> {
  ensureInitialized();
  const status = await getStatus({
    txHash,
    fromChain: fromChainId,
    toChain: toChainId,
    bridge,
  });
  return status;
}

// ---- Balances ----

export interface WalletTokenBalance {
  symbol: string;
  name: string;
  amount: string;
  chainId: number;
  address: string;
  decimals: number;
  priceUSD: string;
}

// Tokens to query per chain (native + major stablecoins)
const TOKENS_BY_CHAIN: Record<number, { address: `0x${string}`; symbol: string; name: string; decimals: number }[]> = {
  1: [ // Ethereum
    { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC", name: "USD Coin", decimals: 6 },
    { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", symbol: "USDT", name: "Tether USD", decimals: 6 },
    { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", symbol: "DAI", name: "Dai Stablecoin", decimals: 18 },
  ],
  42161: [ // Arbitrum
    { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", symbol: "USDC", name: "USD Coin", decimals: 6 },
    { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", symbol: "USDT", name: "Tether USD", decimals: 6 },
  ],
  10: [ // Optimism
    { address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", symbol: "USDC", name: "USD Coin", decimals: 6 },
    { address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", symbol: "USDT", name: "Tether USD", decimals: 6 },
  ],
  137: [ // Polygon
    { address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", symbol: "USDC", name: "USD Coin", decimals: 6 },
    { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", symbol: "USDT", name: "Tether USD", decimals: 6 },
  ],
  8453: [ // Base
    { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", name: "USD Coin", decimals: 6 },
  ],
};

async function getChainBalances(
  walletAddress: `0x${string}`,
  chainId: number,
  rpcUrl: string
): Promise<WalletTokenBalance[]> {
  const tokens = TOKENS_BY_CHAIN[chainId] || [];
  if (tokens.length === 0) return [];

  const chain = viemChains[chainId];
  if (!chain) return [];

  const client = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  const balances: WalletTokenBalance[] = [];

  // Get native balance
  try {
    const nativeBalance = await client.getBalance({ address: walletAddress });
    if (nativeBalance > BigInt(0)) {
      const nativeSymbol = chainId === 137 ? "MATIC" : "ETH";
      balances.push({
        symbol: nativeSymbol,
        name: nativeSymbol === "MATIC" ? "Polygon" : "Ethereum",
        amount: nativeBalance.toString(),
        chainId,
        address: "0x0000000000000000000000000000000000000000",
        decimals: 18,
        priceUSD: "0",
      });
    }
  } catch (e) {
    console.warn(`[Balances] Failed to get native balance for chain ${chainId}:`, e);
  }

  // Get token balances using multicall
  try {
    const results = await client.multicall({
      contracts: tokens.map((token) => ({
        address: token.address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [walletAddress],
      })),
    });

    results.forEach((result, i) => {
      if (result.status === "success" && result.result) {
        const balance = BigInt(result.result.toString());
        if (balance > BigInt(0)) {
          balances.push({
            symbol: tokens[i].symbol,
            name: tokens[i].name,
            amount: balance.toString(),
            chainId,
            address: tokens[i].address,
            decimals: tokens[i].decimals,
            priceUSD: "0",
          });
        }
      }
    });
  } catch (e) {
    console.warn(`[Balances] Multicall failed for chain ${chainId}:`, e);
  }

  return balances;
}

export async function getWalletBalances(
  walletAddress: string,
  chainIds: number[]
): Promise<WalletTokenBalance[]> {
  console.log("[Balances] Fetching for address:", walletAddress, "chains:", chainIds);

  const chainRpcUrls: Record<number, string> = {
    1: "https://eth.drpc.org",
    42161: "https://arbitrum.drpc.org",
    10: "https://optimism.drpc.org",
    137: "https://polygon.drpc.org",
    8453: "https://base.drpc.org",
  };

  const promises = chainIds.map((chainId) => {
    const rpcUrl = chainRpcUrls[chainId];
    if (!rpcUrl) return Promise.resolve([]);
    return getChainBalances(walletAddress as `0x${string}`, chainId, rpcUrl);
  });

  const results = await Promise.allSettled(promises);
  const balances: WalletTokenBalance[] = [];

  results.forEach((result) => {
    if (result.status === "fulfilled") {
      balances.push(...result.value);
    }
  });

  console.log("[Balances] Got balances:", balances);
  return balances;
}

// ---- Token Approval ----

const NATIVE_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Check if a token needs approval before spending.
 * Native tokens (ETH, MATIC) don't need approval.
 */
export function needsApproval(tokenAddress: string): boolean {
  return tokenAddress.toLowerCase() !== NATIVE_TOKEN_ADDRESS.toLowerCase();
}

/**
 * Get the current allowance for a token.
 */
export async function getTokenAllowance(
  tokenAddress: string,
  ownerAddress: string,
  spenderAddress: string,
  chainId: number
): Promise<bigint> {
  if (!needsApproval(tokenAddress)) {
    return BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"); // Max uint256 for native
  }

  const chainRpcUrls: Record<number, string> = {
    1: "https://eth.drpc.org",
    42161: "https://arbitrum.drpc.org",
    10: "https://optimism.drpc.org",
    137: "https://polygon.drpc.org",
    8453: "https://base.drpc.org",
  };

  const rpcUrl = chainRpcUrls[chainId];
  if (!rpcUrl) throw new Error(`Unsupported chain: ${chainId}`);

  const chain = viemChains[chainId];
  const client = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  const allowance = await client.readContract({
    address: tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: "allowance",
    args: [ownerAddress as `0x${string}`, spenderAddress as `0x${string}`],
  });

  return allowance;
}

/**
 * Build an approval transaction for a token.
 * Returns the transaction data to be signed by the wallet.
 */
export function buildApprovalTx(
  tokenAddress: string,
  spenderAddress: string,
  amount: string = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" // Max approval by default
): { to: string; data: string } {
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "approve",
    args: [spenderAddress as `0x${string}`, BigInt(amount)],
  });

  return {
    to: tokenAddress,
    data,
  };
}

// ---- Helpers ----

export function getChainDisplayName(chainId: number): string {
  return (
    Object.values(SUPPORTED_CHAINS).find((c) => c.id === chainId)?.displayName ||
    String(chainId)
  );
}

export function formatTokenAmount(amount: string, decimals: number): string {
  const value = parseFloat(amount) / 10 ** decimals;
  if (value < 0.0001) return "<0.0001";
  return value.toFixed(4);
}
