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
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Send</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Send any token to anyone on any chain. We handle the swap and bridge.
        </p>
      </div>

      {/* Source Token Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">From</CardTitle>
          <CardDescription>Select which token to send from</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingBalances ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : balances.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No tokens found. Fund your wallet to send.
            </p>
          ) : (
            <div className="grid gap-2">
              {balances.map((b, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedBalance(b)}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors text-left ${
                    selectedBalance?.address === b.address && selectedBalance?.chainId === b.chainId
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                      {b.symbol.slice(0, 2)}
                    </div>
                    <div>
                      <div className="font-medium">{b.symbol}</div>
                      <div className="text-xs text-muted-foreground">
                        on {getChainName(b.chainId)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm">
                      {formatTokenAmount(b.amount, b.decimals)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Amount Input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Amount</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-lg font-mono"
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
            <p className="text-xs text-muted-foreground mt-2">
              Available: {formatTokenAmount(selectedBalance.amount, selectedBalance.decimals)}{" "}
              {selectedBalance.symbol}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recipient */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">To</CardTitle>
          <CardDescription>Recipient address and what they receive</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="toAddress">Recipient Address</Label>
            <Input
              id="toAddress"
              placeholder="0x... or vitalik.eth"
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              className="font-mono mt-1"
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Destination Chain</Label>
              <select
                value={toChainId}
                onChange={(e) => setToChainId(Number(e.target.value))}
                className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {Object.values(SUPPORTED_CHAINS).map((chain) => (
                  <option key={chain.id} value={chain.id}>
                    {chain.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Receive Token</Label>
              <select
                value={toTokenSymbol}
                onChange={(e) => setToTokenSymbol(e.target.value)}
                className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {RECEIVE_TOKENS.map((token) => (
                  <option key={token.symbol} value={token.symbol}>
                    {token.symbol}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quote Preview */}
      {(loadingQuote || quote || quoteError) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quote</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingQuote ? (
              <div className="flex items-center gap-2 py-4">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-sm text-muted-foreground">Finding best route...</span>
              </div>
            ) : quoteError ? (
              <div className="py-4 text-center">
                <p className="text-sm text-destructive">{quoteError}</p>
              </div>
            ) : quote ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Recipient receives</span>
                  <span className="font-mono font-medium">
                    {(parseFloat(quote.estimate.toAmountMin) / 10 ** quote.action.toToken.decimals).toFixed(
                      quote.action.toToken.decimals > 8 ? 6 : 2
                    )}{" "}
                    {quote.action.toToken.symbol}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Route</span>
                  <Badge variant="outline">{quote.tool}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Estimated fees</span>
                  <span className="text-sm">
                    $
                    {(
                      quote.estimate.feeCosts.reduce((sum, f) => sum + parseFloat(f.amountUSD || "0"), 0) +
                      quote.estimate.gasCosts.reduce((sum, g) => sum + parseFloat(g.amountUSD || "0"), 0)
                    ).toFixed(2)}
                  </span>
                </div>
                {quote.estimate.executionDuration > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Est. time</span>
                    <span className="text-sm">~{Math.ceil(quote.estimate.executionDuration / 60)} min</span>
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
