import { NextResponse } from "next/server";

import { runContentAgent } from "@/lib/content-agent";
import { readContentDraftReport, writeContentDraftReport } from "@/lib/storage";

export async function GET() {
  const report = await readContentDraftReport();
  return NextResponse.json(report);
}

export async function POST() {
  // Content drafts are generated manually and saved for review in the admin dashboard.
  const report = await runContentAgent();
  const savedReport = await writeContentDraftReport(report);

  return NextResponse.json(savedReport);
}
