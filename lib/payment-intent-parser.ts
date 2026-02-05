import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ParsedPaymentIntent } from "./types";

const PARSE_PROMPT = `You are a payment intent parser. Extract payment details from natural language input.
Return ONLY valid JSON with these fields:
{
  "amount": "string - numeric amount (e.g. '10', '0.5'), or null if not specified",
  "token": "string - token symbol in uppercase (ETH, USDC, USDT, DAI), or null if not specified",
  "recipient": "string - wallet address (0x...) or ENS name (name.eth), or null if not specified",
  "fromChain": "string - source chain name (ethereum, arbitrum, optimism, polygon, base), or null if not specified",
  "destinationChain": "string - destination chain name, or null if not specified",
  "confidence": "string - 'high' if all key fields parsed clearly, 'medium' if some ambiguity, 'low' if very unclear",
  "missingFields": ["array of missing required field names: 'amount', 'token', 'recipient'"]
}

Important rules:
- Supported tokens: ETH, USDC, USDT, DAI
- Supported chains: ethereum, arbitrum, optimism, polygon, base
- If user says "$10", "10 dollars", "10 usd", treat as USDC
- If user says "10 eth" or "10 ether", treat as ETH
- Chain aliases: "arb" = arbitrum, "op" = optimism, "poly" = polygon, "eth" = ethereum, "mainnet" = ethereum
- Look for source chain in phrases like "from arbitrum", "using my eth on polygon", "my arbitrum usdc"
- Look for destination chain in phrases like "to base", "on optimism"
- If no token specified and amount uses "$" or "dollars", default to USDC
- If no chains specified, leave them as null
- ENS names end in .eth (e.g. vitalik.eth)
- Always return valid JSON only, no markdown or extra text`;

export async function parsePaymentIntent(input: string): Promise<ParsedPaymentIntent> {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const result = await model.generateContent([
    PARSE_PROMPT,
    `Parse this payment request:\n\n${input}`,
  ]);

  const text = result.response.text();
  return extractJson(text, input);
}

function extractJson(text: string, originalInput: string): ParsedPaymentIntent {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const parsed = JSON.parse(cleaned);

  // Normalize token to uppercase
  const token = parsed.token ? parsed.token.toUpperCase() : null;

  // Normalize chain names to lowercase
  const fromChain = parsed.fromChain ? normalizeChainName(parsed.fromChain) : null;
  const destinationChain = parsed.destinationChain ? normalizeChainName(parsed.destinationChain) : null;

  // Calculate missing fields
  const missingFields: string[] = [];
  if (!parsed.amount) missingFields.push("amount");
  if (!token) missingFields.push("token");
  if (!parsed.recipient) missingFields.push("recipient");

  return {
    amount: parsed.amount || null,
    token,
    recipient: parsed.recipient || null,
    fromChain,
    destinationChain,
    confidence: parsed.confidence || "medium",
    missingFields,
    originalInput,
  };
}

function normalizeChainName(name: string): string {
  const normalized = name.toLowerCase().trim();
  const aliases: Record<string, string> = {
    arb: "arbitrum",
    op: "optimism",
    poly: "polygon",
    eth: "ethereum",
    mainnet: "ethereum",
  };
  return aliases[normalized] || normalized;
}
