"use client";

import { useEffect, useState, useCallback } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { createPublicClient, http } from "viem";
import { normalize } from "viem/ens";
import { mainnet } from "viem/chains";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TokenIcon, ChainIcon } from "@/components/TokenIcon";
import { TokenSelect, ChainSelect } from "@/components/ui/token-select";
import { SUPPORTED_CHAINS } from "@/lib/chains";
import {
  getWalletBalances,
  formatTokenAmount,
  needsApproval,
  getTokenAllowance,
  buildApprovalTx,
  type WalletTokenBalance,
} from "@/lib/lifi";

// ENS resolution client (mainnet only)
const ensClient = createPublicClient({
  chain: mainnet,
  transport: http("https://eth.drpc.org"),
});

// Common tokens for receiving (can be different from what user has)
const RECEIVE_TOKENS = [
  { symbol: "ETH", address: "0x0000000000000000000000000000000000000000", decimals: 18 },
  { symbol: "USDC", address: "USDC", decimals: 6 }, // Will be resolved per chain
  { symbol: "USDT", address: "USDT", decimals: 6 },
];

// USDC addresses per chain
const USDC_BY_CHAIN: Record<number, string> = {
  1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  10: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  137: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
};

// USDT addresses per chain
const USDT_BY_CHAIN: Record<number, string> = {
  1: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  42161: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  10: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
  137: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  8453: "0x0000000000000000000000000000000000000000", // No USDT on Base
};

interface Quote {
  id: string;
  tool: string;
  action: {
    fromChainId: number;
    toChainId: number;
    fromToken: { symbol: string; decimals: number; address: string };
    toToken: { symbol: string; decimals: number; address: string };
    fromAmount: string;
    toAddress: string;
  };
  estimate: {
    toAmount: string;
    toAmountMin: string;
    approvalAddress: string;
    executionDuration: number;
    feeCosts: Array<{ amountUSD: string }>;
    gasCosts: Array<{ amountUSD: string }>;
  };
  transactionRequest: {
    to: string;
    data: string;
    value: string;
    chainId: number;
    gasLimit: string;
  };
}

type TxStatus = "idle" | "approving" | "sending" | "confirming" | "success" | "error";

