import { NextRequest, NextResponse } from "next/server";
import { parsePaymentIntent } from "@/lib/payment-intent-parser";

const MAX_INPUT_LENGTH = 500;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { input } = body;

    if (!input || typeof input !== "string") {
      return NextResponse.json(
        { error: "Input is required" },
        { status: 400 }
      );
    }

    if (input.length > MAX_INPUT_LENGTH) {
      return NextResponse.json(
        { error: `Input too long. Maximum ${MAX_INPUT_LENGTH} characters allowed.` },
        { status: 400 }
      );
    }

    const parsedIntent = await parsePaymentIntent(input);

    return NextResponse.json(parsedIntent);
  } catch (error) {
    console.error("Payment intent parse error:", error);
    return NextResponse.json(
      { error: "Failed to parse payment intent" },
      { status: 500 }
    );
  }
}
