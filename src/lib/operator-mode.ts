import { updateApprovalStatus } from "@/lib/approval-queue";
import { publishToLiveSite, buildDeployStatusReport } from "@/lib/deploy-agent";
import { applyFaqPlacement, buildFaqPlacementReport } from "@/lib/faq-placement-agent";
import { runKennelHealthAgent } from "@/lib/health-agent";
import {
  applyOptimizationMerge,
  buildOptimizationMergeReport
} from "@/lib/optimization-merge-agent";
import { runOptimizationAgent } from "@/lib/optimization-agent";
import { runSectionRewriteAgent } from "@/lib/section-rewrite-agent";
import {
  appendHealthReport,
  readApprovalStates,
  readContentDraftReport,
  readHealthReportStore,
  readOptimizationMergeReport,
  readOptimizationInsightReport,
  readSectionRewriteReport,
  readVerificationReport,
  writeContentDraftReport,
  writeOptimizationInsightReport,
  writeSectionRewriteReport
} from "@/lib/storage";
import { runVerificationAgent } from "@/lib/verification-agent";
import { runContentAgent } from "@/lib/content-agent";
import type {
  ApprovalStatus,
  ContentDraft,
  OptimizationInsight,
  OperatorApplyItem,
  OperatorDashboardReport,
  OperatorSuggestionItem,
  OperatorSuggestionSource,
  SectionRewriteDraft
} from "@/types/health";

function truncate(value: string, length = 180): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= length) {
    return normalized;
  }

  return `${normalized.slice(0, length - 1).trim()}…`;
}

function getApprovalStatus(
  itemId: string,
  sourceType: OperatorSuggestionSource,
  approvals: Awaited<ReturnType<typeof readApprovalStates>>
): ApprovalStatus {
  return (
    approvals.find(
      (state) => state.itemId === itemId && state.sourceType === sourceType
    )?.status ?? "pending"
  );
}

function getContentDraftApprovalStatus(
  draft: ContentDraft,
  approvals: Awaited<ReturnType<typeof readApprovalStates>>
): ApprovalStatus {
  if (draft.status === "published") {
    return "consumed";
  }

  if (draft.status === "consumed") {
    return "consumed";
  }

  if (draft.status === "archived") {
    return "rejected";
  }

  if (draft.status === "approved" || draft.status === "placed") {
    return "approved";
  }

  return getApprovalStatus(draft.id, "content_draft", approvals);
}

function findRewriteForInsight(
  insight: OptimizationInsight,
  sectionRewriteReport: Awaited<ReturnType<typeof readSectionRewriteReport>>
): SectionRewriteDraft | undefined {
  return sectionRewriteReport.drafts.find(
    (draft) => draft.sourceInsightTitle === insight.issueTitle
  );
}

async function syncApprovedInsightRewrites(): Promise<{
  rewriteReport: Awaited<ReturnType<typeof readSectionRewriteReport>>;
  failedInsightIds: Set<string>;
}> {
  // Approved optimization insights should immediately create their paired rewrite
  // so Operator Mode does not require a separate rewrite-review step.
  const approvals = await readApprovalStates();
  const approvedInsightIds = new Set(
    approvals
      .filter(
        (state) =>
          state.sourceType === "optimization_insight" && state.status === "approved"
      )
      .map((state) => state.itemId)
  );

  if (approvedInsightIds.size === 0) {
    return {
      rewriteReport: await readSectionRewriteReport(),
      failedInsightIds: new Set<string>()
    };
  }

  const optimizationReport = await readOptimizationInsightReport();
  const approvedInsights = optimizationReport.insights.filter((insight) =>
    approvedInsightIds.has(insight.id)
  );

  const rewriteReport = await runSectionRewriteAgent();
  await writeSectionRewriteReport(rewriteReport);

  const nextApprovals = await readApprovalStates();
  const failedInsightIds = new Set<string>();

  for (const insight of approvedInsights) {
    const matchingRewrite = findRewriteForInsight(insight, rewriteReport);

    if (!matchingRewrite) {
      failedInsightIds.add(insight.id);
      continue;
    }

    const rewriteApproval = nextApprovals.find(
      (state) =>
        state.itemId === matchingRewrite.id &&
        state.sourceType === "section_rewrite"
    );

    if (
      rewriteApproval?.status !== "approved" &&
      rewriteApproval?.status !== "published" &&
      rewriteApproval?.status !== "consumed"
    ) {
      await updateApprovalStatus(matchingRewrite.id, "section_rewrite", "approved");
    }
  }

  return {
    rewriteReport: await readSectionRewriteReport(),
    failedInsightIds
  };
}

