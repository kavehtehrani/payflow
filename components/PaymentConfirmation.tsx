"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TokenIcon } from "@/components/TokenIcon";
import type { ParsedInvoice } from "@/lib/types";
import type { QuoteDisplay } from "@/app/upload/page";

interface PaymentConfirmationProps {
  invoice: ParsedInvoice;
  quote: QuoteDisplay;
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Confirm Payment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Recipient details */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Recipient</span>
            <span className="font-medium">{invoice.recipientName || "Unknown"}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">To Address</span>
            <span className="font-mono text-xs max-w-[200px] truncate">
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
            <span className="font-medium flex items-center gap-1">
              <TokenIcon symbol={invoice.token || "ETH"} size={16} />
              {invoice.amount} {invoice.token}
            </span>
          </div>
        </div>

        <Separator />

        {/* Route details from LI.FI */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">Route via LI.FI</p>
            <Badge variant="outline" className="text-xs">
              {quote.bridgeName}
            </Badge>
          </div>

          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Path</span>
              <span>
                {quote.fromChain}
                {quote.fromChainId !== quote.toChainId ? ` → ${quote.toChain}` : ""}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">You send</span>
              <span className="font-medium flex items-center gap-1">
                <TokenIcon symbol={quote.fromToken} size={16} />
                {quote.fromAmount} {quote.fromToken}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">They receive</span>
              <span className="font-medium flex items-center gap-1">
                <TokenIcon symbol={quote.toToken} size={16} />
                {quote.toAmount} {quote.toToken}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Minimum received</span>
              <span className="flex items-center gap-1">
                <TokenIcon symbol={quote.toToken} size={16} />
                {quote.toAmountMin} {quote.toToken}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Estimated gas</span>
              <span>{quote.gasCostUSD}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Estimated time</span>
              <span>{quote.estimatedTime}</span>
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel} disabled={isExecuting} className="flex-1">
            Back
          </Button>
          <Button onClick={onConfirm} disabled={isExecuting} className="flex-1">
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
