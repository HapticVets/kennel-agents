import { NextResponse } from "next/server";

import { buildApprovalQueue, updateApprovalStatus } from "@/lib/approval-queue";
import type { ApprovalSourceType, ApprovalStatus } from "@/types/health";

export async function GET() {
  const report = await buildApprovalQueue();
  return NextResponse.json(report);
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    itemId?: string;
    sourceType?: ApprovalSourceType;
    status?: ApprovalStatus;
  };

  if (!body.itemId || !body.sourceType || !body.status) {
    return NextResponse.json(
      { error: "itemId, sourceType, and status are required." },
      { status: 400 }
    );
  }

  // Status changes only update local review state. They do not apply any site changes.
  const report = await updateApprovalStatus(body.itemId, body.sourceType, body.status);
  return NextResponse.json(report);
}
