"use client";

import { useEffect, useState, useCallback } from "react";
import { useWallets } from "@privy-io/react-auth";
import { createPublicClient, http } from "viem";
import { normalize } from "viem/ens";
import { mainnet } from "viem/chains";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <div className="px-3 py-2 text-sm text-muted-foreground">
        Connect your wallet to send payments.
      </div>
    );
  }

  // Success state
  if (txStatus === "success") {
    return (
      <div className="px-3 py-2 space-y-1">
        <div className="flex items-center gap-2 text-green-600 text-sm">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="font-medium">Payment sent!</span>
        </div>
        {txHash && selectedBalance && (
          <a
            href={getExplorerTxUrl(selectedBalance.chainId, txHash) || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            View on explorer
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="px-3 py-2 space-y-2 text-sm">
      {/* Row 1: Amount + Source token/chain */}
      <div className="flex items-center gap-2">
        <Input
          type="number"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="font-mono h-7 text-sm w-20"
        />
        {loadingBalances ? (
          <div className="h-6 w-24 bg-muted animate-pulse rounded" />
        ) : balances.length > 0 ? (
          <select
            className="h-7 text-xs px-2 rounded border border-border bg-background flex-1 min-w-0"
            value={selectedBalance ? `${selectedBalance.chainId}-${selectedBalance.address}` : ""}
            onChange={(e) => {
              const [chainId, address] = e.target.value.split("-");
              const bal = balances.find((b) => b.chainId === parseInt(chainId) && b.address === address);
              if (bal) setSelectedBalance(bal);
            }}
          >
            {balances.map((b, i) => (
              <option key={i} value={`${b.chainId}-${b.address}`}>
                {b.symbol} on {getChainName(b.chainId)} ({formatTokenAmount(b.amount, b.decimals)})
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-muted-foreground">No tokens</span>
        )}
      </div>

      {/* Row 2: Recipient */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">to</span>
          <Input
            placeholder="0x... or name.eth"
            value={toAddress}
            onChange={(e) => setToAddress(e.target.value)}
            className="font-mono h-7 text-sm flex-1"
          />
          {resolvingEns && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          )}
          {!resolvingEns && toAddress.length > 0 && resolvedAddress && (
            <svg className="h-4 w-4 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {!resolvingEns && toAddress.length > 2 && !resolvedAddress && (
            <svg className="h-4 w-4 text-destructive shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>
        {!resolvingEns && toAddress.includes(".") && resolvedAddress && (
          <p className="text-xs text-green-600 font-mono">
            {resolvedAddress}
          </p>
        )}
        {!resolvingEns && toAddress.includes(".") && toAddress.length > 3 && !resolvedAddress && (
          <p className="text-xs text-destructive">
            Could not resolve ENS name
          </p>
        )}
      </div>

      {/* Row 3: Destination */}
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs">as</span>
        <TokenSelect
          value={toTokenSymbol}
          onChange={setToTokenSymbol}
          options={RECEIVE_TOKENS.map((token) => ({
            value: token.symbol,
            label: token.symbol,
            symbol: token.symbol,
          }))}
        />
        <span className="text-muted-foreground text-xs">on</span>
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

      {/* Row 4: Quote + Send */}
      <div className="flex items-center gap-2">
        {loadingQuote && (
          <>
            <div className="h-3 w-3 animate-spin rounded-full border border-muted-foreground border-t-transparent" />
            <span className="text-xs text-muted-foreground">Finding route...</span>
          </>
        )}
        {quote && !loadingQuote && (
          <span className="text-xs text-muted-foreground">
            Receives ~{(parseFloat(quote.estimate.toAmountMin) / 10 ** quote.action.toToken.decimals).toFixed(2)} {quote.action.toToken.symbol} (${(
              quote.estimate.feeCosts.reduce((sum, f) => sum + parseFloat(f.amountUSD || "0"), 0) +
              quote.estimate.gasCosts.reduce((sum, g) => sum + parseFloat(g.amountUSD || "0"), 0)
            ).toFixed(2)} fee)
          </span>
        )}
        <div className="flex-1" />
        <Button
          size="sm"
          className="h-7 px-4"
          disabled={!quote || loadingQuote || ["approving", "sending", "confirming"].includes(txStatus)}
          onClick={executeSend}
        >
          {txStatus === "approving" ? "Approving..." :
           txStatus === "sending" ? "Sending..." :
           txStatus === "confirming" ? "Confirming..." :
           "Send"}
        </Button>
        {onCancel && (
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onCancel} disabled={["approving", "sending", "confirming"].includes(txStatus)}>
            x
          </Button>
        )}
      </div>

      {/* Status/Error row - only show if needed */}
      {quoteError && <p className="text-xs text-destructive">{quoteError}</p>}
      {txStatus !== "idle" && (
        <div className="flex items-center gap-2 text-xs">
          {txStatus === "error" ? (
            <span className="text-destructive">{txError || "Failed"}</span>
          ) : (
            <>
              <div className="h-3 w-3 animate-spin rounded-full border border-primary border-t-transparent" />
              <span>
                {txStatus === "approving" && "Approving token..."}
                {txStatus === "sending" && "Sending..."}
                {txStatus === "confirming" && "Confirming..."}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
