import { NextResponse } from "next/server";

import { runFixDraftAgent } from "@/lib/fix-draft-agent";
import {
  deleteApprovalStateByItem,
  deleteProposedFixById,
  readProposedFixReport,
  writeProposedFixReport
} from "@/lib/storage";

export async function GET() {
  const report = await readProposedFixReport();
  return NextResponse.json(report);
}

export async function POST() {
  // The Fix Draft Agent is manual and read-only in Phase 2.
  const report = await runFixDraftAgent();
  const savedReport = await writeProposedFixReport(report);

  return NextResponse.json(savedReport);
}

export async function DELETE(request: Request) {
  const itemId = new URL(request.url).searchParams.get("itemId");

  if (!itemId) {
    return NextResponse.json({ error: "itemId is required." }, { status: 400 });
  }

  const nextReport = await deleteProposedFixById(itemId);

  if (!nextReport) {
    return NextResponse.json({ error: "Proposed fix not found." }, { status: 404 });
  }

  await deleteApprovalStateByItem(itemId, "proposed_fix");

  return NextResponse.json(nextReport);
}