function buildSuggestionItems(
  approvals: Awaited<ReturnType<typeof readApprovalStates>>,
  optimizationReport: Awaited<ReturnType<typeof readOptimizationInsightReport>>,
  sectionRewriteReport: Awaited<ReturnType<typeof readSectionRewriteReport>>,
  contentDraftReport: Awaited<ReturnType<typeof readContentDraftReport>>,
  rewriteFailures: Set<string>
): OperatorSuggestionItem[] {
  const optimizationSuggestions = optimizationReport.insights
    .map((insight) => {
      const matchingRewrite = findRewriteForInsight(insight, sectionRewriteReport);
      const status = getApprovalStatus(insight.id, "optimization_insight", approvals);

      return {
        itemId: insight.id,
        sourceType: "optimization_insight" as const,
        status,
        title: insight.issueTitle,
        shortExplanation:
          status === "approved"
            ? rewriteFailures.has(insight.id)
              ? "Rewrite generation failed — review needed."
              : "Ready to apply."
            : insight.recommendedImprovement,
        preview:
          status === "approved" && matchingRewrite
            ? matchingRewrite.improvedRewrite
            : insight.improvementExample
      };
    })
    .filter(
      (item) =>
        item.status !== "rejected" &&
        item.status !== "published" &&
        item.status !== "consumed"
    );

  const contentSuggestions = contentDraftReport.drafts
    .map((draft) => ({
      itemId: draft.id,
      sourceType: "content_draft" as const,
      status: getContentDraftApprovalStatus(draft, approvals),
      title: draft.title,
      shortExplanation: draft.purpose,
      preview: draft.ctaSuggestion
        ? `${truncate(draft.draftText)} CTA: ${draft.ctaSuggestion}`
        : truncate(draft.draftText)
    }))
    .filter(
      (item) =>
        item.status !== "rejected" &&
        item.status !== "published" &&
        item.status !== "consumed"
    );

  return [...optimizationSuggestions, ...contentSuggestions];
}

function buildApprovedItems(
  approvals: Awaited<ReturnType<typeof readApprovalStates>>,
  optimizationReport: Awaited<ReturnType<typeof readOptimizationInsightReport>>,
  sectionRewriteReport: Awaited<ReturnType<typeof readSectionRewriteReport>>,
  contentDraftReport: Awaited<ReturnType<typeof readContentDraftReport>>,
  rewriteFailures: Set<string>
): OperatorApplyItem[] {
  const approvedRewriteIds = new Set(
    approvals
      .filter(
        (state) =>
          state.sourceType === "section_rewrite" &&
          (
            state.status === "approved" ||
            state.status === "published" ||
            state.status === "consumed"
          )
      )
      .map((state) => state.itemId)
  );

  const approvedOptimization = optimizationReport.insights
    .filter(
      (insight) =>
        getApprovalStatus(insight.id, "optimization_insight", approvals) === "approved"
    )
    .map((insight) => {
      const matchingRewrite = findRewriteForInsight(insight, sectionRewriteReport);
      const rewriteReady =
        matchingRewrite && approvedRewriteIds.has(matchingRewrite.id);

      return {
        itemId: insight.id,
        sourceType: "optimization_insight" as const,
        title: insight.issueTitle,
        readiness:
          rewriteFailures.has(insight.id) || !matchingRewrite
            ? "Rewrite generation failed — review needed."
            : rewriteReady
              ? "Ready to apply."
              : "Ready to apply."
      };
    });

  const approvedContent = contentDraftReport.drafts
    .filter((draft) => getContentDraftApprovalStatus(draft, approvals) === "approved")
    .map((draft) => ({
      itemId: draft.id,
      sourceType: "content_draft" as const,
      title: draft.title,
      readiness:
        draft.contentType === "faq_items"
          ? "Approved FAQ draft. Ready for homepage FAQ placement."
          : "Approved content draft. Stored for review, but no direct operator merge path exists yet."
    }));

  return [...approvedOptimization, ...approvedContent];
}

export async function buildOperatorDashboard(
  releaseOverride?: OperatorDashboardReport["release"]
): Promise<OperatorDashboardReport> {
  // Operator mode is a wrapper over the existing agent system. It summarizes
  // the current state into three buttons instead of replacing any underlying logic.
  const [
    healthStore,
    verificationReport,
    approvals,
    optimizationReport,
    sectionRewriteReport,
    contentDraftReport,
    deployReport
  ] = await Promise.all([
    readHealthReportStore(),
    readVerificationReport(),
    readApprovalStates(),
    readOptimizationInsightReport(),
    readSectionRewriteReport(),
    readContentDraftReport(),
    buildDeployStatusReport()
  ]);
  const rewriteFailures = new Set<string>();

  const issueFindings = healthStore.latest.findings.filter(
    (finding) => finding.severity === "high" || finding.severity === "medium"
  );
  const opportunityFindings = healthStore.latest.findings.filter(
    (finding) => finding.severity === "low"
  );
  const resolvedCount = verificationReport.records.filter(
    (record) => record.status === "verified_resolved"
  ).length;
  const stillFailingCount = verificationReport.records.filter(
    (record) => record.status === "still_failing"
  ).length;

  return {
    generatedAt: new Date().toISOString(),
    health: {
      lastRunAt: healthStore.latest.checkedAt,
      issues: issueFindings.length,
      opportunities: opportunityFindings.length,
      verificationSummary: verificationReport.records.length
        ? `${resolvedCount} resolved, ${stillFailingCount} still failing`
        : "Verification has not been run yet.",
      issueHighlights: issueFindings.slice(0, 5).map((finding) => finding.message),
      opportunityHighlights: opportunityFindings
        .slice(0, 5)
        .map((finding) => finding.message)
    },
    suggestions: {
      items: buildSuggestionItems(
        approvals,
        optimizationReport,
        sectionRewriteReport,
        contentDraftReport,
        rewriteFailures
      )
    },
    release:
      releaseOverride ?? {
        approvedItems: buildApprovedItems(
          approvals,
          optimizationReport,
          sectionRewriteReport,
          contentDraftReport,
          rewriteFailures
        ),
        changedFiles: deployReport.changedFiles,
        status: deployReport.publishStatus.status,
        message:
          deployReport.publishStatus.message ||
          (deployReport.changedFiles.length > 0
            ? "Local website changes are ready to publish."
            : "No local website changes are ready yet.")
      }
  };
}

