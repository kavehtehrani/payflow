"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SUPPORTED_CHAINS } from "@/lib/chains";
import { getWalletBalances, getChainDisplayName, type WalletTokenBalance } from "@/lib/lifi";

interface WalletBalanceProps {
  walletAddress: string | undefined;
}

export default function WalletBalance({ walletAddress }: WalletBalanceProps) {
  const [balances, setBalances] = useState<WalletTokenBalance[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!walletAddress) return;

    let cancelled = false;

    async function fetchBalances() {
      setLoading(true);
      try {
        const chainIds = Object.values(SUPPORTED_CHAINS).map((c) => c.id);
        const result = await getWalletBalances(walletAddress!, chainIds);
        if (!cancelled) setBalances(result);
      } catch {
        // Silently fail - balances are informational
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchBalances();
    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

  if (!walletAddress) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Your Balances</CardTitle>
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
                <div>
                  <span className="font-medium">{b.symbol}</span>
                  <span className="ml-2 text-muted-foreground text-xs">
                    on {getChainDisplayName(b.chainId)}
                  </span>
                </div>
                <span className="font-mono">
                  {parseFloat(b.amount).toFixed(4)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
