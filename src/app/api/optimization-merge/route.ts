import { NextResponse } from "next/server";

import {
  applyOptimizationMerge,
  buildOptimizationMergeReport,
  skipOptimizationMerge
} from "@/lib/optimization-merge-agent";

export async function GET() {
  try {
    const report = await buildOptimizationMergeReport();
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load optimization merge previews."
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    itemId?: string;
    action?: "apply" | "skip";
  };

  if (!body.itemId || !body.action) {
    return NextResponse.json(
      { error: "itemId and action are required." },
      { status: 400 }
    );
  }

  try {
    const report =
      body.action === "skip"
        ? await skipOptimizationMerge(body.itemId)
        : await applyOptimizationMerge(body.itemId);

    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to process optimization merge action."
      },
      { status: 500 }
    );
  }
}
