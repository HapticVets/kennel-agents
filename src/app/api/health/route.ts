import { NextResponse } from "next/server";

import { runKennelHealthAgent } from "@/lib/health-agent";
import {
  appendHealthReport,
  deleteHealthReportByCheckedAt,
  readHealthReportStore
} from "@/lib/storage";

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

export async function DELETE(request: Request) {
  const checkedAt = new URL(request.url).searchParams.get("checkedAt");

  if (!checkedAt) {
    return NextResponse.json({ error: "checkedAt is required." }, { status: 400 });
  }

  const nextStore = await deleteHealthReportByCheckedAt(checkedAt);

  if (!nextStore) {
    return NextResponse.json({ error: "Scan not found." }, { status: 404 });
  }

  return NextResponse.json(nextStore);
}
