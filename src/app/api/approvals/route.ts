import { NextResponse } from "next/server";

import { buildApprovalQueue, updateApprovalStatus } from "@/lib/approval-queue";
import { deleteApprovalStateByItem } from "@/lib/storage";
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

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const itemId = url.searchParams.get("itemId");
  const sourceType = url.searchParams.get("sourceType") as ApprovalSourceType | null;

  if (!itemId || !sourceType) {
    return NextResponse.json(
      { error: "itemId and sourceType are required." },
      { status: 400 }
    );
  }

  const deletedStates = await deleteApprovalStateByItem(itemId, sourceType);

  if (!deletedStates) {
    return NextResponse.json({ error: "Approval record not found." }, { status: 404 });
  }

  const report = await buildApprovalQueue();
  return NextResponse.json(report);
}
