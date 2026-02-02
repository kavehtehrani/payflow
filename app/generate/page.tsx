"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import InvoiceGenerator from "@/components/InvoiceGenerator";

export default function GeneratePage() {
  const { ready, authenticated } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (ready && !authenticated) {
      router.push("/");
    }
  }, [ready, authenticated, router]);

  if (!ready || !authenticated) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Generate Invoice</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create a sample invoice to test the AI parsing pipeline, or send to someone for payment.
        </p>
      </div>
      <InvoiceGenerator />
    </div>
  );
}
