"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { privyConfig } from "@/lib/privy";

export default function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  // During build or when app ID is missing, render children without Privy
  if (!appId) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider appId={appId} config={privyConfig}>
      {children}
    </PrivyProvider>
  );
}
