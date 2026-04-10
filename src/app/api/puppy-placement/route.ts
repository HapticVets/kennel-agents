import { NextResponse } from "next/server";

import {
  applyPuppyPlacement,
  buildPuppyPlacementReport,
  skipPuppyPlacement
} from "@/lib/puppy-placement-agent";

export async function GET() {
  try {
    const report = await buildPuppyPlacementReport();
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load puppy placement previews."
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

  if (!body.action) {
    return NextResponse.json({ error: "action is required." }, { status: 400 });
  }

  try {
    const report =
      body.action === "skip" && body.itemId
        ? await skipPuppyPlacement(body.itemId)
        : await applyPuppyPlacement(body.itemId);

    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to process puppy placement action."
      },
      { status: 500 }
    );
  }
}
