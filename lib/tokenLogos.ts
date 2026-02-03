// Token logo URLs from Trust Wallet assets CDN
// Fallback to a generic token icon for unknown tokens

// Common token logos by symbol (chain-agnostic)
const TOKEN_LOGOS: Record<string, string> = {
  ETH: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
  WETH: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png",
  USDC: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png",
  USDT: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png",
  DAI: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png",
  MATIC: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png",
  POL: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png",
  WMATIC: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/assets/0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270/logo.png",
  ARB: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png",
  OP: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png",
  WBTC: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599/logo.png",
  LINK: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x514910771AF9Ca656af840dff83E8264EcF986CA/logo.png",
  UNI: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984/logo.png",
  AAVE: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9/logo.png",
};

// Chain logos by chain ID
const CHAIN_LOGOS: Record<number, string> = {
  1: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
  42161: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png",
  10: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png",
  137: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png",
  8453: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png",
};

// Token addresses to logos (for more specific matching)
const TOKEN_ADDRESS_LOGOS: Record<string, string> = {
  // Ethereum mainnet
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": TOKEN_LOGOS.USDC, // USDC
  "0xdac17f958d2ee523a2206206994597c13d831ec7": TOKEN_LOGOS.USDT, // USDT
  "0x6b175474e89094c44da98b954eedeac495271d0f": TOKEN_LOGOS.DAI, // DAI
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": TOKEN_LOGOS.WETH, // WETH
  // Arbitrum
  "0xaf88d065e77c8cc2239327c5edb3a432268e5831": TOKEN_LOGOS.USDC, // USDC
  "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9": TOKEN_LOGOS.USDT, // USDT
  // Optimism
  "0x0b2c639c533813f4aa9d7837caf62653d097ff85": TOKEN_LOGOS.USDC, // USDC
  "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58": TOKEN_LOGOS.USDT, // USDT
  // Polygon
  "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359": TOKEN_LOGOS.USDC, // USDC
  "0xc2132d05d31c914a87c6611c10748aeb04b58e8f": TOKEN_LOGOS.USDT, // USDT
  // Base
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": TOKEN_LOGOS.USDC, // USDC
};

/**
 * Get a token's logo URL by symbol or address.
 * Returns a fallback placeholder if not found.
 */
export function getTokenLogoUrl(symbolOrAddress: string): string {
  // Check by symbol first (case-insensitive)
  const upperSymbol = symbolOrAddress.toUpperCase();
  if (TOKEN_LOGOS[upperSymbol]) {
    return TOKEN_LOGOS[upperSymbol];
  }

  // Check by address (case-insensitive)
  const lowerAddress = symbolOrAddress.toLowerCase();
  if (TOKEN_ADDRESS_LOGOS[lowerAddress]) {
    return TOKEN_ADDRESS_LOGOS[lowerAddress];
  }

  // Native token address maps to ETH/MATIC
  if (lowerAddress === "0x0000000000000000000000000000000000000000") {
    return TOKEN_LOGOS.ETH;
  }

  // Return a fallback - a generic coin icon
  return "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png";
}

/**
 * Get a chain's logo URL by chain ID.
 */
export function getChainLogoUrl(chainId: number): string {
  return CHAIN_LOGOS[chainId] || CHAIN_LOGOS[1]; // Default to Ethereum
}
