import { NextResponse } from "next/server";

import { runConversionAgent } from "@/lib/conversion-agent";
import {
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
