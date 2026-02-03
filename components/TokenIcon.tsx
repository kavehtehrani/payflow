"use client";

import { useState } from "react";
import Image from "next/image";
import { getTokenLogoUrl, getChainLogoUrl } from "@/lib/tokenLogos";

interface TokenIconProps {
  symbol: string;
  address?: string;
  size?: number;
  className?: string;
}

export function TokenIcon({ symbol, address, size = 24, className = "" }: TokenIconProps) {
  const [error, setError] = useState(false);

  // Try address first for more specific matching, then fall back to symbol
  const logoUrl = address ? getTokenLogoUrl(address) : getTokenLogoUrl(symbol);

  if (error) {
    // Fallback to symbol initials
    return (
      <div
        className={`flex items-center justify-center rounded-full bg-muted text-xs font-medium ${className}`}
        style={{ width: size, height: size }}
      >
        {symbol.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <Image
      src={logoUrl}
      alt={symbol}
      width={size}
      height={size}
      className={`rounded-full ${className}`}
      onError={() => setError(true)}
      unoptimized // External URLs need this
    />
  );
}

interface ChainIconProps {
  chainId: number;
  size?: number;
  className?: string;
}

export function ChainIcon({ chainId, size = 16, className = "" }: ChainIconProps) {
  const [error, setError] = useState(false);
  const logoUrl = getChainLogoUrl(chainId);

  if (error) {
    return (
      <div
        className={`flex items-center justify-center rounded-full bg-muted text-[8px] font-medium ${className}`}
        style={{ width: size, height: size }}
      >
        {chainId}
      </div>
    );
  }

  return (
    <Image
      src={logoUrl}
      alt={`Chain ${chainId}`}
      width={size}
      height={size}
      className={`rounded-full ${className}`}
      onError={() => setError(true)}
      unoptimized
    />
  );
}
