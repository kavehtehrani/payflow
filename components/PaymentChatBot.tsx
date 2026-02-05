"use client";

import { useState, useRef, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmbeddedSendForm } from "@/components/EmbeddedSendForm";
import type { ParsedPaymentIntent, ParsedInvoice } from "@/lib/types";

interface Message {
  id: string;
  role: "assistant" | "user";
  content: string;
  intent?: ParsedPaymentIntent;
  showForm?: boolean;
  fileName?: string;
  filePreview?: string;
}

export function PaymentChatBot() {
  const { ready, authenticated, login } = usePrivy();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "How can I help you with your payments today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/parse-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: userMessage.content }),
      });

      if (!res.ok) {
        throw new Error("Failed to parse");
      }

      const intent: ParsedPaymentIntent = await res.json();

      // Build response message
      let responseContent = "";
      if (intent.missingFields.length === 3) {
        responseContent = "I couldn't understand that. Try something like \"send 10 USDC to vitalik.eth\" or \"pay $50 to alice.eth on Base\".";
        setMessages((prev) => [
          ...prev,
          { id: Date.now().toString(), role: "assistant", content: responseContent },
        ]);
      } else if (intent.missingFields.length > 0) {
        const missing = intent.missingFields.join(", ");
        responseContent = `I understood some of that, but I'm missing: ${missing}. Let me show you the form so you can fill in the details.`;
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: responseContent,
            intent,
            showForm: true,
          },
        ]);
      } else {
        // All fields present
        const tokenDisplay = intent.token || "tokens";
        const fromChainDisplay = intent.fromChain ? ` from ${intent.fromChain}` : "";
        const toChainDisplay = intent.destinationChain ? ` on ${intent.destinationChain}` : "";
        responseContent = `Got it! Sending ${intent.amount} ${tokenDisplay}${fromChainDisplay} to ${intent.recipient}${toChainDisplay}. Here's your payment:`;
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: responseContent,
            intent,
            showForm: true,
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handlePaymentSuccess = (messageId: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, showForm: false } : msg
      )
    );
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: "assistant",
        content: "Payment sent! Is there anything else I can help you with?",
      },
    ]);
  };

  const handleCancel = (messageId: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, showForm: false } : msg
      )
    );
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: "assistant",
        content: "No problem. Let me know if you'd like to try a different payment.",
      },
    ]);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || loading) return;

    // Validate file type
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: "Please upload a PDF or image file (PNG, JPG, WebP).",
        },
      ]);
      return;
    }

    // Create preview for images
    let filePreview: string | undefined;
    if (file.type.startsWith("image/")) {
      filePreview = URL.createObjectURL(file);
    }

    // Add user message with file
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: `Uploaded invoice: ${file.name}`,
      fileName: file.name,
      filePreview,
    };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/parse-invoice", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Failed to parse invoice");
      }

      const data = await res.json();
      const invoice: ParsedInvoice = data.parsedData;

      // Convert ParsedInvoice to ParsedPaymentIntent
      const intent: ParsedPaymentIntent = {
        amount: invoice.amount || null,
        token: invoice.token?.toUpperCase() || null,
        recipient: invoice.recipientAddress || null,
        fromChain: null, // Invoice doesn't specify source
        destinationChain: invoice.chain?.toLowerCase() || null,
        confidence: invoice.recipientAddress && invoice.amount ? "high" : "medium",
        missingFields: [],
        originalInput: `Invoice: ${file.name}`,
      };

      // Calculate missing fields
      if (!intent.amount) intent.missingFields.push("amount");
      if (!intent.token) intent.missingFields.push("token");
      if (!intent.recipient) intent.missingFields.push("recipient");

      // Build response
      let responseContent = "";
      if (intent.missingFields.length === 3) {
        responseContent = "I couldn't extract payment details from this invoice. Please make sure the invoice contains an amount and wallet address or ENS name.";
        setMessages((prev) => [
          ...prev,
          { id: Date.now().toString(), role: "assistant", content: responseContent },
        ]);
      } else {
        const recipientDisplay = invoice.recipientName
          ? `${invoice.recipientName} (${intent.recipient})`
          : intent.recipient;
        const memoDisplay = invoice.memo ? ` for "${invoice.memo}"` : "";

        if (intent.missingFields.length > 0) {
          const missing = intent.missingFields.join(", ");
          responseContent = `I found some details but I'm missing: ${missing}. Here's what I got:`;
        } else {
          responseContent = `Got it! Invoice to pay ${intent.amount} ${intent.token} to ${recipientDisplay}${memoDisplay}. Here's your payment:`;
        }

        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: responseContent,
            intent,
            showForm: true,
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: "Sorry, I couldn't parse that invoice. Please try a clearer image or PDF.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto overflow-hidden">
      <CardContent className="p-0">
        {/* Messages area */}
        <div className="h-[400px] overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div key={message.id}>
              <div
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {message.filePreview && (
                    <img
                      src={message.filePreview}
                      alt={message.fileName || "Uploaded file"}
                      className="max-w-[200px] max-h-[150px] rounded-lg mb-2 object-cover"
                    />
                  )}
                  {message.fileName && !message.filePreview && (
                    <div className="flex items-center gap-2 mb-2 p-2 rounded-lg bg-black/10">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-xs truncate">{message.fileName}</span>
                    </div>
                  )}
                  <p className="text-sm">{message.content}</p>
                </div>
              </div>

              {/* Embedded form */}
              {message.showForm && message.intent && (
                <div className="mt-2">
                  <div className="rounded-lg border border-border bg-card">
                    {!authenticated ? (
                      <div className="px-3 py-2 flex items-center gap-3">
                        <p className="text-sm text-muted-foreground">
                          Connect wallet to pay
                        </p>
                        <Button size="sm" onClick={login}>Connect</Button>
                      </div>
                    ) : (
                      <EmbeddedSendForm
                        intent={message.intent}
                        onSuccess={() => handlePaymentSuccess(message.id)}
                        onCancel={() => handleCancel(message.id)}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl px-4 py-2">
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="h-2 w-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="h-2 w-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-border p-4">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="relative">
            <Textarea
              placeholder='Try "send 10 USDC to vitalik.eth" or upload an invoice'
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[50px] max-h-[120px] pl-12 pr-16 resize-none"
              disabled={loading}
            />
            {/* Upload button */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="absolute bottom-2 left-2 h-8 w-8 p-0"
              title="Upload invoice (PDF or image)"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </Button>
            {/* Send button */}
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={loading || !input.trim()}
              className="absolute bottom-2 right-2"
            >
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Type a payment request or upload an invoice (PDF, PNG, JPG)
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
