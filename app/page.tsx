"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { PaymentChatBot } from "@/components/PaymentChatBot";

export default function Home() {
  const { ready, authenticated, login } = usePrivy();
  const router = useRouter();

  return (
    <div className="relative flex flex-col items-center justify-center px-4 py-28 overflow-hidden">
      {/* Background gradient blobs */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute top-20 -right-40 h-[300px] w-[400px] rounded-full bg-accent/15 blur-3xl" />

      <div className="relative mx-auto max-w-2xl text-center space-y-8">
        <div className="flex justify-center">
          <Image
            src="/logo-with-text.svg"
            alt="PayFlow"
            width={160}
            height={160}
            className="h-40 w-40"
            priority
          />
        </div>

        <div className="inline-block rounded-full border border-border bg-muted/50 px-4 py-1.5 text-xs font-medium text-muted-foreground">
          AI-powered cross-chain payments
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1]">
          Pay anyone
          <br />
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            across any chain
          </span>
        </h1>

        <p className="text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
          Just tell me who to pay and how much. I'll handle the rest.
        </p>

        {/* Chat Bot - Main Feature */}
        <div className="pt-4 w-full">
          <PaymentChatBot />
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          {ready && authenticated ? (
            <>
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto px-8 text-base"
                onClick={() => router.push("/upload")}
              >
                Upload Invoice
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto px-8 text-base"
                onClick={() => router.push("/send")}
              >
                Manual Send
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="w-full sm:w-auto px-8 text-base"
                onClick={() => router.push("/dashboard")}
              >
                Dashboard
              </Button>
            </>
          ) : ready ? (
            <p className="text-sm text-muted-foreground">
              Connect your wallet to send payments
            </p>
          ) : null}
        </div>

        <div className="grid gap-8 sm:grid-cols-3 pt-16 text-left">
          <div className="rounded-xl border border-border bg-card p-6 space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary text-lg font-bold">
              AI
            </div>
            <h3 className="font-semibold">Smart Parsing</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Upload a PDF, image, or paste text. Gemini extracts recipient,
              amount, token, and chain automatically.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-6 space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary text-lg font-bold">
              LI
            </div>
            <h3 className="font-semibold">Cross-Chain Routes</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              LI.FI finds the cheapest route from your funds on any chain to the
              recipient on theirs.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-6 space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/20 text-accent-foreground text-lg font-bold">
              .eth
            </div>
            <h3 className="font-semibold">ENS Native</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Invoices with ENS names like vitalik.eth are resolved to wallet
              addresses on the fly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
