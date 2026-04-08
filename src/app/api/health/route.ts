import { NextResponse } from "next/server";

import { runKennelHealthAgent } from "@/lib/health-agent";
import { readHealthReport, writeHealthReport } from "@/lib/storage";

export async function GET() {
  // The dashboard reads the latest saved report through this endpoint.
  const report = await readHealthReport();
  return NextResponse.json(report);
}

export async function POST() {
  // Running the agent is explicit in Phase 1 so nothing happens automatically yet.
  const report = await runKennelHealthAgent();
  await writeHealthReport(report);

  return NextResponse.json(report);
}
