import {
  applyFaqPlacement,
  buildFaqPlacementReport
} from "@/lib/faq-placement-agent";
import {
  applyOptimizationMerge,
  buildOptimizationMergeReport
} from "@/lib/optimization-merge-agent";
import {
  readStoredOptimizationInsightReport,
  readStoredSectionRewriteReport,
  readApprovalStates,
  readContentDraftReport,
  readPuppyListingReport,
  readConversionInsightReport,
  readProposedFixReport,
  writeApprovalStates
} from "@/lib/storage";
import type {
  ApprovalQueueItem,
  ApprovalQueueReport,
  ContentDraft,
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

function getUpdatedAtForItem(
  states: ApprovalState[],
  itemId: string,
  sourceType: ApprovalSourceType
): string | undefined {
  return states.find(
    (state) => state.itemId === itemId && state.sourceType === sourceType
  )?.updatedAt;
}

function getContentDraftQueueStatus(
  states: ApprovalState[],
  draft: ContentDraft
): ApprovalStatus {
  // Content drafts already carry lifecycle state, so the queue should respect
  // published history even if the approval record is older.
  if (draft.status === "published") {
    return "consumed";
  }

  if (draft.status === "consumed") {
    return "consumed";
  }

  if (draft.status === "archived") {
    return "rejected";
  }

  return getStatusForItem(states, draft.id, "content_draft");
}

async function runPostApprovalPreparation(
  itemId: string,
  sourceType: ApprovalSourceType
): Promise<void> {
  // Approval now prepares local site changes when a safe downstream action already
  // exists, but it intentionally stops before any commit, push, or deploy step.
  try {
    if (sourceType === "content_draft") {
      const draftReport = await readContentDraftReport();
      const draft = draftReport.drafts.find((entry) => entry.id === itemId);

      if (!draft || draft.contentType !== "faq_items") {
        return;
      }

      const faqPlacementReport = await buildFaqPlacementReport();
      const faqItem = faqPlacementReport.items.find((item) => item.itemId === itemId);

      if (process.env.KENNEL_HEALTH_DEBUG === "true") {
        console.log("[ApprovalPreparation]", {
          sourceType,
          itemId,
          preparation: "faq-placement",
          status: faqItem?.status ?? "missing"
        });
      }

      if (faqItem?.status === "ready") {
        await applyFaqPlacement(itemId);
      }

      return;
    }

    if (sourceType === "section_rewrite") {
      const optimizationMergeReport = await buildOptimizationMergeReport();
      const mergeItem = optimizationMergeReport.items.find((item) => item.itemId === itemId);

      if (process.env.KENNEL_HEALTH_DEBUG === "true") {
        console.log("[ApprovalPreparation]", {
          sourceType,
          itemId,
          preparation: "optimization-merge",
          status: mergeItem?.status ?? "missing"
        });
      }

      if (mergeItem?.status === "ready") {
        await applyOptimizationMerge(itemId);
      }
    }
  } catch (error) {
    if (process.env.KENNEL_HEALTH_DEBUG === "true") {
      console.log("[ApprovalPreparation]", {
        sourceType,
        itemId,
        error: error instanceof Error ? error.message : "Unknown preparation error."
      });
    }
  }
}

export async function buildApprovalQueue(): Promise<ApprovalQueueReport> {
  const [
    states,
    proposedFixReport,
    contentDraftReport,
    puppyListingReport,
    conversionInsightReport,
    optimizationInsightReport,
    sectionRewriteReport
  ] =
    await Promise.all([
      readApprovalStates(),
      readProposedFixReport(),
      readContentDraftReport(),
      readPuppyListingReport(),
      readConversionInsightReport(),
      readStoredOptimizationInsightReport(),
      readStoredSectionRewriteReport()
    ]);

  const items: ApprovalQueueItem[] = [
    ...proposedFixReport.fixes.map((fix) => ({
      itemId: fix.id,
      sourceType: "proposed_fix" as const,
      status: getStatusForItem(states, fix.id, "proposed_fix"),
      updatedAt: getUpdatedAtForItem(states, fix.id, "proposed_fix"),
      title: fix.issueTitle,
      pageUrl: fix.pageUrl,
      severity: fix.severity,
      categoryOrType: fix.category,
      summary: fix.recommendedFix
    })),
    ...[
      ...contentDraftReport.drafts,
      ...contentDraftReport.publishedDrafts,
      ...contentDraftReport.consumedDrafts
    ].map((draft) => ({
      itemId: draft.id,
      sourceType: "content_draft" as const,
      status: getContentDraftQueueStatus(states, draft),
      updatedAt:
        getUpdatedAtForItem(states, draft.id, "content_draft") ?? draft.updatedAt,
      title: draft.title,
      categoryOrType: draft.contentType,
      summary: draft.purpose
    })),
    ...[
      ...puppyListingReport.drafts,
      ...puppyListingReport.consumedDrafts
    ].map((draft) => ({
      itemId: draft.id,
      sourceType: "puppy_listing" as const,
      status: getStatusForItem(states, draft.id, "puppy_listing"),
      updatedAt: getUpdatedAtForItem(states, draft.id, "puppy_listing") ?? draft.updatedAt,
      title: draft.listingTitle,
      categoryOrType: draft.availability,
      summary: draft.shortSummary
    })),
    ...conversionInsightReport.insights.map((insight) => ({
      itemId: insight.id,
      sourceType: "conversion_insight" as const,
      status: getStatusForItem(states, insight.id, "conversion_insight"),
      updatedAt: getUpdatedAtForItem(states, insight.id, "conversion_insight"),
      title: insight.issueOrObservation,
      pageUrl: insight.pageUrl,
      severity: insight.severity,
      categoryOrType: insight.category,
      summary: insight.recommendation
    })),
    ...optimizationInsightReport.insights.map((insight) => ({
      itemId: insight.id,
      sourceType: "optimization_insight" as const,
      status: getStatusForItem(states, insight.id, "optimization_insight"),
      updatedAt: getUpdatedAtForItem(states, insight.id, "optimization_insight"),
      title: insight.issueTitle,
      pageUrl: optimizationInsightReport.pageUrl,
      severity: insight.severity,
      categoryOrType: insight.category,
      summary: insight.recommendedImprovement
    })),
    ...sectionRewriteReport.drafts.map((draft) => ({
      itemId: draft.id,
      sourceType: "section_rewrite" as const,
      status: getStatusForItem(states, draft.id, "section_rewrite"),
      updatedAt: getUpdatedAtForItem(states, draft.id, "section_rewrite"),
      title: draft.sourceInsightTitle,
      pageUrl: sectionRewriteReport.pageUrl,
      categoryOrType: draft.sectionName,
      summary: draft.improvedRewrite
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

  if (
    process.env.KENNEL_HEALTH_DEBUG === "true" &&
    sourceType === "puppy_listing" &&
    status === "approved"
  ) {
    console.log("[PuppyListingLifecycle]", {
      itemId,
      transition: "approved",
      updatedAt
    });
  }

  if (status === "approved") {
    await runPostApprovalPreparation(itemId, sourceType);
  }

  return buildApprovalQueue();
}
