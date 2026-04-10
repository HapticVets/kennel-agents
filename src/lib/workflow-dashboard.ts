import { buildDeployStatusReport } from "@/lib/deploy-agent";
import { TARGET_SITE_PATH } from "@/lib/config";
import { buildOptimizationMergeReport } from "@/lib/optimization-merge-agent";
import {
  readApprovalStates,
  readHealthReportStore,
  readOptimizationInsightReport,
  readSectionRewriteReport,
  readVerificationReport
} from "@/lib/storage";
import type {
  ApprovalState,
  OptimizationMergeItem,
  VerificationRecord
} from "@/types/health";

type WorkflowStageId =
  | "health_findings"
  | "optimization_insights"
  | "approvals"
  | "section_rewrites"
  | "optimization_merge"
  | "verification";

export interface WorkflowStageSummary {
  id: WorkflowStageId;
  title: string;
  itemCount: number;
  currentStatus: string;
  blocked: boolean;
  blockedReason?: string;
  recommendedNextAction: string;
  actionLabel: string;
  actionHref: string;
}

export interface WorkflowActionSummary {
  title: string;
  description: string;
  href: string;
  label: string;
}

export interface WorkflowDashboardSummary {
  nextBestAction: WorkflowActionSummary;
  stages: WorkflowStageSummary[];
}

function buildHostedModeDeployReport() {
  const message =
    "Local SEO/content release tooling is unavailable in this hosted environment. Puppy listings remain available through the Supabase-backed dashboard.";

  return {
    generatedAt: new Date().toISOString(),
    repoPath: TARGET_SITE_PATH,
    currentBranch: "unavailable",
    gitStatusSummary: message,
    isClean: true,
    isAheadOfRemote: false,
    changedFiles: [],
    suggestedCommitMessage: "",
    commitStatus: {
      status: "idle" as const,
      message: "",
      updatedAt: ""
    },
    pushStatus: {
      status: "idle" as const,
      message: "",
      updatedAt: ""
    },
    publishStatus: {
      status: "idle" as const,
      message,
      updatedAt: new Date().toISOString()
    },
    readyForVerification: false,
    lastPublishResult: message
  };
}

async function safeBuildDeployStatusReport() {
  try {
    return await buildDeployStatusReport();
  } catch (error) {
    if (process.env.KENNEL_HEALTH_DEBUG === "true") {
      console.log("[WorkflowDeployStatusFallback]", {
        reason: error instanceof Error ? error.message : "Unknown deploy status error."
      });
    }

    return buildHostedModeDeployReport();
  }
}

function countApprovals(
  states: ApprovalState[],
  sourceType: "optimization_insight" | "section_rewrite",
  status?: "pending" | "approved" | "rejected" | "published"
): number {
  return states.filter(
    (state) =>
      state.sourceType === sourceType && (!status || state.status === status)
  ).length;
}

function countVerificationStatus(
  records: VerificationRecord[],
  status: "verified_resolved" | "still_failing"
): number {
  return records.filter((record) => record.status === status).length;
}

function countMergeStatus(
  items: OptimizationMergeItem[],
  status: "ready" | "applied" | "skipped" | "unmatched" | "failed"
): number {
  return items.filter((item) => item.status === status).length;
}

function buildApprovalStatusMap(states: ApprovalState[]): Map<string, ApprovalState["status"]> {
  return new Map(states.map((state) => [`${state.sourceType}:${state.itemId}`, state.status]));
}

