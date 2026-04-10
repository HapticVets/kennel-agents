import { NextResponse } from "next/server";

import {
  applyOperatorChanges,
  buildOperatorDashboard,
  generateOperatorSuggestions,
  runOperatorHealthCheck,
  updateOperatorSuggestionStatus
} from "@/lib/operator-mode";
import type { OperatorSuggestionSource } from "@/types/health";

export async function GET() {
  const report = await buildOperatorDashboard();
  return NextResponse.json(report);
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    action?: "health" | "suggestions" | "apply" | "approval";
    itemId?: string;
    sourceType?: OperatorSuggestionSource;
    status?: "approved" | "rejected";
  };

  try {
    switch (body.action) {
      case "health":
        return NextResponse.json(await runOperatorHealthCheck());
      case "suggestions":
        return NextResponse.json(await generateOperatorSuggestions());
      case "apply":
        return NextResponse.json(await applyOperatorChanges());
      case "approval":
        if (!body.itemId || !body.sourceType || !body.status) {
          return NextResponse.json(
            { error: "itemId, sourceType, and status are required." },
            { status: 400 }
          );
        }

        return NextResponse.json(
          await updateOperatorSuggestionStatus(
            body.itemId,
            body.sourceType,
            body.status
          )
        );
      default:
        return NextResponse.json(
          { error: "action must be health, suggestions, apply, or approval." },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to complete operator action."
      },
      { status: 500 }
    );
  }
}
