"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ParsedPaymentIntent } from "@/lib/types";

interface PaymentChatProps {
  onParsed: (intent: ParsedPaymentIntent) => void;
}

export function PaymentChat({ onParsed }: PaymentChatProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleParse = async () => {
    if (!input.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/parse-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: input.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to parse");
      }

      const intent: ParsedPaymentIntent = await res.json();

      if (intent.missingFields.length === 3) {
        setError("Could not understand the payment request. Try something like 'send 10 usdc to vitalik.eth'");
        return;
      }

      onParsed(intent);
      setInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse payment intent");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleParse();
    }
  };

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="space-y-3">
          <div className="relative">
            <Textarea
              placeholder='Try "send 10 usdc to vitalik.eth" or "pay $50 from arbitrum to alice.eth on base"'
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[60px] pr-20 resize-none"
              disabled={loading}
            />
            <Button
              size="sm"
              onClick={handleParse}
              disabled={loading || !input.trim()}
              className="absolute bottom-2 right-2"
            >
              {loading ? (
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
                  Parsing
                </span>
              ) : (
                "Parse"
              )}
            </Button>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <p className="text-xs text-muted-foreground">
            Describe your payment in natural language. Supports ETH, USDC, USDT, DAI on Ethereum, Arbitrum, Optimism, Polygon, Base.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
