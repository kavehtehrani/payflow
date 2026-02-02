"use client";

import { usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Header() {
  const { ready, authenticated, user, login, logout } = usePrivy();

  const walletAddress = user?.wallet?.address;
  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : null;

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xl font-bold text-primary">
            PayFlow
          </Link>
          {authenticated && (
            <nav className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/upload"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Pay Invoice
              </Link>
              <Link
                href="/generate"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Generate
              </Link>
            </nav>
          )}
        </div>
        <div className="flex items-center gap-3">
          {ready && authenticated ? (
            <>
              {shortAddress && (
                <span className="text-sm font-mono text-muted-foreground">
                  {shortAddress}
                </span>
              )}
              <Button variant="outline" size="sm" onClick={logout}>
                Logout
              </Button>
            </>
          ) : ready ? (
            <Button size="sm" onClick={login}>
              Login
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
