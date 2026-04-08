import { NextResponse } from "next/server";

import { applyMerge, buildMergeQueue, skipMerge } from "@/lib/merge-agent";

export async function GET() {
  try {
    const report = await buildMergeQueue();
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load merge previews."
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    itemId?: string;
    sourceType?: "proposed_fix" | "content_draft";
    action?: "apply" | "skip";
  };

  if (!body.itemId || !body.sourceType || !body.action) {
    return NextResponse.json(
      { error: "itemId, sourceType, and action are required." },
      { status: 400 }
    );
  }

  try {
    const report =
      body.action === "skip"
        ? await skipMerge(body.itemId, body.sourceType)
        : await applyMerge(body.itemId, body.sourceType);

    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to process merge action."
      },
      { status: 500 }
    );
  }
}
