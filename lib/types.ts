export type InvoiceStatus = "draft" | "parsed" | "confirmed" | "paying" | "paid" | "failed";
export type PaymentStatus = "pending" | "executing" | "completed" | "failed";

export interface ParsedInvoice {
  recipientName: string;
  recipientAddress: string; // wallet address or ENS name
  resolvedAddress?: string; // resolved from ENS if applicable
  amount: string;
  token: string;
  chain: string;
  memo: string;
  dueDate: string | null;
}

export interface Invoice {
  id: string;
  userId: string;
  rawFileName?: string;
  rawFileType?: string;
  parsedData: ParsedInvoice | null;
  status: InvoiceStatus;
  createdAt: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  txHash: string | null;
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  amount: string;
  status: PaymentStatus;
  routeData: Record<string, unknown> | null;
  createdAt: string;
}

export interface ChainConfig {
  id: number;
  name: string;
  displayName: string;
  nativeCurrency: string;
  rpcUrl: string;
  explorerUrl: string;
  lifiChainId: number;
  usdcAddress: string;
}
