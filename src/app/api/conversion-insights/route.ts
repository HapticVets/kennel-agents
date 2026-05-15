import { NextResponse } from "next/server";

import { runConversionAgent } from "@/lib/conversion-agent";
import {
  deleteApprovalStateByItem,
  deleteConversionInsightById,
  readConversionInsightReport,
  writeConversionInsightReport
} from "@/lib/storage";

export async function GET() {
  const report = await readConversionInsightReport();
  return NextResponse.json(report);
}

export async function POST() {
  // Conversion insights are generated from page structure only in this phase.
  const report = await runConversionAgent();
  const savedReport = await writeConversionInsightReport(report);

  return NextResponse.json(savedReport);
}

export async function DELETE(request: Request) {
  const itemId = new URL(request.url).searchParams.get("itemId");

  if (!itemId) {
    return NextResponse.json({ error: "itemId is required." }, { status: 400 });
  }

  const nextReport = await deleteConversionInsightById(itemId);

  if (!nextReport) {
    return NextResponse.json({ error: "Conversion insight not found." }, { status: 404 });
  }

  await deleteApprovalStateByItem(itemId, "conversion_insight");

  return NextResponse.json(nextReport);
}
