import { NextResponse } from "next/server";

import { runOptimizationAgent } from "@/lib/optimization-agent";
import {
  readOptimizationInsightReport,
  writeOptimizationInsightReport
} from "@/lib/storage";

export async function GET() {
  const report = await readOptimizationInsightReport();
  return NextResponse.json(report);
}

export async function POST() {
  // Optimization insights are read-only analysis output and do not modify any site files.
  const report = await runOptimizationAgent();
  const savedReport = await writeOptimizationInsightReport(report);

  return NextResponse.json(savedReport);
}