export async function runOperatorHealthCheck(): Promise<OperatorDashboardReport> {
  const report = await runKennelHealthAgent();
  await appendHealthReport(report);
  await runVerificationAgent();

  return buildOperatorDashboard();
}

export async function generateOperatorSuggestions(): Promise<OperatorDashboardReport> {
  const optimizationReport = await runOptimizationAgent();
  await writeOptimizationInsightReport(optimizationReport);

  const existingContentReport = await readContentDraftReport();
  const batchId = `content-batch-${Date.now()}`;
  const contentReport = await runContentAgent(batchId);
  await writeContentDraftReport({
          ...contentReport,
          publishedDrafts: existingContentReport.publishedDrafts,
          consumedDrafts: existingContentReport.consumedDrafts,
          archivedDrafts: [
      ...existingContentReport.archivedDrafts,
      ...existingContentReport.drafts.map((draft) => ({
        ...draft,
        status: "archived" as const,
        updatedAt: contentReport.generatedAt
      }))
    ]
  });

  const approvals = await readApprovalStates();
  const hasApprovedOptimizationInsight = approvals.some(
    (state) =>
      state.sourceType === "optimization_insight" && state.status === "approved"
  );

  if (hasApprovedOptimizationInsight) {
    await syncApprovedInsightRewrites();
  }

  return buildOperatorDashboard();
}

export async function updateOperatorSuggestionStatus(
  itemId: string,
  sourceType: OperatorSuggestionSource,
  status: "approved" | "rejected"
): Promise<OperatorDashboardReport> {
  await updateApprovalStatus(itemId, sourceType, status);

  if (sourceType === "optimization_insight" && status === "approved") {
    const { failedInsightIds } = await syncApprovedInsightRewrites();

    return buildOperatorDashboard({
      approvedItems: buildApprovedItems(
        await readApprovalStates(),
        await readOptimizationInsightReport(),
        await readSectionRewriteReport(),
        await readContentDraftReport(),
        failedInsightIds
      ),
      changedFiles: (await buildDeployStatusReport()).changedFiles,
      status: "idle",
      message: failedInsightIds.has(itemId)
        ? "Rewrite generation failed — review needed."
        : "Approved item is ready to apply."
    });
  }

  return buildOperatorDashboard();
}

export async function applyOperatorChanges(): Promise<OperatorDashboardReport> {
  const approvals = await readApprovalStates();
  const { failedInsightIds } = await syncApprovedInsightRewrites();

  const faqPlacementReport = await buildFaqPlacementReport();
  for (const item of faqPlacementReport.items.filter((entry) => entry.status === "ready")) {
    await applyFaqPlacement(item.itemId);
  }

  const optimizationMergeReport = await buildOptimizationMergeReport();
  for (const item of optimizationMergeReport.items.filter((entry) => entry.status === "ready")) {
    await applyOptimizationMerge(item.itemId);
  }

  const deployBeforePublish = await buildDeployStatusReport();

  if (deployBeforePublish.changedFiles.length === 0) {
    return buildOperatorDashboard({
      approvedItems: buildApprovedItems(
        approvals,
        await readOptimizationInsightReport(),
        await readSectionRewriteReport(),
        await readContentDraftReport(),
        failedInsightIds
      ),
      changedFiles: [],
      status: "failed",
      message:
        failedInsightIds.size > 0
          ? "Rewrite generation failed — review needed."
          : "No local website changes were ready to publish. Approved items may still need a supported merge path."
    });
  }

  try {
    const deployReport = await publishToLiveSite();

    return buildOperatorDashboard({
      approvedItems: [],
      changedFiles: deployBeforePublish.changedFiles,
      status: "success",
      message: deployReport.publishStatus.message || "Website changes were published successfully."
    });
  } catch (error) {
    return buildOperatorDashboard({
      approvedItems: buildApprovedItems(
        await readApprovalStates(),
        await readOptimizationInsightReport(),
        await readSectionRewriteReport(),
        await readContentDraftReport(),
        failedInsightIds
      ),
      changedFiles: deployBeforePublish.changedFiles,
      status: "failed",
      message:
        error instanceof Error
          ? error.message
          : "Unable to publish approved website changes."
    });
  }
}
