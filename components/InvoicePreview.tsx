"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SUPPORTED_CHAINS, SUPPORTED_TOKENS } from "@/lib/chains";
import type { ParsedInvoice } from "@/lib/types";

interface InvoicePreviewProps {
  data: ParsedInvoice;
  onChange: (data: ParsedInvoice) => void;
  onConfirm: () => void;
  isResolving?: boolean;
  isConfirming?: boolean;
}

export default function InvoicePreview({
  data,
  onChange,
  onConfirm,
  isResolving,
  isConfirming,
}: InvoicePreviewProps) {
  const [edited, setEdited] = useState<ParsedInvoice>(data);

  useEffect(() => {
    setEdited(data);
  }, [data]);

  const update = (field: keyof ParsedInvoice, value: string | null) => {
    const next = { ...edited, [field]: value };
    setEdited(next);
    onChange(next);
  };

  const isEns = edited.recipientAddress?.endsWith(".eth");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Invoice Details
          {isEns && (
            <Badge variant="secondary">
              {isResolving ? "Resolving ENS..." : "ENS Name"}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="recipientName">Recipient Name</Label>
            <Input
              id="recipientName"
              value={edited.recipientName}
              onChange={(e) => update("recipientName", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recipientAddress">
              Wallet Address / ENS
            </Label>
            <Input
              id="recipientAddress"
              value={edited.recipientAddress}
              onChange={(e) => update("recipientAddress", e.target.value)}
              placeholder="0x... or name.eth"
            />
            {edited.resolvedAddress && (
              <p className="text-xs text-muted-foreground font-mono">
                Resolved: {edited.resolvedAddress}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="text"
              value={edited.amount}
              onChange={(e) => update("amount", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="token">Token</Label>
            <select
              id="token"
              value={edited.token}
              onChange={(e) => update("token", e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {Object.keys(SUPPORTED_TOKENS).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="chain">Chain</Label>
            <select
              id="chain"
              value={edited.chain}
              onChange={(e) => update("chain", e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {Object.values(SUPPORTED_CHAINS).map((c) => (
                <option key={c.name} value={c.name}>
                  {c.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="memo">Memo</Label>
          <Input
            id="memo"
            value={edited.memo}
            onChange={(e) => update("memo", e.target.value)}
          />
        </div>

        {edited.dueDate && (
          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date</Label>
            <Input
              id="dueDate"
              type="date"
              value={edited.dueDate?.split("T")[0] || ""}
              onChange={(e) => update("dueDate", e.target.value)}
            />
          </div>
        )}

        <Button
          onClick={onConfirm}
          disabled={
            !edited.recipientAddress ||
            !edited.amount ||
            edited.amount === "0" ||
            isConfirming
          }
          className="w-full"
          size="lg"
        >
          {isConfirming ? "Processing..." : "Review & Pay"}
        </Button>
      </CardContent>
    </Card>
  );
}
