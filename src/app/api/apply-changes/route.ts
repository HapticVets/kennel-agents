import { NextResponse } from "next/server";

import { applyApprovedItem, buildApplyQueue } from "@/lib/apply-agent";

export async function GET() {
  try {
    const report = await buildApplyQueue();
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load apply queue."
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    itemId?: string;
    sourceType?: "proposed_fix" | "content_draft";
  };

  if (!body.itemId || !body.sourceType) {
    return NextResponse.json(
      { error: "itemId and sourceType are required." },
      { status: 400 }
    );
  }

  try {
    const report = await applyApprovedItem(body.itemId, body.sourceType);
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to apply approved item."
      },
      { status: 500 }
    );
  }
}
