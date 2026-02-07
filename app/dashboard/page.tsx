"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import WalletBalance from "@/components/WalletBalance";
import { getChainLogo, getTokenLogo } from "@/lib/chains";
import type { Invoice, Payment } from "@/lib/types";

export default function DashboardPage() {
  const { ready, authenticated, user } = usePrivy();
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteInvoice, setConfirmDeleteInvoice] = useState<string | null>(null);
  const [confirmDeletePayment, setConfirmDeletePayment] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [invRes, payRes] = await Promise.all([
        fetch(`/api/invoices?userId=${encodeURIComponent(user.id)}`),
        fetch(`/api/payments?userId=${encodeURIComponent(user.id)}`),
      ]);
      if (invRes.ok) setInvoices(await invRes.json());
      if (payRes.ok) setPayments(await payRes.json());
    } catch {
      // Silently handle fetch errors
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const handleDeleteInvoice = useCallback(async (id: string) => {
    if (confirmDeleteInvoice !== id) {
      setConfirmDeleteInvoice(id);
      setConfirmDeletePayment(null);
      // Auto-reset after 3 seconds
      setTimeout(() => setConfirmDeleteInvoice((curr) => (curr === id ? null : curr)), 3000);
      return;
    }
    try {
      const res = await fetch(`/api/invoices?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res.ok) {
        setInvoices((prev) => prev.filter((inv) => inv.id !== id));
        setPayments((prev) => prev.filter((pay) => pay.invoiceId !== id));
      }
    } catch {
      // Silently handle delete errors
    } finally {
      setConfirmDeleteInvoice(null);
    }
  }, [confirmDeleteInvoice]);

  const handleDeletePayment = useCallback(async (id: string) => {
    if (confirmDeletePayment !== id) {
      setConfirmDeletePayment(id);
      setConfirmDeleteInvoice(null);
      // Auto-reset after 3 seconds
      setTimeout(() => setConfirmDeletePayment((curr) => (curr === id ? null : curr)), 3000);
      return;
    }
    try {
      const res = await fetch(`/api/payments?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res.ok) {
        setPayments((prev) => prev.filter((pay) => pay.id !== id));
      }
    } catch {
      // Silently handle delete errors
    } finally {
      setConfirmDeletePayment(null);
    }
  }, [confirmDeletePayment]);

  useEffect(() => {
    if (ready && !authenticated) {
      router.push("/");
      return;
    }
    if (user?.id) fetchData();
  }, [ready, authenticated, user?.id, router, fetchData]);

  if (!ready || !authenticated) return null;

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toISOString().split("T")[0];
  };

  const statusVariant = (s: string) => {
    switch (s) {
      case "failed":
        return "destructive" as const;
      case "paying":
      case "executing":
        return "secondary" as const;
      default:
        return "outline" as const;
    }
  };

  const isSuccessStatus = (s: string) => s === "paid" || s === "completed";

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your invoices, payments, and wallet overview.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/generate")}>
            Generate Invoice
          </Button>
          <Button onClick={() => router.push("/upload")}>Pay Invoice</Button>
        </div>
      </div>

      <WalletBalance />

      <Tabs defaultValue="invoices">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="invoices">
            Invoices ({invoices.length})
          </TabsTrigger>
          <TabsTrigger value="payments">
            Payments ({payments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="mt-3 space-y-1">
          {loading ? (
            <div className="flex items-center gap-3 py-8 justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
          ) : invoices.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <p className="text-muted-foreground">No invoices yet.</p>
              <Button
                variant="link"
                onClick={() => router.push("/upload")}
                className="mt-1"
              >
                Upload your first invoice
              </Button>
            </div>
          ) : (
            invoices.map((inv) => (
              <Card key={inv.id} className="transition-colors hover:bg-muted/30">
                <CardContent className="flex items-center gap-2 py-2 px-3">
                  <span className="text-xs text-muted-foreground font-mono w-20 shrink-0 hidden sm:block">
                    {formatDate(inv.createdAt)}
                  </span>
                  {inv.parsedData?.chain && (
                    <img
                      src={getChainLogo(inv.parsedData.chain)}
                      alt={inv.parsedData.chain}
                      className="h-8 w-8 rounded-full shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-medium truncate max-w-[150px] sm:max-w-none">
                        {inv.parsedData?.recipientName || "Unnamed Invoice"}
                      </span>
                      <Badge
                        variant={statusVariant(inv.status)}
                        className={isSuccessStatus(inv.status) ? "bg-green-500/15 text-green-600 border-green-500/20" : ""}
                      >
                        {inv.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      {inv.parsedData?.token && (
                        <img
                          src={getTokenLogo(inv.parsedData.token)}
                          alt={inv.parsedData.token}
                          className="h-4 w-4 rounded-full"
                        />
                      )}
                      <span className="truncate">
                        {inv.parsedData
                          ? `${inv.parsedData.amount} ${inv.parsedData.token} to ${inv.parsedData.recipientAddress}`
                          : inv.rawFileName || "No data"}
                      </span>
                      {inv.parsedData?.dueDate && (
                        <span className={`shrink-0 text-xs ${
                          new Date(inv.parsedData.dueDate) < new Date() && inv.status !== "paid"
                            ? "text-destructive font-medium"
                            : ""
                        }`}>
                          Due {formatDate(inv.parsedData.dueDate)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {inv.status !== "paid" && inv.parsedData && (
                      <Button
                        onClick={() => router.push(`/upload?invoiceId=${inv.id}`)}
                        className="px-6"
                      >
                        Pay
                      </Button>
                    )}
                    {confirmDeleteInvoice === inv.id ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteInvoice(inv.id)}
                        className="h-8 text-xs"
                      >
                        Confirm?
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteInvoice(inv.id)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="payments" className="mt-3 space-y-1">
          {loading ? (
            <div className="flex items-center gap-3 py-8 justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
          ) : payments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <p className="text-muted-foreground">No payments yet.</p>
            </div>
          ) : (
            payments.map((pay) => {
              const invoice = invoices.find((inv) => inv.id === pay.invoiceId);
              return (
              <Card key={pay.id} className="transition-colors hover:bg-muted/30">
                <CardContent className="flex items-center gap-2 py-2 px-3">
                  <span className="text-xs text-muted-foreground font-mono w-20 shrink-0">
                    {formatDate(pay.createdAt)}
                  </span>
                  {pay.toChain && (
                    <img
                      src={getChainLogo(pay.toChain)}
                      alt={pay.toChain}
                      className="h-8 w-8 rounded-full shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      {pay.toToken && (
                        <img
                          src={getTokenLogo(pay.toToken)}
                          alt={pay.toToken}
                          className="h-4 w-4 rounded-full"
                        />
                      )}
                      <span className="font-medium">
                        {pay.amount} {pay.toToken}
                      </span>
                      <Badge
                        variant={statusVariant(pay.status)}
                        className={isSuccessStatus(pay.status) ? "bg-green-500/15 text-green-600 border-green-500/20" : ""}
                      >
                        {pay.status}
                      </Badge>
                    </div>
                    {invoice?.parsedData && (
                      <p className="text-sm">
                        <span className="text-foreground">{invoice.parsedData.recipientName}</span>
                        {invoice.parsedData.memo && (
                          <span className="text-muted-foreground"> - {invoice.parsedData.memo}</span>
                        )}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {pay.fromChain} → {pay.toChain}
                    </p>
                    {pay.txHash && (
                      <p className="text-xs font-mono text-muted-foreground">
                        tx: {pay.txHash.slice(0, 10)}...{pay.txHash.slice(-8)}
                      </p>
                    )}
                  </div>
                  {confirmDeletePayment === pay.id ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeletePayment(pay.id)}
                      className="h-8 text-xs shrink-0"
                    >
                      Confirm?
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeletePayment(pay.id)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </Button>
                  )}
                </CardContent>
              </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
