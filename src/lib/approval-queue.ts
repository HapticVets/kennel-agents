import {
  readApprovalStates,
  readContentDraftReport,
  readConversionInsightReport,
  readProposedFixReport,
  writeApprovalStates
} from "@/lib/storage";
import type {
  ApprovalQueueItem,
  ApprovalQueueReport,
  ApprovalSourceType,
  ApprovalState,
  ApprovalStatus
} from "@/types/health";

function getStatusForItem(
  states: ApprovalState[],
  itemId: string,
  sourceType: ApprovalSourceType
): ApprovalStatus {
  const match = states.find(
    (state) => state.itemId === itemId && state.sourceType === sourceType
  );

  return match?.status ?? "pending";
}

export async function buildApprovalQueue(): Promise<ApprovalQueueReport> {
  const [states, proposedFixReport, contentDraftReport, conversionInsightReport] =
    await Promise.all([
      readApprovalStates(),
      readProposedFixReport(),
      readContentDraftReport(),
      readConversionInsightReport()
    ]);

  const items: ApprovalQueueItem[] = [
    ...proposedFixReport.fixes.map((fix) => ({
      itemId: fix.id,
      sourceType: "proposed_fix" as const,
      status: getStatusForItem(states, fix.id, "proposed_fix"),
      title: fix.issueTitle,
      pageUrl: fix.pageUrl,
      severity: fix.severity,
      categoryOrType: fix.category,
      summary: fix.recommendedFix
    })),
    ...contentDraftReport.drafts.map((draft) => ({
      itemId: draft.id,
      sourceType: "content_draft" as const,
      status: getStatusForItem(states, draft.id, "content_draft"),
      title: draft.title,
      categoryOrType: draft.contentType,
      summary: draft.purpose
    })),
    ...conversionInsightReport.insights.map((insight) => ({
      itemId: insight.id,
      sourceType: "conversion_insight" as const,
      status: getStatusForItem(states, insight.id, "conversion_insight"),
      title: insight.issueOrObservation,
      pageUrl: insight.pageUrl,
      severity: insight.severity,
      categoryOrType: insight.category,
      summary: insight.recommendation
    }))
  ];

  return {
    generatedAt: new Date().toISOString(),
    items
  };
}

export async function updateApprovalStatus(
  itemId: string,
  sourceType: ApprovalSourceType,
  status: ApprovalStatus
): Promise<ApprovalQueueReport> {
  const currentStates = await readApprovalStates();
  const updatedAt = new Date().toISOString();
  const nextStates = currentStates.filter(
    (state) => !(state.itemId === itemId && state.sourceType === sourceType)
  );

  nextStates.push({
    itemId,
    sourceType,
    status,
    updatedAt
  });

  await writeApprovalStates(nextStates);
  return buildApprovalQueue();
}
