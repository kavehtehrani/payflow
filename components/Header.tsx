"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";

function useAuth() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();

  // Prefer external wallet (MetaMask etc.) over embedded
  const activeWallet = wallets.find(
    (w) => w.walletClientType !== "privy"
  ) || wallets[0];
  const walletAddress = activeWallet?.address;
  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : null;

  return { ready, authenticated, login, logout, shortAddress };
}

function AuthSection() {
  const { ready, authenticated, login, logout, shortAddress } = useAuth();

  if (!ready) return null;

  if (authenticated) {
    return (
      <div className="flex items-center gap-3">
        {shortAddress && (
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-mono text-muted-foreground">
            {shortAddress}
          </span>
        )}
        <Button variant="ghost" size="sm" onClick={logout}>
          Logout
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" onClick={login}>
      Login
    </Button>
  );
}

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/send", label: "Send" },
  { href: "/upload", label: "Pay Invoice" },
  { href: "/generate", label: "Generate" },
  { href: "/contact", label: "Contacts" },
];

function NavLink({ href, label, isActive, authenticated, login }: {
  href: string;
  label: string;
  isActive: boolean;
  authenticated: boolean;
  login: () => void;
}) {
  const handleClick = (e: React.MouseEvent) => {
    if (!authenticated) {
      e.preventDefault();
      login();
    }
  };

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
        isActive
          ? "bg-muted text-foreground font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
      }`}
    >
      {label}
    </Link>
  );
}

export default function Header() {
  const pathname = usePathname();
  const [privyAvailable, setPrivyAvailable] = useState(false);
  const { ready, authenticated, login } = useAuth();

  useEffect(() => {
    setPrivyAvailable(!!process.env.NEXT_PUBLIC_PRIVY_APP_ID);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <Image
              src="/logo-simple.svg"
              alt="PayFlow"
              width={32}
              height={32}
              className="h-8 w-8"
            />
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              PayFlow
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            {navLinks.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                label={link.label}
                isActive={pathname === link.href}
                authenticated={!privyAvailable || !ready || authenticated}
                login={login}
              />
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {privyAvailable && <AuthSection />}
        </div>
      </div>
    </header>
  );
}
