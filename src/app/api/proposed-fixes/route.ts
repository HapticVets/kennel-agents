import { NextResponse } from "next/server";

import { runFixDraftAgent } from "@/lib/fix-draft-agent";
import { readProposedFixReport, writeProposedFixReport } from "@/lib/storage";

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
