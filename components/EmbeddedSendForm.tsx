"use client";

import { useEffect, useState, useCallback } from "react";
import { useWallets } from "@privy-io/react-auth";
import { createPublicClient, http } from "viem";
import { normalize } from "viem/ens";
import { mainnet } from "viem/chains";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { ParsedPaymentIntent } from "@/lib/types";

const ensClient = createPublicClient({
  chain: mainnet,
  transport: http("https://eth.drpc.org"),
});

const RECEIVE_TOKENS = [
  { symbol: "ETH", address: "0x0000000000000000000000000000000000000000", decimals: 18 },
  { symbol: "USDC", address: "USDC", decimals: 6 },
  { symbol: "USDT", address: "USDT", decimals: 6 },
];

const USDC_BY_CHAIN: Record<number, string> = {
  1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  10: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  137: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
};

const USDT_BY_CHAIN: Record<number, string> = {
  1: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  42161: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  10: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
  137: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  8453: "0x0000000000000000000000000000000000000000",
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

interface EmbeddedSendFormProps {
  intent: ParsedPaymentIntent;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function EmbeddedSendForm({ intent, onSuccess, onCancel }: EmbeddedSendFormProps) {
  const { wallets } = useWallets();
  const activeWallet = wallets.find((w) => w.walletClientType !== "privy") || wallets[0];
  const walletAddress = activeWallet?.address;

  const [balances, setBalances] = useState<WalletTokenBalance[]>([]);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [selectedBalance, setSelectedBalance] = useState<WalletTokenBalance | null>(null);

  const [toAddress, setToAddress] = useState(intent.recipient || "");
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [resolvingEns, setResolvingEns] = useState(false);
  const [toChainId, setToChainId] = useState<number>(8453);
  const [toTokenSymbol, setToTokenSymbol] = useState(intent.token || "USDC");
  const [amount, setAmount] = useState(intent.amount || "");

  const [quote, setQuote] = useState<Quote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  // Fetch balances
  const fetchBalances = useCallback(async () => {
    if (!walletAddress) return;
    setLoadingBalances(true);
    try {
      const chainIds = Object.values(SUPPORTED_CHAINS).map((c) => c.id);
      const result = await getWalletBalances(walletAddress, chainIds);
      setBalances(result);
    } catch (err) {
      console.error("Failed to fetch balances:", err);
    } finally {
      setLoadingBalances(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    if (walletAddress) fetchBalances();
  }, [walletAddress, fetchBalances]);

  // Auto-select balance based on intent
  useEffect(() => {
    if (balances.length === 0) return;

    const targetToken = (intent.token || "USDC").toUpperCase();

    if (intent.fromChain) {
      const sourceChain = Object.values(SUPPORTED_CHAINS).find(
        (c) => c.name.toLowerCase() === intent.fromChain!.toLowerCase()
      );
      if (sourceChain) {
        const match = balances.find(
          (b) => b.chainId === sourceChain.id && b.symbol.toUpperCase() === targetToken
        );
        if (match) {
          setSelectedBalance(match);
          return;
        }
      }
    }

    // Fallback: find first balance with matching token
    const match = balances.find((b) => b.symbol.toUpperCase() === targetToken);
    if (match) setSelectedBalance(match);
    else if (balances.length > 0) setSelectedBalance(balances[0]);
  }, [balances, intent.fromChain, intent.token]);

  // Set destination chain from intent
  useEffect(() => {
    if (intent.destinationChain) {
      const destChain = Object.values(SUPPORTED_CHAINS).find(
        (c) => c.name.toLowerCase() === intent.destinationChain!.toLowerCase()
      );
      if (destChain) setToChainId(destChain.id);
    }
  }, [intent.destinationChain]);

  // Resolve ENS names
  useEffect(() => {
    const resolveAddress = async () => {
      if (/^0x[a-fA-F0-9]{40}$/.test(toAddress)) {
        setResolvedAddress(toAddress);
        return;
      }
      if (toAddress.includes(".")) {
        setResolvingEns(true);
        try {
          const resolved = await ensClient.getEnsAddress({ name: normalize(toAddress) });
          setResolvedAddress(resolved);
        } catch {
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

  // Get quote
  const getQuote = useCallback(async () => {
    if (!selectedBalance || !resolvedAddress || !amount || !walletAddress) {
      setQuote(null);
      return;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(resolvedAddress)) {
      setQuote(null);
      return;
    }
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setQuote(null);
      return;
    }

    const fromAmountWei = BigInt(Math.floor(amountNum * 10 ** selectedBalance.decimals)).toString();

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
      setQuoteError(err instanceof Error ? err.message : "Failed to get quote");
      setQuote(null);
    } finally {
      setLoadingQuote(false);
    }
  }, [selectedBalance, resolvedAddress, toChainId, toTokenSymbol, amount, walletAddress]);

  useEffect(() => {
    const timer = setTimeout(getQuote, 500);
    return () => clearTimeout(timer);
  }, [getQuote]);

  // Execute transaction
  const executeSend = async () => {
    if (!quote || !activeWallet || !selectedBalance) return;

    setTxStatus("idle");
    setTxError(null);
    setTxHash(null);

    try {
      const provider = await activeWallet.getEthereumProvider();
      const requiredChainId = selectedBalance.chainId;
      const currentChainIdHex = await provider.request({ method: "eth_chainId" });
      const currentChainId = parseInt(currentChainIdHex, 16);

      if (currentChainId !== requiredChainId) {
        setTxStatus("approving");
        try {
          await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: `0x${requiredChainId.toString(16)}` }],
          });
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            const chainConfig = Object.values(SUPPORTED_CHAINS).find((c) => c.id === requiredChainId);
            if (chainConfig) {
              await provider.request({
                method: "wallet_addEthereumChain",
                params: [{
                  chainId: `0x${requiredChainId.toString(16)}`,
                  chainName: chainConfig.displayName,
                  nativeCurrency: { name: chainConfig.nativeCurrency, symbol: chainConfig.nativeCurrency, decimals: 18 },
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
          const approvalTx = buildApprovalTx(selectedBalance.address, quote.estimate.approvalAddress);
          const approveTxHash = await provider.request({
            method: "eth_sendTransaction",
            params: [{ from: walletAddress, to: approvalTx.to, data: approvalTx.data }],
          });
          await waitForTx(provider, approveTxHash);
        }
      }

      setTxStatus("sending");
      const txHashResult = await provider.request({
        method: "eth_sendTransaction",
        params: [{
          from: walletAddress,
          to: quote.transactionRequest.to,
          data: quote.transactionRequest.data,
          value: quote.transactionRequest.value,
          gas: quote.transactionRequest.gasLimit,
        }],
      });

      setTxHash(txHashResult);
      setTxStatus("confirming");
      await waitForTx(provider, txHashResult);
      setTxStatus("success");
      onSuccess?.();
    } catch (err) {
      console.error("Transaction error:", err);
      setTxError(err instanceof Error ? err.message : "Transaction failed");
      setTxStatus("error");
    }
  };

  async function waitForTx(provider: any, txHash: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkReceipt = async () => {
        try {
          const receipt = await provider.request({ method: "eth_getTransactionReceipt", params: [txHash] });
          if (receipt) {
            if (receipt.status === "0x1" || receipt.status === 1) resolve();
            else reject(new Error("Transaction reverted"));
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

  const getChainName = (chainId: number) =>
    Object.values(SUPPORTED_CHAINS).find((c) => c.id === chainId)?.displayName || String(chainId);

  const getExplorerTxUrl = (chainId: number, hash: string) => {
    const chain = Object.values(SUPPORTED_CHAINS).find((c) => c.id === chainId);
    return chain ? `${chain.explorerUrl}/tx/${hash}` : null;
  };

  if (!walletAddress) {
    return (
      <div className="p-3 text-sm text-muted-foreground">
        Connect your wallet to send payments.
      </div>
    );
  }

  // Success state
  if (txStatus === "success") {
    return (
      <div className="p-3 space-y-2">
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
            View on explorer
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      {/* Send from */}
      <fieldset className="rounded-lg border border-border p-3 pt-2">
        <legend className="px-2 text-xs font-medium text-muted-foreground">Send from</legend>
        {loadingBalances ? (
          <div className="h-10 bg-muted animate-pulse rounded" />
        ) : balances.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {balances.slice(0, 4).map((b, i) => (
              <button
                key={i}
                onClick={() => setSelectedBalance(b)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-left text-sm transition-colors ${
                  selectedBalance?.address === b.address && selectedBalance?.chainId === b.chainId
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                }`}
              >
                <TokenIcon symbol={b.symbol} address={b.address} size={20} />
                <div>
                  <div className="font-medium text-xs">{b.symbol}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <ChainIcon chainId={b.chainId} size={8} />
                    {getChainName(b.chainId)}
                  </div>
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  {formatTokenAmount(b.amount, b.decimals)}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No tokens found</p>
        )}
      </fieldset>

      {/* Send to */}
      <fieldset className="rounded-lg border border-border p-3 pt-2">
        <legend className="px-2 text-xs font-medium text-muted-foreground">Send to</legend>
        <div className="space-y-2">
          {/* Address row */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="0x... or vitalik.eth"
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              className="font-mono flex-1"
            />
            {resolvingEns && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            )}
            {!resolvingEns && toAddress.length > 0 && resolvedAddress && (
              <svg className="h-5 w-5 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {!resolvingEns && toAddress.length > 2 && !resolvedAddress && (
              <svg className="h-5 w-5 text-destructive shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
          {!resolvingEns && toAddress.includes(".") && resolvedAddress && (
            <p className="text-xs text-green-600 font-mono text-left">{resolvedAddress}</p>
          )}
          {!resolvingEns && toAddress.includes(".") && toAddress.length > 3 && !resolvedAddress && (
            <p className="text-xs text-destructive text-left">Could not resolve ENS name</p>
          )}

          {/* Amount + Chain + Token row - equal width columns */}
          <div className="grid grid-cols-3 gap-2">
            <div className="flex items-center gap-1">
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="font-mono h-8 w-full"
              />
              {selectedBalance && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-xs shrink-0"
                  onClick={() =>
                    setAmount((parseFloat(selectedBalance.amount) / 10 ** selectedBalance.decimals).toString())
                  }
                >
                  Max
                </Button>
              )}
            </div>
            <div className="w-full">
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
            <div className="w-full">
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
      </fieldset>

      {/* Quote + Actions row */}
      <div className="flex items-center gap-3 justify-between">
        <div className="flex items-center gap-3 text-xs flex-wrap">
          {loadingQuote && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
              <span>Finding route...</span>
            </div>
          )}
          {quoteError && <span className="text-destructive">{quoteError}</span>}
          {quote && !loadingQuote && (
            <>
              <span className="flex items-center gap-1">
                <span className="text-muted-foreground">Receives</span>
                <TokenIcon symbol={quote.action.toToken.symbol} size={14} />
                <span className="font-mono font-medium">
                  {(parseFloat(quote.estimate.toAmountMin) / 10 ** quote.action.toToken.decimals).toFixed(2)} {quote.action.toToken.symbol}
                </span>
              </span>
              <span className="text-muted-foreground">
                Fee ${(
                  quote.estimate.feeCosts.reduce((sum, f) => sum + parseFloat(f.amountUSD || "0"), 0) +
                  quote.estimate.gasCosts.reduce((sum, g) => sum + parseFloat(g.amountUSD || "0"), 0)
                ).toFixed(2)}
              </span>
              {quote.estimate.executionDuration > 0 && (
                <span className="text-muted-foreground">
                  ~{Math.ceil(quote.estimate.executionDuration / 60)} min
                </span>
              )}
              <span className="relative group">
                <span className="text-muted-foreground cursor-help border-b border-dotted border-muted-foreground">?</span>
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-popover border border-border rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  Route: {quote.tool}
                </span>
              </span>
            </>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 shrink-0 w-48">
          <Button
            className="col-span-2"
            disabled={!quote || loadingQuote || ["approving", "sending", "confirming"].includes(txStatus)}
            onClick={executeSend}
          >
            {txStatus === "approving" ? "Approving..." :
             txStatus === "sending" ? "Sending..." :
             txStatus === "confirming" ? "Confirming..." :
             "Send"}
          </Button>
          {onCancel && (
            <Button variant="outline" onClick={onCancel} disabled={["approving", "sending", "confirming"].includes(txStatus)}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Transaction Status - only show errors */}
      {txStatus === "error" && (
        <p className="text-xs text-destructive">{txError || "Transaction failed"}</p>
      )}
    </div>
  );
}
