import { NextResponse } from "next/server";

import { runSectionRewriteAgent } from "@/lib/section-rewrite-agent";
import {
  readSectionRewriteReport,
  writeSectionRewriteReport
} from "@/lib/storage";

export async function GET() {
  const report = await readSectionRewriteReport();
  return NextResponse.json(report);
}

export async function POST() {
  // Section rewrites are generated from approved optimization insights and remain draft-only.
  const report = await runSectionRewriteAgent();
  const savedReport = await writeSectionRewriteReport(report);

  return NextResponse.json(savedReport);
}
