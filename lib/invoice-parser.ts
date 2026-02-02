import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ParsedInvoice } from "./types";

const PARSE_PROMPT = `You are an invoice parser. Extract payment details from the provided invoice.
Return ONLY valid JSON with these fields:
{
  "recipientName": "string - who to pay",
  "recipientAddress": "string - wallet address or ENS name (e.g. 0x... or name.eth)",
  "amount": "string - numeric amount",
  "token": "string - token symbol (default USDC)",
  "chain": "string - blockchain name (e.g. ethereum, arbitrum, optimism, polygon, base)",
  "memo": "string - payment description",
  "dueDate": "string - ISO date if specified, null otherwise"
}

Important rules:
- If no token is specified, default to "USDC"
- If no chain is specified, default to "base"
- If no wallet address is found, set recipientAddress to empty string
- Always return valid JSON only, no markdown or extra text
- The amount should be a plain number string without currency symbols`;

export async function parseInvoiceFromImage(
  imageBase64: string,
  mimeType: string
): Promise<ParsedInvoice> {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const result = await model.generateContent([
    PARSE_PROMPT,
    {
      inlineData: {
        data: imageBase64,
        mimeType,
      },
    },
  ]);

  const text = result.response.text();
  return extractJson(text);
}

export async function parseInvoiceFromText(text: string): Promise<ParsedInvoice> {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const result = await model.generateContent([
    PARSE_PROMPT,
    `Here is the invoice text:\n\n${text}`,
  ]);

  const responseText = result.response.text();
  return extractJson(responseText);
}

function extractJson(text: string): ParsedInvoice {
  // Try to extract JSON from the response, handling markdown code blocks
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const parsed = JSON.parse(cleaned);

  return {
    recipientName: parsed.recipientName || "",
    recipientAddress: parsed.recipientAddress || "",
    amount: parsed.amount || "0",
    token: parsed.token || "USDC",
    chain: parsed.chain || "base",
    memo: parsed.memo || "",
    dueDate: parsed.dueDate || null,
  };
}
