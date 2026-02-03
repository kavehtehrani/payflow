"use client";

import { useEffect, useState } from "react";
import { useWallets } from "@privy-io/react-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TokenIcon, ChainIcon } from "@/components/TokenIcon";
import { SUPPORTED_CHAINS } from "@/lib/chains";
import { getWalletBalances, getChainDisplayName, formatTokenAmount, type WalletTokenBalance } from "@/lib/lifi";

export default function WalletBalance() {
  const { wallets, ready } = useWallets();
  const [balances, setBalances] = useState<WalletTokenBalance[]>([]);
  const [loading, setLoading] = useState(false);

  // Use the first connected wallet's address (external wallets like MetaMask take priority)
  const activeWallet = wallets.find(
    (w) => w.walletClientType !== "privy"
  ) || wallets[0];
  const walletAddress = activeWallet?.address;

  useEffect(() => {
    if (!ready || !walletAddress) return;

    let cancelled = false;

    async function fetchBalances() {
      setLoading(true);
      try {
        const chainIds = Object.values(SUPPORTED_CHAINS).map((c) => c.id);
        console.log("[WalletBalance] Fetching for address:", walletAddress, "chains:", chainIds);
        const result = await getWalletBalances(walletAddress!, chainIds);
        console.log("[WalletBalance] Got balances:", result);
        if (!cancelled) setBalances(result);
      } catch (err) {
        console.error("[WalletBalance] Error fetching balances:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchBalances();
    return () => {
      cancelled = true;
    };
  }, [ready, walletAddress]);

  if (!ready || !walletAddress) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>Your Balances</span>
          <span className="text-xs font-mono text-muted-foreground font-normal">
            {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            {activeWallet?.walletClientType && activeWallet.walletClientType !== "privy" && (
              <span className="ml-2 text-muted-foreground/70">
                ({activeWallet.walletClientType})
              </span>
            )}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        ) : balances.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No token balances found. Fund your wallet to make payments.
          </p>
        ) : (
          <div className="space-y-2">
            {balances.slice(0, 10).map((b, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <TokenIcon symbol={b.symbol} address={b.address} size={20} />
                  <span className="font-medium">{b.symbol}</span>
                  <span className="text-muted-foreground text-xs flex items-center gap-1">
                    <ChainIcon chainId={b.chainId} size={12} />
                    {getChainDisplayName(b.chainId)}
                  </span>
                </div>
                <span className="font-mono">
                  {formatTokenAmount(b.amount, b.decimals)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
