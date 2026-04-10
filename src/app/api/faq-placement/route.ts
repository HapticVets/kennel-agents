import { NextResponse } from "next/server";

import {
  applyFaqPlacement,
  buildFaqPlacementReport,
  skipFaqPlacement
} from "@/lib/faq-placement-agent";

export async function GET() {
  try {
    const report = await buildFaqPlacementReport();
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load FAQ placement previews."
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
        ? await skipFaqPlacement(body.itemId)
        : await applyFaqPlacement(body.itemId);

    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to process FAQ placement action."
      },
      { status: 500 }
    );
  }
}
