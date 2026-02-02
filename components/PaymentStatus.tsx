"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getExplorerTxUrl } from "@/lib/chains";
import type { PaymentStatus as PaymentStatusType } from "@/lib/types";

interface PaymentStatusProps {
  status: PaymentStatusType;
  txHash: string | null;
  chainName: string;
  onReset: () => void;
}

const statusConfig: Record<
  PaymentStatusType,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pending: { label: "Pending", variant: "outline" },
  executing: { label: "Executing", variant: "secondary" },
  completed: { label: "Completed", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
};

export default function PaymentStatus({
  status,
  txHash,
  chainName,
  onReset,
}: PaymentStatusProps) {
  const config = statusConfig[status];
  const explorerUrl = txHash ? getExplorerTxUrl(chainName, txHash) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Payment Status
          <Badge variant={config.variant}>{config.label}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === "executing" && (
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">
              Transaction is being processed...
            </p>
          </div>
        )}

        {status === "completed" && (
          <p className="text-sm text-green-600 dark:text-green-400">
            Payment sent successfully.
          </p>
        )}

        {status === "failed" && (
          <p className="text-sm text-destructive">
            Payment failed. Please try again.
          </p>
        )}

        {txHash && (
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Transaction Hash</p>
            <p className="break-all font-mono text-xs">{txHash}</p>
            {explorerUrl && (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary underline hover:no-underline"
              >
                View on Explorer
              </a>
            )}
          </div>
        )}

        <Button onClick={onReset} variant="outline" className="w-full">
          {status === "completed" ? "Pay Another Invoice" : "Try Again"}
        </Button>
      </CardContent>
    </Card>
  );
}