export async function buildWorkflowDashboard(): Promise<WorkflowDashboardSummary> {
  // The workflow page is intentionally read-only. It derives operator guidance
  // from the existing reports and approval state instead of changing agent behavior.
  const [
    healthStore,
    optimizationReport,
    approvals,
    sectionRewriteReport,
    verificationReport,
    deployReport
  ] = await Promise.all([
    readHealthReportStore(),
    readOptimizationInsightReport(),
    readApprovalStates(),
    readSectionRewriteReport(),
    readVerificationReport(),
    safeBuildDeployStatusReport()
  ]);

  let optimizationMergeItems: OptimizationMergeItem[] = [];
  let optimizationMergeError = "";

  try {
    const optimizationMergeReport = await buildOptimizationMergeReport();
    optimizationMergeItems = optimizationMergeReport.items;
  } catch (error) {
    optimizationMergeError =
      error instanceof Error
        ? error.message
        : "Optimization merge previews could not be loaded.";
  }

  const healthFindings = healthStore.latest.findings;
  const hasHealthScan = Boolean(healthStore.latest.checkedAt);
  const approvalStatusMap = buildApprovalStatusMap(approvals);
  // Rejected items stay in stored history, but workflow guidance should only
  // count items that still need action or can move to the next stage.
  const optimizationInsights = optimizationReport.insights.filter(
    (insight) =>
      approvalStatusMap.get(`optimization_insight:${insight.id}`) !== "rejected" &&
      approvalStatusMap.get(`optimization_insight:${insight.id}`) !== "published"
  );
  const activeSectionRewrites = sectionRewriteReport.drafts.filter(
    (draft) =>
      approvalStatusMap.get(`section_rewrite:${draft.id}`) !== "rejected" &&
      approvalStatusMap.get(`section_rewrite:${draft.id}`) !== "published"
  );
  const pendingOptimizationInsightApprovals = countApprovals(
    approvals,
    "optimization_insight",
    "pending"
  );
  const approvedOptimizationInsights = countApprovals(
    approvals,
    "optimization_insight",
    "approved"
  );
  const pendingSectionRewriteApprovals = countApprovals(
    approvals,
    "section_rewrite",
    "pending"
  );
  const approvedSectionRewrites = countApprovals(
    approvals,
    "section_rewrite",
    "approved"
  );
  const readyOptimizationMerges = countMergeStatus(optimizationMergeItems, "ready");
  const unmatchedOptimizationMerges = countMergeStatus(
    optimizationMergeItems,
    "unmatched"
  );
  const appliedOptimizationMerges = countMergeStatus(
    optimizationMergeItems,
    "applied"
  );
  const verificationResolved = countVerificationStatus(
    verificationReport.records,
    "verified_resolved"
  );
  const verificationStillFailing = countVerificationStatus(
    verificationReport.records,
    "still_failing"
  );

  const stages: WorkflowStageSummary[] = [
    {
      id: "health_findings",
      title: "Health findings",
      itemCount: healthFindings.length,
      currentStatus: !hasHealthScan
        ? "No scan run yet"
        : healthFindings.length === 0
          ? "Healthy"
          : "Issues detected",
      blocked: false,
      recommendedNextAction: !hasHealthScan
        ? "Run the health scan to create a baseline."
        : healthFindings.length > 0
          ? "Review the latest health findings."
          : "Health checks are clear. Move on to optimization review.",
      actionLabel: !hasHealthScan ? "Open Health Findings" : "Review Health Findings",
      actionHref: "/admin/health"
    },
    {
      id: "optimization_insights",
      title: "Optimization insights",
      itemCount: optimizationInsights.length,
      currentStatus: optimizationInsights.length === 0
        ? "Not generated"
        : pendingOptimizationInsightApprovals > 0
          ? "Needs review"
          : approvedOptimizationInsights > 0
            ? "Approved insights available"
            : "Generated",
      blocked: !hasHealthScan,
      blockedReason: !hasHealthScan
        ? "No health baseline exists yet, so optimization review should wait until the first scan is run."
        : optimizationInsights.length === 0
          ? "No optimization insights have been generated yet."
          : undefined,
      recommendedNextAction: !hasHealthScan
        ? "Run a health scan first."
        : optimizationInsights.length === 0
          ? "Open Optimization Insights and generate the homepage analysis."
          : pendingOptimizationInsightApprovals > 0
            ? "Review and approve the optimization insights you want to use."
            : "Optimization insights are ready for the next stage.",
      actionLabel: optimizationInsights.length === 0
        ? "Open Optimization Insights"
        : "Review Optimization Insights",
      actionHref: "/admin/optimization-insights"
    },
    {
      id: "approvals",
      title: "Approvals",
      itemCount:
        pendingOptimizationInsightApprovals +
        approvedOptimizationInsights +
        pendingSectionRewriteApprovals +
        approvedSectionRewrites,
      currentStatus:
        pendingOptimizationInsightApprovals + pendingSectionRewriteApprovals > 0
          ? "Pending review"
          : approvedOptimizationInsights + approvedSectionRewrites > 0
            ? "Current approvals in place"
            : "No optimization approvals yet",
      blocked: optimizationInsights.length === 0 && activeSectionRewrites.length === 0,
      blockedReason:
        optimizationInsights.length === 0 && activeSectionRewrites.length === 0
          ? "No optimization insights or section rewrites exist yet, so there is nothing new to review."
          : undefined,
      recommendedNextAction:
        pendingOptimizationInsightApprovals + pendingSectionRewriteApprovals > 0
          ? "Open Approvals and review pending optimization insights or section rewrites."
          : approvedOptimizationInsights === 0 && optimizationInsights.length > 0
            ? "Approve the optimization insights you want to turn into copy."
            : approvedSectionRewrites === 0 && activeSectionRewrites.length > 0
              ? "Approve the section rewrites you want to merge."
              : "Approvals are up to date for the current optimization workflow.",
      actionLabel: "Open Approvals",
      actionHref: "/admin/approvals"
    },
    {
      id: "section_rewrites",
      title: "Section rewrites",
      itemCount: activeSectionRewrites.length,
      currentStatus: activeSectionRewrites.length === 0
        ? "Not generated"
        : pendingSectionRewriteApprovals > 0
          ? "Needs approval"
          : approvedSectionRewrites > 0
            ? "Approved rewrites available"
            : "Drafts generated",
      blocked: approvedOptimizationInsights === 0,
      blockedReason: approvedOptimizationInsights === 0
        ? "No optimization insights have been approved yet, so rewrite generation has no approved guidance to work from."
        : activeSectionRewrites.length === 0
          ? "No section rewrite drafts have been generated yet."
          : undefined,
      recommendedNextAction: approvedOptimizationInsights === 0
        ? "Approve at least one optimization insight first."
        : activeSectionRewrites.length === 0
          ? "Open Section Rewrites and generate draft replacement copy."
          : pendingSectionRewriteApprovals > 0
            ? "Approve the rewrite drafts that are ready to merge."
            : "Section rewrites are ready for merge review.",
      actionLabel: activeSectionRewrites.length === 0
        ? "Open Section Rewrites"
        : "Review Section Rewrites",
      actionHref: "/admin/section-rewrites"
    },
    {
      id: "optimization_merge",
      title: "Optimization merge",
      itemCount: optimizationMergeItems.length,
      currentStatus: optimizationMergeError
        ? "Merge preview unavailable"
        : optimizationMergeItems.length === 0
          ? "No merge previews"
          : readyOptimizationMerges > 0
            ? "Ready to merge"
            : appliedOptimizationMerges > 0
              ? "Merges applied"
              : unmatchedOptimizationMerges > 0
                ? "Needs manual review"
                : "Queued",
      blocked: Boolean(optimizationMergeError) || approvedSectionRewrites === 0,
      blockedReason: optimizationMergeError
        ? optimizationMergeError
        : approvedSectionRewrites === 0
          ? "No optimization merge previews yet because no section rewrites have been approved."
          : optimizationMergeItems.length === 0
            ? "No safe merge previews are available yet."
            : undefined,
      recommendedNextAction: optimizationMergeError
        ? "Resolve the merge preview issue before applying changes."
        : approvedSectionRewrites === 0
          ? "Approve section rewrites first."
          : readyOptimizationMerges > 0
            ? "Open Optimization Merge and apply the approved replacements."
            : unmatchedOptimizationMerges > 0
              ? "Review unmatched fields before attempting a merge."
              : appliedOptimizationMerges > 0
                ? "Optimization merges have been applied. Verification is the next step."
                : "Open Optimization Merge to review the current queue.",
      actionLabel: "Open Optimization Merge",
      actionHref: "/admin/optimization-merge"
    },
    {
      id: "verification",
      title: "Verification",
      itemCount: verificationReport.records.length,
      currentStatus: verificationReport.records.length === 0
        ? "Not run yet"
        : verificationStillFailing > 0
          ? "Still failing"
          : verificationResolved > 0
            ? "Resolved findings verified"
            : "Verification recorded",
      blocked: appliedOptimizationMerges === 0,
      blockedReason: appliedOptimizationMerges === 0
        ? "Verification is most useful after changes have been merged into the real site files."
        : verificationReport.records.length === 0
          ? "No verification run has been saved yet."
          : undefined,
      recommendedNextAction: appliedOptimizationMerges === 0
        ? "Apply at least one optimization merge before verification."
        : verificationReport.records.length === 0
          ? "Open Verification and run a fresh check."
          : verificationStillFailing > 0
            ? "Review the still-failing records and re-check after further changes."
            : "Verification is current.",
      actionLabel: "Open Verification",
      actionHref: "/admin/verification"
    }
  ];

  const nextBestAction =
    !hasHealthScan
      ? {
          title: "Run the health scan",
          description: "The workflow has no baseline yet, so the first step is to create a current health report.",
          href: "/admin/health",
          label: "Open Health Findings"
        }
      : deployReport.changedFiles.length > 0
        ? {
            title: "Publish SEO/content changes",
            description: "Merged local SEO/content website file changes are ready in the repo. Puppy listing inventory updates are already dynamic.",
            href: "/admin/deploy",
            label: "Open Release"
          }
      : optimizationInsights.length === 0
        ? {
            title: "Review optimization insights",
            description: "No homepage optimization analysis is stored yet, so generate that before moving further downstream.",
            href: "/admin/optimization-insights",
            label: "Open Optimization Insights"
          }
        : pendingOptimizationInsightApprovals > 0
          ? {
              title: "Approve optimization insights",
              description: "There are optimization insights waiting for review before rewrite generation can move forward.",
              href: "/admin/approvals",
              label: "Open Approvals"
            }
          : activeSectionRewrites.length === 0
            ? {
                title: "Generate section rewrites",
                description: "Approved optimization insights exist, but no rewrite drafts have been generated from them yet.",
                href: "/admin/section-rewrites",
                label: "Open Section Rewrites"
              }
            : pendingSectionRewriteApprovals > 0
              ? {
                  title: "Approve section rewrites",
                  description: "Rewrite drafts are ready, but they still need approval before merge previews can be created.",
                  href: "/admin/approvals",
                  label: "Open Approvals"
                }
              : readyOptimizationMerges > 0
                ? {
                    title: "Open optimization merge",
                    description: "Approved rewrite drafts now have safe merge previews ready for review and application.",
                    href: "/admin/optimization-merge",
                    label: "Open Optimization Merge"
                  }
                : appliedOptimizationMerges > 0 && verificationReport.records.length === 0
                  ? {
                      title: "Run verification",
                      description: "Homepage changes have been merged, so the next step is to verify whether earlier findings are resolved.",
                      href: "/admin/verification",
                      label: "Open Verification"
                    }
                  : verificationStillFailing > 0
                    ? {
                        title: "Review verification failures",
                        description: "Some findings are still failing after the last verification run and need another pass.",
                        href: "/admin/verification",
                        label: "Open Verification"
                      }
                    : {
                        title: "Workflow is caught up",
                        description: "The current optimization pipeline has no obvious blockers. Review the workflow stages for anything you want to revisit.",
                        href: "/admin/workflow",
                        label: "Refresh Workflow"
                      };

  return {
    nextBestAction,
    stages
  };
}
