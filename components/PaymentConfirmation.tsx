"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { ParsedInvoice } from "@/lib/types";
import { getChainByName } from "@/lib/chains";

interface PaymentConfirmationProps {
  invoice: ParsedInvoice;
  quote: {
    fromChain: string;
    toChain: string;
    fromToken: string;
    toToken: string;
    fromAmount: string;
    toAmount: string;
    estimatedGas: string;
    toolName: string;
  } | null;
  onConfirm: () => void;
  onCancel: () => void;
  isExecuting: boolean;
}

export default function PaymentConfirmation({
  invoice,
  quote,
  onConfirm,
  onCancel,
  isExecuting,
}: PaymentConfirmationProps) {
  const toChain = getChainByName(invoice.chain);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Confirm Payment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Recipient</span>
            <span className="font-medium">{invoice.recipientName || "Unknown"}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">To Address</span>
            <span className="font-mono text-xs">
              {invoice.resolvedAddress || invoice.recipientAddress}
            </span>
          </div>
          {invoice.recipientAddress?.endsWith(".eth") && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">ENS Name</span>
              <Badge variant="secondary">{invoice.recipientAddress}</Badge>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Amount</span>
            <span className="font-medium">
              {invoice.amount} {invoice.token}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Destination Chain</span>
            <span>{toChain?.displayName || invoice.chain}</span>
          </div>
        </div>

        {quote && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-medium">Route Details</p>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Route</span>
                <span>
                  {quote.fromChain} → {quote.toChain}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Bridge/DEX</span>
                <span>{quote.toolName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">You Send</span>
                <span>
                  {quote.fromAmount} {quote.fromToken}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">They Receive</span>
                <span>
                  {quote.toAmount} {quote.toToken}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Estimated Gas</span>
                <span>{quote.estimatedGas}</span>
              </div>
            </div>
          </>
        )}

        <Separator />

        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel} disabled={isExecuting} className="flex-1">
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isExecuting || !quote} className="flex-1">
            {isExecuting ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Sending...
              </span>
            ) : (
              "Confirm & Pay"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