export default function SendPage() {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const router = useRouter();

  // Get active wallet
  const activeWallet = wallets.find((w) => w.walletClientType !== "privy") || wallets[0];
  const walletAddress = activeWallet?.address;

  // User balances
  const [balances, setBalances] = useState<WalletTokenBalance[]>([]);
  const [loadingBalances, setLoadingBalances] = useState(false);

  // Form state
  const [selectedBalance, setSelectedBalance] = useState<WalletTokenBalance | null>(null);
  const [showTokenPicker, setShowTokenPicker] = useState(false);
  const [toAddress, setToAddress] = useState("");
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [resolvingEns, setResolvingEns] = useState(false);
  const [toChainId, setToChainId] = useState<number>(8453); // Default to Base
  const [toTokenSymbol, setToTokenSymbol] = useState("USDC");
  const [amount, setAmount] = useState("");

  // Quote state
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Transaction state
  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (ready && !authenticated) {
      router.push("/");
    }
  }, [ready, authenticated, router]);

  // Fetch balances
  const fetchBalances = useCallback(async () => {
    if (!walletAddress) return;
    setLoadingBalances(true);
    try {
      const chainIds = Object.values(SUPPORTED_CHAINS).map((c) => c.id);
      const result = await getWalletBalances(walletAddress, chainIds);
      setBalances(result);
      // Auto-select first balance if none selected
      if (result.length > 0 && !selectedBalance) {
        setSelectedBalance(result[0]);
      }
    } catch (err) {
      console.error("Failed to fetch balances:", err);
    } finally {
      setLoadingBalances(false);
    }
  }, [walletAddress, selectedBalance]);

  useEffect(() => {
    if (walletAddress) fetchBalances();
  }, [walletAddress, fetchBalances]);

  // Resolve ENS names
  useEffect(() => {
    const resolveAddress = async () => {
      // Check if it's already a valid hex address
      if (/^0x[a-fA-F0-9]{40}$/.test(toAddress)) {
        setResolvedAddress(toAddress);
        return;
      }

      // Check if it looks like an ENS name
      if (toAddress.includes(".")) {
        setResolvingEns(true);
        try {
          const resolved = await ensClient.getEnsAddress({
            name: normalize(toAddress),
          });
          setResolvedAddress(resolved);
        } catch (err) {
          console.error("ENS resolution failed:", err);
          setResolvedAddress(null);
        } finally {
          setResolvingEns(false);
        }
      } else {
        setResolvedAddress(null);
      }
    };

    const timer = setTimeout(resolveAddress, 300);
    return () => clearTimeout(timer);
  }, [toAddress]);

  // Get quote when form changes
  const getQuote = useCallback(async () => {
    if (!selectedBalance || !resolvedAddress || !amount || !walletAddress) {
      setQuote(null);
      return;
    }

    // Validate resolved address
    if (!/^0x[a-fA-F0-9]{40}$/.test(resolvedAddress)) {
      setQuote(null);
      return;
    }

    // Validate amount
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setQuote(null);
      return;
    }

    // Convert amount to wei/smallest unit
    const fromAmountWei = BigInt(
      Math.floor(amountNum * 10 ** selectedBalance.decimals)
    ).toString();

    // Resolve toToken address
    let toTokenAddress = "0x0000000000000000000000000000000000000000";
    if (toTokenSymbol === "USDC") {
      toTokenAddress = USDC_BY_CHAIN[toChainId] || USDC_BY_CHAIN[8453];
    } else if (toTokenSymbol === "USDT") {
      toTokenAddress = USDT_BY_CHAIN[toChainId];
      if (toTokenAddress === "0x0000000000000000000000000000000000000000") {
        setQuoteError("USDT not available on this chain");
        return;
      }
    }

    setLoadingQuote(true);
    setQuoteError(null);

    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromChain: selectedBalance.chainId,
          toChain: toChainId,
          fromToken: selectedBalance.address,
          toToken: toTokenAddress,
          fromAmount: fromAmountWei,
          fromAddress: walletAddress,
          toAddress: resolvedAddress,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to get quote");
      }

      const data = await res.json();
      setQuote(data);
    } catch (err) {
      console.error("Quote error:", err);
      setQuoteError(err instanceof Error ? err.message : "Failed to get quote");
      setQuote(null);
    } finally {
      setLoadingQuote(false);
    }
  }, [selectedBalance, resolvedAddress, toChainId, toTokenSymbol, amount, walletAddress]);

  // Debounced quote fetching
  useEffect(() => {
    const timer = setTimeout(() => {
      getQuote();
    }, 500);
    return () => clearTimeout(timer);
  }, [getQuote]);

  // Execute transaction
  const executeSend = async () => {
    if (!quote || !activeWallet || !selectedBalance) return;

    setTxStatus("idle");
    setTxError(null);
    setTxHash(null);

    try {
      // Get provider from wallet
      const provider = await activeWallet.getEthereumProvider();

      // Switch to the correct chain first
      const requiredChainId = selectedBalance.chainId;
      const currentChainIdHex = await provider.request({ method: "eth_chainId" });
      const currentChainId = parseInt(currentChainIdHex, 16);

      if (currentChainId !== requiredChainId) {
        setTxStatus("approving"); // Reuse status for "switching chain"
        try {
          await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: `0x${requiredChainId.toString(16)}` }],
          });
        } catch (switchError: any) {
          // Chain not added to wallet, try to add it
          if (switchError.code === 4902) {
            const chainConfig = Object.values(SUPPORTED_CHAINS).find(c => c.id === requiredChainId);
            if (chainConfig) {
              await provider.request({
                method: "wallet_addEthereumChain",
                params: [{
                  chainId: `0x${requiredChainId.toString(16)}`,
                  chainName: chainConfig.displayName,
                  nativeCurrency: {
                    name: chainConfig.nativeCurrency,
                    symbol: chainConfig.nativeCurrency,
                    decimals: 18,
                  },
                  rpcUrls: [chainConfig.rpcUrl],
                  blockExplorerUrls: [chainConfig.explorerUrl],
                }],
              });
            }
          } else {
            throw switchError;
          }
        }
      }

      // Check if we need approval for non-native tokens
      if (needsApproval(selectedBalance.address)) {
        const currentAllowance = await getTokenAllowance(
          selectedBalance.address,
          walletAddress!,
          quote.estimate.approvalAddress,
          selectedBalance.chainId
        );

        const requiredAmount = BigInt(quote.action.fromAmount);

        if (currentAllowance < requiredAmount) {
          setTxStatus("approving");

          // Build and send approval tx
          const approvalTx = buildApprovalTx(
            selectedBalance.address,
            quote.estimate.approvalAddress
          );

          const approveTxHash = await provider.request({
            method: "eth_sendTransaction",
            params: [
              {
                from: walletAddress,
                to: approvalTx.to,
                data: approvalTx.data,
              },
            ],
          });

          // Wait for approval confirmation
          await waitForTx(provider, approveTxHash);
        }
      }

      // Send the main transaction
      setTxStatus("sending");

      const txHashResult = await provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: walletAddress,
            to: quote.transactionRequest.to,
            data: quote.transactionRequest.data,
            value: quote.transactionRequest.value,
            gas: quote.transactionRequest.gasLimit,
          },
        ],
      });

      setTxHash(txHashResult);
      setTxStatus("confirming");

      // Wait for confirmation
      await waitForTx(provider, txHashResult);

      setTxStatus("success");

      // Refresh balances
      setTimeout(() => fetchBalances(), 2000);
    } catch (err) {
      console.error("Transaction error:", err);
      setTxError(err instanceof Error ? err.message : "Transaction failed");
      setTxStatus("error");
    }
  };

  // Helper to wait for transaction
  async function waitForTx(provider: any, txHash: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkReceipt = async () => {
        try {
          const receipt = await provider.request({
            method: "eth_getTransactionReceipt",
            params: [txHash],
          });
          if (receipt) {
            if (receipt.status === "0x1" || receipt.status === 1) {
              resolve();
            } else {
              reject(new Error("Transaction reverted"));
            }
          } else {
            setTimeout(checkReceipt, 2000);
          }
        } catch {
          setTimeout(checkReceipt, 2000);
        }
      };
      checkReceipt();
    });
  }

  // Get chain name
  const getChainName = (chainId: number) => {
    return Object.values(SUPPORTED_CHAINS).find((c) => c.id === chainId)?.displayName || String(chainId);
  };

  // Get explorer URL for transaction
  const getExplorerTxUrl = (chainId: number, hash: string) => {
    const chain = Object.values(SUPPORTED_CHAINS).find((c) => c.id === chainId);
    if (!chain) return null;
    return `${chain.explorerUrl}/tx/${hash}`;
  };

  if (!ready || !authenticated) return null;

  return (
    <div className="mx-auto max-w-xl px-4 py-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold">Send</h1>
        <p className="text-sm text-muted-foreground">
          Send any token to anyone on any chain.
        </p>
      </div>

      {/* Source Token Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">From</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingBalances ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-16" />
              <Skeleton className="h-16 hidden sm:block" />
              <Skeleton className="h-16 hidden lg:block" />
            </div>
          ) : balances.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No tokens found. Fund your wallet to send.
            </p>
          ) : (
            <>
              {/* Mobile: Dropdown style */}
              <div className="sm:hidden">
                <button
                  onClick={() => setShowTokenPicker(!showTokenPicker)}
                  className="w-full flex items-center justify-between p-3 rounded-lg border border-border bg-background"
                >
                  {selectedBalance ? (
                    <div className="flex items-center gap-3">
                      <TokenIcon symbol={selectedBalance.symbol} address={selectedBalance.address} size={28} />
                      <div className="text-left">
                        <div className="font-medium text-sm">{selectedBalance.symbol}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <ChainIcon chainId={selectedBalance.chainId} size={10} />
                          {getChainName(selectedBalance.chainId)}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">Select token</span>
                  )}
                  <div className="flex items-center gap-2">
                    {selectedBalance && (
                      <span className="font-mono text-sm">
                        {formatTokenAmount(selectedBalance.amount, selectedBalance.decimals)}
                      </span>
                    )}
                    <svg
                      className={`h-4 w-4 text-muted-foreground transition-transform ${showTokenPicker ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                {showTokenPicker && (
                  <div className="mt-2 space-y-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-background p-1">
                    {balances.map((b, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setSelectedBalance(b);
                          setShowTokenPicker(false);
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-md text-left transition-colors ${
                          selectedBalance?.address === b.address && selectedBalance?.chainId === b.chainId
                            ? "bg-primary/10"
                            : "hover:bg-muted"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <TokenIcon symbol={b.symbol} address={b.address} size={24} />
                          <div>
                            <div className="font-medium text-sm">{b.symbol}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <ChainIcon chainId={b.chainId} size={10} />
                              {getChainName(b.chainId)}
                            </div>
                          </div>
                        </div>
                        <span className="font-mono text-xs">
                          {formatTokenAmount(b.amount, b.decimals)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Desktop: Compact grid */}
              <div className="hidden sm:grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {balances.map((b, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedBalance(b)}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border transition-colors text-left ${
                      selectedBalance?.address === b.address && selectedBalance?.chainId === b.chainId
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    }`}
                  >
                    <TokenIcon symbol={b.symbol} address={b.address} size={28} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-medium text-sm">{b.symbol}</span>
                        <span className="font-mono text-xs truncate">
                          {formatTokenAmount(b.amount, b.decimals)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <ChainIcon chainId={b.chainId} size={10} />
                        {getChainName(b.chainId)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Amount Input */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Amount</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="font-mono"
            />
            {selectedBalance && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setAmount(
                    (parseFloat(selectedBalance.amount) / 10 ** selectedBalance.decimals).toString()
                  )
                }
              >
                Max
              </Button>
            )}
          </div>
          {selectedBalance && (
            <p className="text-xs text-muted-foreground">
              Available: {formatTokenAmount(selectedBalance.amount, selectedBalance.decimals)} {selectedBalance.symbol}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recipient */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">To</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Input
              id="toAddress"
              placeholder="0x... or vitalik.eth"
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              className="font-mono"
            />
            {resolvingEns && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <span className="h-3 w-3 animate-spin rounded-full border border-muted-foreground border-t-transparent" />
                Resolving ENS name...
              </p>
            )}
            {!resolvingEns && toAddress.includes(".") && resolvedAddress && (
              <p className="text-xs text-green-600 mt-1">
                Resolved: {resolvedAddress.slice(0, 6)}...{resolvedAddress.slice(-4)}
              </p>
            )}
            {!resolvingEns && toAddress.includes(".") && !resolvedAddress && toAddress.length > 3 && (
              <p className="text-xs text-destructive mt-1">
                Could not resolve ENS name
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Chain</Label>
              <div className="mt-1">
                <ChainSelect
                  value={toChainId}
                  onChange={setToChainId}
                  options={Object.values(SUPPORTED_CHAINS).map((chain) => ({
                    value: chain.id,
                    label: chain.displayName,
                    chainId: chain.id,
                  }))}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Token</Label>
              <div className="mt-1">
                <TokenSelect
                  value={toTokenSymbol}
                  onChange={setToTokenSymbol}
                  options={RECEIVE_TOKENS.map((token) => ({
                    value: token.symbol,
                    label: token.symbol,
                    symbol: token.symbol,
                  }))}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quote Preview */}
      {(loadingQuote || quote || quoteError) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Quote</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingQuote ? (
              <div className="flex items-center gap-2 py-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-sm text-muted-foreground">Finding best route...</span>
              </div>
            ) : quoteError ? (
              <div className="py-2 text-center">
                <p className="text-sm text-destructive">{quoteError}</p>
              </div>
            ) : quote ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Receives</span>
                  <span className="font-mono font-medium flex items-center gap-1">
                    <TokenIcon symbol={quote.action.toToken.symbol} size={14} />
                    {(parseFloat(quote.estimate.toAmountMin) / 10 ** quote.action.toToken.decimals).toFixed(
                      quote.action.toToken.decimals > 8 ? 6 : 2
                    )}{" "}
                    {quote.action.toToken.symbol}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Route</span>
                  <Badge variant="outline" className="text-xs">{quote.tool}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Fees</span>
                  <span>
                    ${(
                      quote.estimate.feeCosts.reduce((sum, f) => sum + parseFloat(f.amountUSD || "0"), 0) +
                      quote.estimate.gasCosts.reduce((sum, g) => sum + parseFloat(g.amountUSD || "0"), 0)
                    ).toFixed(2)}
                  </span>
                </div>
                {quote.estimate.executionDuration > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Time</span>
                    <span>~{Math.ceil(quote.estimate.executionDuration / 60)} min</span>
                  </div>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Transaction Status */}
      {txStatus !== "idle" && (
        <Card>
          <CardContent className="py-4">
            {txStatus === "approving" && (
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span>Approving token spend...</span>
              </div>
            )}
            {txStatus === "sending" && (
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span>Sending transaction...</span>
              </div>
            )}
            {txStatus === "confirming" && (
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span>Waiting for confirmation...</span>
              </div>
            )}
            {txStatus === "success" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-600">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium">Transaction successful!</span>
                </div>
                {txHash && selectedBalance && (
                  <a
                    href={getExplorerTxUrl(selectedBalance.chainId, txHash) || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <span className="font-mono">
                      {txHash.slice(0, 10)}...{txHash.slice(-8)}
                    </span>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
            )}
            {txStatus === "error" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-destructive">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="font-medium">Transaction failed</span>
                </div>
                {txError && <p className="text-sm text-muted-foreground">{txError}</p>}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Send Button */}
      <Button
        size="lg"
        className="w-full"
        disabled={!quote || loadingQuote || txStatus === "approving" || txStatus === "sending" || txStatus === "confirming"}
        onClick={executeSend}
      >
        {txStatus === "approving"
          ? "Approving..."
          : txStatus === "sending"
          ? "Sending..."
          : txStatus === "confirming"
          ? "Confirming..."
          : `Send ${amount || "0"} ${selectedBalance?.symbol || "tokens"}`}
      </Button>
    </div>
  );
}
