import { NextResponse } from "next/server";

import { runKennelHealthAgent } from "@/lib/health-agent";
import { appendHealthReport, readHealthReportStore } from "@/lib/storage";

export async function GET() {
  // The dashboard reads the latest saved report through this endpoint.
  const store = await readHealthReportStore();
  return NextResponse.json(store);
}

export async function POST() {
  // Running the agent is explicit in Phase 1 so nothing happens automatically yet.
  const report = await runKennelHealthAgent();
  const store = await appendHealthReport(report);

  return NextResponse.json(store);
}
