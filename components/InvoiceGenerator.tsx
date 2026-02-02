"use client";

import { useState, useRef } from "react";
import { toPng } from "html-to-image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SUPPORTED_CHAINS, SUPPORTED_TOKENS } from "@/lib/chains";

interface InvoiceFormData {
  recipientName: string;
  recipientAddress: string;
  amount: string;
  token: string;
  chain: string;
  memo: string;
  dueDate: string;
  invoiceNumber: string;
  senderName: string;
}

const defaultForm: InvoiceFormData = {
  recipientName: "",
  recipientAddress: "",
  amount: "",
  token: "USDC",
  chain: "base",
  memo: "",
  dueDate: "",
  invoiceNumber: `INV-${Date.now().toString(36).toUpperCase()}`,
  senderName: "",
};

interface InvoiceGeneratorProps {
  onGenerated?: (imageDataUrl: string, formData: InvoiceFormData) => void;
}

export default function InvoiceGenerator({ onGenerated }: InvoiceGeneratorProps) {
  const [form, setForm] = useState<InvoiceFormData>(defaultForm);
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);

  const update = (field: keyof InvoiceFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const chainDisplay =
    Object.values(SUPPORTED_CHAINS).find((c) => c.name === form.chain)?.displayName || form.chain;

  const handleGenerate = async () => {
    if (!invoiceRef.current) return;
    setGenerating(true);
    try {
      const dataUrl = await toPng(invoiceRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
      setPreviewUrl(dataUrl);
      onGenerated?.(dataUrl, form);
    } catch (err) {
      console.error("Failed to generate invoice image:", err);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!previewUrl) return;
    const link = document.createElement("a");
    link.download = `${form.invoiceNumber}.png`;
    link.href = previewUrl;
    link.click();
  };

  const handleSave = async () => {
    try {
      const userId = "anonymous"; // Will be replaced with actual Privy user ID at runtime
      await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          rawFileName: `${form.invoiceNumber}.png`,
          rawFileType: "image/png",
          parsedData: {
            recipientName: form.recipientName,
            recipientAddress: form.recipientAddress,
            amount: form.amount,
            token: form.token,
            chain: form.chain,
            memo: form.memo,
            dueDate: form.dueDate || null,
          },
          status: "draft",
        }),
      });
      alert("Invoice saved to your dashboard.");
    } catch {
      alert("Failed to save invoice.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Create Invoice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="senderName">From (Your Name / Company)</Label>
              <Input
                id="senderName"
                value={form.senderName}
                onChange={(e) => update("senderName", e.target.value)}
                placeholder="Acme Corp"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoiceNumber">Invoice Number</Label>
              <Input
                id="invoiceNumber"
                value={form.invoiceNumber}
                onChange={(e) => update("invoiceNumber", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="recipientName">Recipient Name</Label>
              <Input
                id="recipientName"
                value={form.recipientName}
                onChange={(e) => update("recipientName", e.target.value)}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recipientAddress">Wallet Address / ENS</Label>
              <Input
                id="recipientAddress"
                value={form.recipientAddress}
                onChange={(e) => update("recipientAddress", e.target.value)}
                placeholder="0x... or name.eth"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => update("amount", e.target.value)}
                placeholder="100.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="token">Token</Label>
              <select
                id="token"
                value={form.token}
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
                value={form.chain}
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
            <Label htmlFor="memo">Description / Memo</Label>
            <Textarea
              id="memo"
              value={form.memo}
              onChange={(e) => update("memo", e.target.value)}
              placeholder="Web development services - January 2026"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date</Label>
            <Input
              id="dueDate"
              type="date"
              value={form.dueDate}
              onChange={(e) => update("dueDate", e.target.value)}
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={!form.recipientName || !form.amount || !form.recipientAddress || generating}
            className="w-full"
          >
            {generating ? "Generating..." : "Generate Invoice"}
          </Button>
        </CardContent>
      </Card>

      {/* Hidden rendered invoice for capture */}
      <div className="overflow-hidden" style={{ height: 0 }}>
        <div
          ref={invoiceRef}
          style={{
            width: "800px",
            padding: "48px",
            fontFamily: "Arial, Helvetica, sans-serif",
            color: "#111",
            backgroundColor: "#fff",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "40px" }}>
            <div>
              <div style={{ fontSize: "32px", fontWeight: "bold", color: "#6366f1" }}>
                INVOICE
              </div>
              <div style={{ fontSize: "14px", color: "#666", marginTop: "4px" }}>
                {form.invoiceNumber}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              {form.senderName && (
                <div style={{ fontSize: "18px", fontWeight: "600" }}>{form.senderName}</div>
              )}
              {form.dueDate && (
                <div style={{ fontSize: "13px", color: "#666", marginTop: "4px" }}>
                  Due: {new Date(form.dueDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </div>
              )}
            </div>
          </div>

          {/* Bill To */}
          <div style={{ marginBottom: "32px" }}>
            <div style={{ fontSize: "12px", fontWeight: "600", color: "#999", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>
              Bill To
            </div>
            <div style={{ fontSize: "16px", fontWeight: "600" }}>{form.recipientName || "Recipient"}</div>
            <div style={{ fontSize: "13px", fontFamily: "monospace", color: "#444", marginTop: "4px", wordBreak: "break-all" }}>
              {form.recipientAddress || "0x..."}
            </div>
          </div>

          {/* Line items table */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "32px" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                <th style={{ textAlign: "left", padding: "12px 0", fontSize: "12px", fontWeight: "600", color: "#999", textTransform: "uppercase", letterSpacing: "1px" }}>
                  Description
                </th>
                <th style={{ textAlign: "right", padding: "12px 0", fontSize: "12px", fontWeight: "600", color: "#999", textTransform: "uppercase", letterSpacing: "1px" }}>
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ padding: "16px 0", fontSize: "14px" }}>
                  {form.memo || "Services rendered"}
                </td>
                <td style={{ padding: "16px 0", fontSize: "14px", textAlign: "right", fontWeight: "600" }}>
                  {form.amount || "0"} {form.token}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Total */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "40px" }}>
            <div style={{ width: "250px", borderTop: "2px solid #111", paddingTop: "12px", display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "16px", fontWeight: "700" }}>Total</span>
              <span style={{ fontSize: "16px", fontWeight: "700" }}>
                {form.amount || "0"} {form.token}
              </span>
            </div>
          </div>

          {/* Payment details */}
          <div style={{ backgroundColor: "#f9fafb", borderRadius: "8px", padding: "20px" }}>
            <div style={{ fontSize: "12px", fontWeight: "600", color: "#999", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px" }}>
              Payment Details
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "13px" }}>
              <div>
                <span style={{ color: "#666" }}>Chain: </span>
                <span style={{ fontWeight: "500" }}>{chainDisplay}</span>
              </div>
              <div>
                <span style={{ color: "#666" }}>Token: </span>
                <span style={{ fontWeight: "500" }}>{form.token}</span>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <span style={{ color: "#666" }}>Pay to: </span>
                <span style={{ fontWeight: "500", fontFamily: "monospace", wordBreak: "break-all" }}>
                  {form.recipientAddress || "0x..."}
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ marginTop: "32px", fontSize: "11px", color: "#aaa", textAlign: "center" }}>
            Generated by PayFlow
          </div>
        </div>
      </div>

      {/* Preview + actions */}
      {previewUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generated Invoice</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-auto rounded-md border">
              <img src={previewUrl} alt="Generated invoice" className="w-full" />
            </div>
            <div className="flex gap-3">
              <Button onClick={handleDownload} variant="outline" className="flex-1">
                Download PNG
              </Button>
              <Button onClick={handleSave} className="flex-1">
                Save to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
