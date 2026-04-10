import { NextResponse } from "next/server";

import { runContentAgent } from "@/lib/content-agent";
import { readContentDraftReport, writeContentDraftReport } from "@/lib/storage";

export async function GET() {
  const report = await readContentDraftReport();
  return NextResponse.json(report);
}

export async function POST() {
  // Generating content creates a fresh batch so the active draft queue does not silently recycle old suggestions.
  const existingReport = await readContentDraftReport();
  const batchId = `content-batch-${Date.now()}`;
  const report = await runContentAgent(batchId);
  const archivedDrafts = [
    ...existingReport.archivedDrafts,
    ...existingReport.drafts.map((draft) => ({
      ...draft,
      status: "archived" as const,
      updatedAt: report.generatedAt
    }))
  ];
  const savedReport = await writeContentDraftReport({
    ...report,
    publishedDrafts: existingReport.publishedDrafts,
    consumedDrafts: existingReport.consumedDrafts,
    archivedDrafts
  });

  return NextResponse.json(savedReport);
}
