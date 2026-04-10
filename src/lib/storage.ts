import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import { MAX_SCAN_HISTORY } from "@/lib/config";
import {
  readPuppyListingReportFromDatabase,
  writePuppyListingReportToDatabase
} from "@/lib/puppy-listing-store";
import type {
  ApplyResult,
  ApprovalState,
  ApprovalSourceType,
  ContentDraft,
  ContentDraftReport,
  ContentDraftStatus,
  DeployActionState,
  FaqPlacementReport,
  ConversionInsightReport,
  HealthReport,
  HealthReportStore,
  MergeResult,
  OptimizationMergeReport,
  OptimizationInsightReport,
  PuppyListingDraft,
  PuppyPlacementReport,
  PuppyListingReport,
  ProposedFixReport,
  SectionRewriteReport,
  VerificationReport
} from "@/types/health";

const dataDirectory = path.join(process.cwd(), "data");
const findingsFilePath = path.join(dataDirectory, "findings.json");
const proposedFixesFilePath = path.join(dataDirectory, "proposed-fixes.json");
const contentDraftsFilePath = path.join(dataDirectory, "content-drafts.json");
const puppyListingsFilePath = path.join(dataDirectory, "puppy-listings.json");
const conversionInsightsFilePath = path.join(dataDirectory, "conversion-insights.json");
const approvalsFilePath = path.join(dataDirectory, "approvals.json");
const applyResultsFilePath = path.join(dataDirectory, "apply-results.json");
const mergeResultsFilePath = path.join(dataDirectory, "merge-results.json");
const verificationFilePath = path.join(dataDirectory, "verification.json");
const optimizationInsightsFilePath = path.join(dataDirectory, "optimization-insights.json");
const sectionRewritesFilePath = path.join(dataDirectory, "section-rewrites.json");
const optimizationMergeResultsFilePath = path.join(
  dataDirectory,
  "optimization-merge-results.json"
);
const deployStateFilePath = path.join(dataDirectory, "deploy-state.json");
const faqPlacementResultsFilePath = path.join(dataDirectory, "faq-placement-results.json");
const puppyPlacementResultsFilePath = path.join(dataDirectory, "puppy-placement-results.json");

const emptyReport = (): HealthReport => ({
  checkedAt: "",
  baseUrl: "",
  findings: []
});

const emptyStore = (): HealthReportStore => ({
  latest: emptyReport(),
  history: []
});

const emptyProposedFixReport = (): ProposedFixReport => ({
  generatedAt: "",
  sourceCheckedAt: "",
  fixes: []
});

const emptyContentDraftReport = (): ContentDraftReport => ({
  generatedAt: "",
  activeBatchId: "",
  drafts: [],
  publishedDrafts: [],
  consumedDrafts: [],
  archivedDrafts: []
});
const emptyPuppyListingReport = (): PuppyListingReport => ({
  generatedAt: "",
  activeBatchId: "",
  drafts: [],
  consumedDrafts: [],
  archivedDrafts: []
});

const emptyConversionInsightReport = (): ConversionInsightReport => ({
  generatedAt: "",
  insights: []
});

const emptyApprovalStates = (): ApprovalState[] => [];
const emptyApplyResults = (): ApplyResult[] => [];
const emptyMergeResults = (): MergeResult[] => [];
const emptyVerificationReport = (): VerificationReport => ({
  generatedAt: "",
  records: []
});
const emptyOptimizationInsightReport = (): OptimizationInsightReport => ({
  generatedAt: "",
  pageUrl: "",
  insights: []
});
const emptySectionRewriteReport = (): SectionRewriteReport => ({
  generatedAt: "",
  pageUrl: "",
  drafts: []
});
const emptyOptimizationMergeReport = (): OptimizationMergeReport => ({
  generatedAt: "",
  items: []
});
const emptyDeployActionState = (): DeployActionState => ({
  status: "idle",
  message: "",
  updatedAt: ""
});
const emptyFaqPlacementReport = (): FaqPlacementReport => ({
  generatedAt: "",
  items: []
});
const emptyPuppyPlacementReport = (): PuppyPlacementReport => ({
  generatedAt: "",
  items: []
});

function parseApprovalKey(key: string): {
  sourceType: ApprovalSourceType;
  itemId: string;
} | null {
  const separatorIndex = key.indexOf(":");

  if (separatorIndex === -1) {
    return null;
  }

  const sourceType = key.slice(0, separatorIndex) as ApprovalSourceType;
  const itemId = key.slice(separatorIndex + 1);

  if (!sourceType || !itemId) {
    return null;
  }

  return {
    sourceType,
    itemId
  };
}

async function readRawContentDraftReport(): Promise<ContentDraftReport> {
  try {
    const fileContents = await readFile(contentDraftsFilePath, "utf8");
    const parsedReport = JSON.parse(fileContents) as ContentDraftReport;
    const normalizedReport = normalizeContentDraftReport(parsedReport);

    if (JSON.stringify(parsedReport) !== JSON.stringify(normalizedReport)) {
      await mkdir(dataDirectory, { recursive: true });
      await writeFile(
        contentDraftsFilePath,
        JSON.stringify(normalizedReport, null, 2),
        "utf8"
      );
    }

    return normalizedReport;
  } catch {
    return emptyContentDraftReport();
  }
}

async function readRawOptimizationInsightReport(): Promise<OptimizationInsightReport> {
  try {
    const fileContents = await readFile(optimizationInsightsFilePath, "utf8");
    return JSON.parse(fileContents) as OptimizationInsightReport;
  } catch {
    return emptyOptimizationInsightReport();
  }
}

async function readRawSectionRewriteReport(): Promise<SectionRewriteReport> {
  try {
    const fileContents = await readFile(sectionRewritesFilePath, "utf8");
    return JSON.parse(fileContents) as SectionRewriteReport;
  } catch {
    return emptySectionRewriteReport();
  }
}

async function readRawDeployActionState(): Promise<{
  commitStatus: DeployActionState;
  pushStatus: DeployActionState;
  publishStatus: DeployActionState;
}> {
  try {
    const fileContents = await readFile(deployStateFilePath, "utf8");
    return JSON.parse(fileContents) as {
      commitStatus: DeployActionState;
      pushStatus: DeployActionState;
      publishStatus: DeployActionState;
    };
  } catch {
    return {
      commitStatus: emptyDeployActionState(),
      pushStatus: emptyDeployActionState(),
      publishStatus: emptyDeployActionState()
    };
  }
}

async function readRawApprovalStates(): Promise<ApprovalState[]> {
  try {
    const fileContents = await readFile(approvalsFilePath, "utf8");
    return JSON.parse(fileContents) as ApprovalState[];
  } catch {
    return emptyApprovalStates();
  }
}

export async function readStoredOptimizationInsightReport(): Promise<OptimizationInsightReport> {
  return readRawOptimizationInsightReport();
}

export async function readStoredSectionRewriteReport(): Promise<SectionRewriteReport> {
  return readRawSectionRewriteReport();
}

function buildPublishedRewriteSet(
  rewriteReport: SectionRewriteReport,
  optimizationMergeReport: OptimizationMergeReport
): {
  publishedRewriteIds: Set<string>;
  publishedInsightTitles: Set<string>;
} {
  const publishedRewriteIds = new Set(
    optimizationMergeReport.items
      .filter((item) => item.status === "applied")
      .map((item) => item.itemId)
  );

  const publishedInsightTitles = new Set(
    rewriteReport.drafts
      .filter((draft) => publishedRewriteIds.has(draft.id))
      .map((draft) => draft.sourceInsightTitle)
  );

  return { publishedRewriteIds, publishedInsightTitles };
}

async function applyConsumedSourceTransition(
  completedAt: string
): Promise<{
  consumedContentDraftIds: string[];
  consumedApprovalKeys: string[];
  updatedApprovalKeys: string[];
}> {
  const [
    rawContentDraftReport,
    rawApprovalStates,
    mergeResults,
    faqPlacementReport,
    optimizationMergeReport,
    rewriteReport,
    optimizationInsightReport
  ] = await Promise.all([
    readRawContentDraftReport(),
    readRawApprovalStates(),
    readMergeResults(),
    readFaqPlacementReport(),
    readOptimizationMergeReport(),
    readRawSectionRewriteReport(),
    readRawOptimizationInsightReport()
  ]);

  const consumedProposedFixIds = new Set(
    mergeResults
      .filter((result) => result.sourceType === "proposed_fix" && result.status === "applied")
      .map((result) => result.itemId)
  );
  const consumedContentDraftIds = new Set([
    ...mergeResults
      .filter((result) => result.sourceType === "content_draft" && result.status === "applied")
      .map((result) => result.itemId),
    ...faqPlacementReport.items
      .filter((item) => item.status === "applied")
      .map((item) => item.itemId)
  ]);
  const consumedSectionRewriteIds = new Set(
    optimizationMergeReport.items
      .filter((item) => item.status === "applied")
      .map((item) => item.itemId)
  );
  const consumedInsightTitles = new Set(
    rewriteReport.drafts
      .filter((draft) => consumedSectionRewriteIds.has(draft.id))
      .map((draft) => draft.sourceInsightTitle)
  );
  const consumedOptimizationInsightIds = new Set(
    optimizationInsightReport.insights
      .filter((insight) => consumedInsightTitles.has(insight.issueTitle))
      .map((insight) => insight.id)
  );

  const allDrafts = [
    ...rawContentDraftReport.drafts,
    ...rawContentDraftReport.publishedDrafts,
    ...(rawContentDraftReport.consumedDrafts ?? []),
    ...rawContentDraftReport.archivedDrafts
  ];
  const nextContentDraftReport = normalizeContentDraftReport({
    ...rawContentDraftReport,
    drafts: allDrafts
      .map((draft) =>
        consumedContentDraftIds.has(draft.id)
          ? {
              ...draft,
              status: "consumed" as const,
              updatedAt: completedAt
            }
          : draft
      )
      .filter((draft) => draft.status === "draft" || draft.status === "approved"),
    publishedDrafts: allDrafts
      .filter((draft) => draft.status === "placed" || draft.status === "published"),
    consumedDrafts: allDrafts
      .map((draft) =>
        consumedContentDraftIds.has(draft.id)
          ? {
              ...draft,
              status: "consumed" as const,
              updatedAt: completedAt
            }
          : draft
      )
      .filter((draft) => draft.status === "consumed"),
    archivedDrafts: allDrafts.filter((draft) => draft.status === "archived")
  });
  const consumedApprovalKeys = [
    ...[...consumedProposedFixIds].map((itemId) => `proposed_fix:${itemId}`),
    ...[...consumedContentDraftIds].map((itemId) => `content_draft:${itemId}`),
    ...[...consumedSectionRewriteIds].map((itemId) => `section_rewrite:${itemId}`),
    ...[...consumedOptimizationInsightIds].map(
      (itemId) => `optimization_insight:${itemId}`
    )
  ];
  const consumedApprovalRefs = consumedApprovalKeys
    .map(parseApprovalKey)
    .filter((entry): entry is { sourceType: ApprovalSourceType; itemId: string } => Boolean(entry));

  const updatedApprovalKeys: string[] = [];
  const skippedApprovalKeys: string[] = [];
  const nextApprovalStates: ApprovalState[] = rawApprovalStates.map((state) => {
    const approvalKey = `${state.sourceType}:${state.itemId}`;
    const shouldConsume = consumedApprovalRefs.some(
      (ref) => ref.sourceType === state.sourceType && ref.itemId === state.itemId
    );
    const shouldMigrateLegacyPublished =
      state.status === "published" && state.sourceType !== "puppy_listing";

    if ((!shouldConsume && !shouldMigrateLegacyPublished) || state.status === "consumed") {
      if (shouldConsume && state.status === "consumed") {
        skippedApprovalKeys.push(`${approvalKey} (already consumed)`);
      }
      return state;
    }

    if (state.status === "rejected") {
      skippedApprovalKeys.push(`${approvalKey} (rejected)`);
      return state;
    }

    updatedApprovalKeys.push(approvalKey);

    return {
      ...state,
      status: "consumed" as const,
      updatedAt: completedAt
    };
  });
  const repairedOrphanedApprovalKeys: string[] = [];

  for (const ref of consumedApprovalRefs) {
    const alreadyExists = nextApprovalStates.some(
      (state) => state.sourceType === ref.sourceType && state.itemId === ref.itemId
    );

    if (alreadyExists) {
      continue;
    }

    const approvalKey = `${ref.sourceType}:${ref.itemId}`;
    repairedOrphanedApprovalKeys.push(approvalKey);
    updatedApprovalKeys.push(approvalKey);
    nextApprovalStates.push({
      sourceType: ref.sourceType,
      itemId: ref.itemId,
      status: "consumed",
      updatedAt: completedAt
    });
  }

  if (
    JSON.stringify(normalizeContentDraftReport(rawContentDraftReport)) !==
    JSON.stringify(nextContentDraftReport)
  ) {
    await writeContentDraftReport(nextContentDraftReport);
  }

  const wroteApprovals = updatedApprovalKeys.length > 0;

  if (wroteApprovals) {
    await writeApprovalStates(nextApprovalStates);
  }

  const consumedApprovalKeyList = nextApprovalStates
    .filter((state) => state.status === "consumed")
    .map((state) => `${state.sourceType}:${state.itemId}`);
  const unmatchedApprovalKeys = consumedApprovalKeys.filter(
    (approvalKey) =>
      !rawApprovalStates.some((state) => `${state.sourceType}:${state.itemId}` === approvalKey)
  );

  if (process.env.KENNEL_HEALTH_DEBUG === "true") {
    console.log("[ConsumedLifecycle]", {
      consumedContentDraftIds: [...consumedContentDraftIds],
      consumedApprovalKeys: consumedApprovalKeyList,
      updatedApprovalKeys,
      updatedApprovalCount: updatedApprovalKeys.length,
      skippedApprovalKeys,
      unmatchedApprovalKeys,
      repairedOrphanedApprovalKeys,
      wroteContentDrafts:
        JSON.stringify(normalizeContentDraftReport(rawContentDraftReport)) !==
        JSON.stringify(nextContentDraftReport),
      wroteApprovals,
      approvalsWriteSuccess: wroteApprovals
    });
  }

  return {
    consumedContentDraftIds: [...consumedContentDraftIds],
    consumedApprovalKeys: consumedApprovalKeyList,
    updatedApprovalKeys
  };
}

function normalizeContentDraft(
  draft: ContentDraft,
  batchId: string,
  fallbackTime: string
): ContentDraft {
  return {
    ...draft,
    batchId: draft.batchId || batchId,
    status: draft.status || "draft",
    createdAt: draft.createdAt || fallbackTime,
    updatedAt: draft.updatedAt || fallbackTime
  };
}

function dedupeContentDraftBucket(
  drafts: ContentDraft[],
  bucketName: string
): ContentDraft[] {
  const draftMap = new Map<string, ContentDraft>();
  const duplicateDraftIds = new Set<string>();

  for (const draft of drafts) {
    const existing = draftMap.get(draft.id);

    if (!existing) {
      draftMap.set(draft.id, draft);
      continue;
    }

    duplicateDraftIds.add(draft.id);

    const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
    const nextTime = new Date(draft.updatedAt || draft.createdAt || 0).getTime();

    draftMap.set(draft.id, nextTime >= existingTime ? draft : existing);
  }

  if (process.env.KENNEL_HEALTH_DEBUG === "true" && duplicateDraftIds.size > 0) {
    console.log("[ContentDraftDedup]", {
      bucketName,
      duplicateDraftIds: [...duplicateDraftIds]
    });
  }

  return [...draftMap.values()];
}

function compareDraftFreshness(current: ContentDraft, next: ContentDraft): ContentDraft {
  const currentTime = new Date(current.updatedAt || current.createdAt || 0).getTime();
  const nextTime = new Date(next.updatedAt || next.createdAt || 0).getTime();

  if (nextTime !== currentTime) {
    return nextTime >= currentTime ? next : current;
  }

  const lifecycleRank: Record<ContentDraftStatus, number> = {
    draft: 1,
    approved: 2,
    placed: 3,
    published: 4,
    consumed: 5,
    archived: 6
  };

  return lifecycleRank[next.status] >= lifecycleRank[current.status] ? next : current;
}

function dedupeAcrossContentDraftBuckets(buckets: {
  drafts: ContentDraft[];
  publishedDrafts: ContentDraft[];
  consumedDrafts: ContentDraft[];
  archivedDrafts: ContentDraft[];
}): {
  drafts: ContentDraft[];
  publishedDrafts: ContentDraft[];
  consumedDrafts: ContentDraft[];
  archivedDrafts: ContentDraft[];
} {
  const canonicalDrafts = new Map<string, ContentDraft>();
  const removedDuplicateIds = new Set<string>();

  for (const draft of [
    ...buckets.drafts,
    ...buckets.publishedDrafts,
    ...buckets.consumedDrafts,
    ...buckets.archivedDrafts
  ]) {
    const existing = canonicalDrafts.get(draft.id);

    if (!existing) {
      canonicalDrafts.set(draft.id, draft);
      continue;
    }

    removedDuplicateIds.add(draft.id);
    canonicalDrafts.set(draft.id, compareDraftFreshness(existing, draft));
  }

  if (process.env.KENNEL_HEALTH_DEBUG === "true" && removedDuplicateIds.size > 0) {
    console.log("[ContentDraftCrossBucketDedup]", {
      removedDuplicateIds: [...removedDuplicateIds]
    });
  }

  const uniqueDrafts = [...canonicalDrafts.values()];

  return {
    drafts: uniqueDrafts.filter(
      (draft) => draft.status === "draft" || draft.status === "approved"
    ),
    publishedDrafts: uniqueDrafts.filter(
      (draft) => draft.status === "placed" || draft.status === "published"
    ),
    consumedDrafts: uniqueDrafts.filter((draft) => draft.status === "consumed"),
    archivedDrafts: uniqueDrafts.filter((draft) => draft.status === "archived")
  };
}

function normalizeContentDraftReport(report: ContentDraftReport): ContentDraftReport {
  const fallbackTime = report.generatedAt || new Date().toISOString();
  const activeBatchId = report.activeBatchId || `legacy-batch-${fallbackTime}`;

  const activeDrafts = dedupeContentDraftBucket(
    (report.drafts ?? []).map((draft) =>
      normalizeContentDraft(draft, draft.batchId || activeBatchId, fallbackTime)
    ),
    "drafts"
  );
  const publishedDrafts = dedupeContentDraftBucket(
    (report.publishedDrafts ?? []).map((draft) =>
      normalizeContentDraft(draft, draft.batchId || activeBatchId, fallbackTime)
    ),
    "publishedDrafts"
  );
  const consumedDrafts = dedupeContentDraftBucket(
    [
      ...(report.consumedDrafts ?? []),
      ...(report.publishedDrafts ?? []).map((draft) => ({
        ...draft,
        status: "consumed" as const
      }))
    ].map((draft) =>
      normalizeContentDraft(draft, draft.batchId || activeBatchId, fallbackTime)
    ),
    "consumedDrafts"
  );
  const archivedDrafts = dedupeContentDraftBucket(
    (report.archivedDrafts ?? []).map((draft) =>
      normalizeContentDraft(draft, draft.batchId || activeBatchId, fallbackTime)
    ),
    "archivedDrafts"
  );
  const uniqueBuckets = dedupeAcrossContentDraftBuckets({
    drafts: activeDrafts,
    publishedDrafts: publishedDrafts.filter((draft) => draft.status !== "consumed"),
    consumedDrafts,
    archivedDrafts
  });

  return {
    generatedAt: report.generatedAt || fallbackTime,
    activeBatchId,
    drafts: uniqueBuckets.drafts,
    publishedDrafts: uniqueBuckets.publishedDrafts,
    consumedDrafts: uniqueBuckets.consumedDrafts,
    archivedDrafts: uniqueBuckets.archivedDrafts
  };
}

function normalizePuppyListingDraft(
  draft: PuppyListingDraft,
  batchId: string,
  fallbackTime: string
): PuppyListingDraft {
  return {
    ...draft,
    batchId: draft.batchId || batchId,
    status: draft.status || "draft",
    createdAt: draft.createdAt || fallbackTime,
    updatedAt: draft.updatedAt || fallbackTime,
    images: draft.images ?? []
  };
}

function dedupePuppyListingBucket(
  drafts: PuppyListingDraft[],
  bucketName: string
): PuppyListingDraft[] {
  const draftMap = new Map<string, PuppyListingDraft>();
  const duplicateDraftIds = new Set<string>();

  for (const draft of drafts) {
    const existing = draftMap.get(draft.id);

    if (!existing) {
      draftMap.set(draft.id, draft);
      continue;
    }

    duplicateDraftIds.add(draft.id);

    const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
    const nextTime = new Date(draft.updatedAt || draft.createdAt || 0).getTime();

    draftMap.set(draft.id, nextTime >= existingTime ? draft : existing);
  }

  if (process.env.KENNEL_HEALTH_DEBUG === "true" && duplicateDraftIds.size > 0) {
    console.log("[PuppyListingDedup]", {
      bucketName,
      duplicateDraftIds: [...duplicateDraftIds]
    });
  }

  return [...draftMap.values()];
}

function normalizePuppyListingReport(report: PuppyListingReport): PuppyListingReport {
  const fallbackTime = report.generatedAt || new Date().toISOString();
  const activeBatchId = report.activeBatchId || `puppy-listing-batch-${fallbackTime}`;

  const drafts = dedupePuppyListingBucket(
    (report.drafts ?? []).map((draft) =>
      normalizePuppyListingDraft(draft, draft.batchId || activeBatchId, fallbackTime)
    ),
    "drafts"
  );
  const consumedDrafts = dedupePuppyListingBucket(
    (report.consumedDrafts ?? []).map((draft) =>
      normalizePuppyListingDraft(draft, draft.batchId || activeBatchId, fallbackTime)
    ),
    "consumedDrafts"
  );
  const archivedDrafts = dedupePuppyListingBucket(
    (report.archivedDrafts ?? []).map((draft) =>
      normalizePuppyListingDraft(draft, draft.batchId || activeBatchId, fallbackTime)
    ),
    "archivedDrafts"
  );

  const canonicalDrafts = new Map<string, PuppyListingDraft>();
  const removedDuplicateIds = new Set<string>();

  for (const draft of [...drafts, ...consumedDrafts, ...archivedDrafts]) {
    const existing = canonicalDrafts.get(draft.id);

    if (!existing) {
      canonicalDrafts.set(draft.id, draft);
      continue;
    }

    removedDuplicateIds.add(draft.id);
    const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
    const nextTime = new Date(draft.updatedAt || draft.createdAt || 0).getTime();
    canonicalDrafts.set(draft.id, nextTime >= existingTime ? draft : existing);
  }

  if (process.env.KENNEL_HEALTH_DEBUG === "true" && removedDuplicateIds.size > 0) {
    console.log("[PuppyListingCrossBucketDedup]", {
      removedDuplicateIds: [...removedDuplicateIds]
    });
  }

  const uniqueDrafts = [...canonicalDrafts.values()];

  return {
    generatedAt: report.generatedAt || fallbackTime,
    activeBatchId,
    drafts: uniqueDrafts.filter(
      (draft) =>
        draft.status === "draft" ||
        draft.status === "approved" ||
        draft.status === "ready_for_placement" ||
        draft.status === "applied" ||
        draft.status === "deployed" ||
        draft.status === "live_on_site" ||
        draft.status === "active_on_site" ||
        draft.status === "sold_or_reserved"
    ),
    consumedDrafts: [],
    archivedDrafts: uniqueDrafts.filter((draft) => draft.status === "archived")
  };
}

async function readRawPuppyListingReport(): Promise<PuppyListingReport> {
  try {
    const parsedReport = await readPuppyListingReportFromDatabase();
    const normalizedReport = normalizePuppyListingReport(parsedReport);

    return normalizedReport;
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      throw error;
    }

    return emptyPuppyListingReport();
  }
}

async function syncPuppyListingReport(report: PuppyListingReport): Promise<PuppyListingReport> {
  const approvals = await readRawApprovalStates();
  const allDrafts = [...report.drafts, ...report.consumedDrafts, ...report.archivedDrafts];
  const nextApprovalStates = [...approvals];
  let approvalsChanged = false;

  const syncedDrafts = allDrafts.map((draft) => {
    let status = draft.status;
    let updatedAt = draft.updatedAt;
    const approvalState = approvals.find(
      (state) => state.itemId === draft.id && state.sourceType === "puppy_listing"
    );
    if (
      approvalState?.status === "approved" &&
      (status === "draft" || status === "approved") &&
      approvalState.updatedAt >= updatedAt
    ) {
      status = "approved";
      updatedAt = approvalState.updatedAt;

      if (process.env.KENNEL_HEALTH_DEBUG === "true") {
        console.log("[PuppyListingLifecycle]", {
          itemId: draft.id,
          transition: "approved",
          updatedAt
        });
      }
    }

    if (
      approvalState?.status === "published" &&
      (status === "approved" ||
        status === "ready_for_placement" ||
        status === "applied" ||
        status === "deployed")
    ) {
      status = "live_on_site";
      updatedAt = approvalState.updatedAt;
    } else if (approvalState?.status === "rejected") {
      status = "archived";
      updatedAt = approvalState.updatedAt;
    }

    const approvalIndex = nextApprovalStates.findIndex(
      (state) => state.itemId === draft.id && state.sourceType === "puppy_listing"
    );
    const nextApprovalStatus =
      status === "archived"
        ? "rejected"
        : status === "live_on_site" ||
            status === "active_on_site" ||
            status === "sold_or_reserved"
          ? "published"
        : status === "approved" || status === "ready_for_placement" || status === "applied"
            ? "approved"
            : approvalState?.status;

    if (
      nextApprovalStatus &&
      nextApprovalStatus !== "consumed" &&
      approvalIndex !== -1 &&
      nextApprovalStates[approvalIndex].status !== nextApprovalStatus
    ) {
      approvalsChanged = true;
      nextApprovalStates[approvalIndex] = {
        ...nextApprovalStates[approvalIndex],
        status: nextApprovalStatus,
        updatedAt
      };
    }

    return {
      ...draft,
      status,
      updatedAt
    };
  });

  if (approvalsChanged) {
    await writeApprovalStates(nextApprovalStates);
  }

  return normalizePuppyListingReport({
    ...report,
    drafts: syncedDrafts.filter(
      (draft) =>
        draft.status === "draft" ||
        draft.status === "approved" ||
        draft.status === "ready_for_placement" ||
        draft.status === "applied" ||
        draft.status === "deployed" ||
        draft.status === "live_on_site" ||
        draft.status === "active_on_site" ||
        draft.status === "sold_or_reserved"
    ),
    consumedDrafts: [],
    archivedDrafts: syncedDrafts.filter((draft) => draft.status === "archived")
  });
}

async function syncContentDraftReport(
  report: ContentDraftReport
): Promise<ContentDraftReport> {
  // Content lifecycle is derived from existing approvals, placement, and deploy records
  // so successfully used drafts end in a terminal consumed state and fall out of the active queue.
  const [approvals, mergeResults, faqPlacementReport, deployState] = await Promise.all([
    readApprovalStates(),
    readMergeResults(),
    readFaqPlacementReport(),
    readDeployActionState()
  ]);

  const allDrafts = [
    ...report.drafts,
    ...report.publishedDrafts,
    ...report.consumedDrafts,
    ...report.archivedDrafts
  ];

  const publishCompletedAt =
    deployState.publishStatus.status === "success"
      ? deployState.publishStatus.updatedAt
      : "";

  const syncedDrafts = allDrafts.map((draft) => {
    let status = draft.status;
    let updatedAt = draft.updatedAt;

    const approvalState = approvals.find(
      (state) =>
        state.itemId === draft.id &&
        state.sourceType === "content_draft" &&
        state.status === "approved"
    );

    if (
      approvalState &&
      (status === "draft" || status === "approved") &&
      approvalState.updatedAt > updatedAt
    ) {
      status = "approved";
      updatedAt = approvalState.updatedAt;
    }

    const mergeResult = mergeResults.find(
      (result) =>
        result.itemId === draft.id &&
        result.sourceType === "content_draft" &&
        result.status === "applied"
    );
    const faqPlacementApplied =
      draft.contentType === "faq_items" &&
      faqPlacementReport.items.some((item) => item.itemId === draft.id && item.status === "applied");

    if (
      status !== "archived" &&
      (mergeResult?.updatedAt || faqPlacementApplied)
    ) {
      const placementTime = mergeResult?.updatedAt || faqPlacementReport.generatedAt || updatedAt;

      if (placementTime >= updatedAt) {
        status = "consumed";
        updatedAt = placementTime;
      }
    }

    if (
      (status === "placed" || status === "published") &&
      publishCompletedAt &&
      publishCompletedAt >= updatedAt
    ) {
      status = "consumed";
      updatedAt = publishCompletedAt;
    }

    return {
      ...draft,
      status,
      updatedAt
    };
  });

  return {
    ...report,
    drafts: syncedDrafts.filter(
      (draft) => draft.status === "draft" || draft.status === "approved"
    ),
    publishedDrafts: syncedDrafts.filter((draft) => draft.status === "placed"),
    consumedDrafts: syncedDrafts.filter(
      (draft) => draft.status === "published" || draft.status === "consumed"
    ),
    archivedDrafts: syncedDrafts.filter((draft) => draft.status === "archived")
  };
}

function normalizeStore(data: unknown): HealthReportStore {
  // This fallback keeps older single-report JSON files compatible.
  if (
    data &&
    typeof data === "object" &&
    "latest" in data &&
    "history" in data
  ) {
    return data as HealthReportStore;
  }

  if (data && typeof data === "object" && "findings" in data) {
    const report = data as HealthReport;
    return {
      latest: report,
      history: report.checkedAt ? [report] : []
    };
  }

  return emptyStore();
}

export async function readHealthReportStore(): Promise<HealthReportStore> {
  try {
    const fileContents = await readFile(findingsFilePath, "utf8");
    return normalizeStore(JSON.parse(fileContents));
  } catch {
    return emptyStore();
  }
}

export async function appendHealthReport(report: HealthReport): Promise<HealthReportStore> {
  const currentStore = await readHealthReportStore();
  const history = [report, ...currentStore.history].slice(0, MAX_SCAN_HISTORY);
  const nextStore: HealthReportStore = {
    latest: report,
    history
  };

  // A local JSON file keeps Phase 1 easy to inspect before we introduce a database.
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(findingsFilePath, JSON.stringify(nextStore, null, 2), "utf8");
  return nextStore;
}

export async function readProposedFixReport(): Promise<ProposedFixReport> {
  try {
    const fileContents = await readFile(proposedFixesFilePath, "utf8");
    return JSON.parse(fileContents) as ProposedFixReport;
  } catch {
    return emptyProposedFixReport();
  }
}

export async function writeProposedFixReport(
  report: ProposedFixReport
): Promise<ProposedFixReport> {
  // Proposed fixes are persisted separately so Phase 2 stays independent from the scan history file.
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(proposedFixesFilePath, JSON.stringify(report, null, 2), "utf8");
  return report;
}

export async function readContentDraftReport(): Promise<ContentDraftReport> {
  const rawReport = await readRawContentDraftReport();
  const syncedReport = await syncContentDraftReport(rawReport);

  // Persist the normalized lifecycle view so legacy draft files migrate into
  // explicit active and consumed buckets after successful merge or publish steps.
  if (JSON.stringify(rawReport) !== JSON.stringify(syncedReport)) {
    await writeContentDraftReport(syncedReport);
  }

  return syncedReport;
}

export async function writeContentDraftReport(
  report: ContentDraftReport
): Promise<ContentDraftReport> {
  // Content drafts stay file-backed so the phase remains simple and easy to inspect.
  const normalizedReport = normalizeContentDraftReport(report);
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(contentDraftsFilePath, JSON.stringify(normalizedReport, null, 2), "utf8");
  return normalizedReport;
}

export async function readPuppyListingReport(): Promise<PuppyListingReport> {
  const rawReport = await readRawPuppyListingReport();
  const syncedReport = await syncPuppyListingReport(rawReport);

  if (JSON.stringify(rawReport) !== JSON.stringify(syncedReport)) {
    await writePuppyListingReport(syncedReport);
  }

  return syncedReport;
}

export async function writePuppyListingReport(
  report: PuppyListingReport
): Promise<PuppyListingReport> {
  const normalizedReport = normalizePuppyListingReport(report);
  return writePuppyListingReportToDatabase(normalizedReport);
}

export async function readConversionInsightReport(): Promise<ConversionInsightReport> {
  try {
    const fileContents = await readFile(conversionInsightsFilePath, "utf8");
    return JSON.parse(fileContents) as ConversionInsightReport;
  } catch {
    return emptyConversionInsightReport();
  }
}

export async function writeConversionInsightReport(
  report: ConversionInsightReport
): Promise<ConversionInsightReport> {
  // Conversion insights stay local and review-only in Phase 4.
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(conversionInsightsFilePath, JSON.stringify(report, null, 2), "utf8");
  return report;
}

export async function readApprovalStates(): Promise<ApprovalState[]> {
  const rawStates = await readRawApprovalStates();

  const deployState = await readDeployActionState();
  await applyConsumedSourceTransition(
    deployState.publishStatus.updatedAt || new Date().toISOString()
  );

  return readRawApprovalStates();
}

export async function writeApprovalStates(
  states: ApprovalState[]
): Promise<ApprovalState[]> {
  // Approval state is kept separate so review decisions do not mutate source draft files.
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(approvalsFilePath, JSON.stringify(states, null, 2), "utf8");
  return states;
}

export async function markPublishedApprovalStates(): Promise<ApprovalState[]> {
  const deployState = await readDeployActionState();
  const publishedAt = deployState.publishStatus.updatedAt || new Date().toISOString();

  await applyConsumedSourceTransition(publishedAt);
  return readRawApprovalStates();
}

export async function readApplyResults(): Promise<ApplyResult[]> {
  try {
    const fileContents = await readFile(applyResultsFilePath, "utf8");
    return JSON.parse(fileContents) as ApplyResult[];
  } catch {
    return emptyApplyResults();
  }
}

export async function writeApplyResults(
  results: ApplyResult[]
): Promise<ApplyResult[]> {
  // Apply results are tracked separately so staging actions remain auditable and reversible by hand.
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(applyResultsFilePath, JSON.stringify(results, null, 2), "utf8");
  return results;
}

export async function readMergeResults(): Promise<MergeResult[]> {
  try {
    const fileContents = await readFile(mergeResultsFilePath, "utf8");
    return JSON.parse(fileContents) as MergeResult[];
  } catch {
    return emptyMergeResults();
  }
}

export async function writeMergeResults(
  results: MergeResult[]
): Promise<MergeResult[]> {
  // Merge results are stored separately so preview/apply decisions remain auditable.
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(mergeResultsFilePath, JSON.stringify(results, null, 2), "utf8");
  return results;
}

export async function readVerificationReport(): Promise<VerificationReport> {
  try {
    const fileContents = await readFile(verificationFilePath, "utf8");
    return JSON.parse(fileContents) as VerificationReport;
  } catch {
    return emptyVerificationReport();
  }
}

export async function writeVerificationReport(
  report: VerificationReport
): Promise<VerificationReport> {
  // Verification records are stored separately so repeated checks preserve their own lifecycle history.
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(verificationFilePath, JSON.stringify(report, null, 2), "utf8");
  return report;
}

export async function readOptimizationInsightReport(): Promise<OptimizationInsightReport> {
  const [report, rewriteReport, optimizationMergeReport] = await Promise.all([
    readRawOptimizationInsightReport(),
    readRawSectionRewriteReport(),
    readOptimizationMergeReport()
  ]);

  const { publishedInsightTitles } = buildPublishedRewriteSet(
    rewriteReport,
    optimizationMergeReport
  );

  return {
    ...report,
    insights: report.insights.filter(
      (insight) => !publishedInsightTitles.has(insight.issueTitle)
    )
  };
}

export async function writeOptimizationInsightReport(
  report: OptimizationInsightReport
): Promise<OptimizationInsightReport> {
  // Optimization insights stay as local analysis output and do not modify site files.
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(optimizationInsightsFilePath, JSON.stringify(report, null, 2), "utf8");
  return report;
}

export async function readSectionRewriteReport(): Promise<SectionRewriteReport> {
  const [report, optimizationMergeReport] = await Promise.all([
    readRawSectionRewriteReport(),
    readOptimizationMergeReport()
  ]);

  const { publishedRewriteIds } = buildPublishedRewriteSet(
    report,
    optimizationMergeReport
  );

  return {
    ...report,
    drafts: report.drafts.filter((draft) => !publishedRewriteIds.has(draft.id))
  };
}

export async function writeSectionRewriteReport(
  report: SectionRewriteReport
): Promise<SectionRewriteReport> {
  // Section rewrites are draft content only and remain separate from site modification flows.
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(sectionRewritesFilePath, JSON.stringify(report, null, 2), "utf8");
  return report;
}

export async function readOptimizationMergeReport(): Promise<OptimizationMergeReport> {
  try {
    const fileContents = await readFile(optimizationMergeResultsFilePath, "utf8");
    return JSON.parse(fileContents) as OptimizationMergeReport;
  } catch {
    return emptyOptimizationMergeReport();
  }
}

export async function writeOptimizationMergeReport(
  report: OptimizationMergeReport
): Promise<OptimizationMergeReport> {
  // Optimization merge previews and outcomes stay local so file changes remain reviewable.
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(
    optimizationMergeResultsFilePath,
    JSON.stringify(report, null, 2),
    "utf8"
  );
  return report;
}

export async function readDeployActionState(): Promise<{
  commitStatus: DeployActionState;
  pushStatus: DeployActionState;
  publishStatus: DeployActionState;
}> {
  const rawState = await readRawDeployActionState();

  // Legacy deploys may have a successful push recorded but no publishStatus yet.
  // Treat that as the publish source of truth so older runs migrate forward.
  if (
    rawState.publishStatus.status === "idle" &&
    rawState.pushStatus.status === "success" &&
    rawState.pushStatus.updatedAt
  ) {
    const migratedState = {
      ...rawState,
      publishStatus: {
        status: "success" as const,
        message:
          rawState.pushStatus.message ||
          "Legacy publish inferred from a successful push to origin/main.",
        updatedAt: rawState.pushStatus.updatedAt
      }
    };

    await writeDeployActionState(migratedState);
    await applyConsumedSourceTransition(migratedState.publishStatus.updatedAt);
    return migratedState;
  }

  return rawState;
}

export async function writeDeployActionState(state: {
  commitStatus: DeployActionState;
  pushStatus: DeployActionState;
  publishStatus: DeployActionState;
}): Promise<{
  commitStatus: DeployActionState;
  pushStatus: DeployActionState;
  publishStatus: DeployActionState;
}> {
  // Deploy action state is stored locally so commit/push results survive page refreshes.
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(deployStateFilePath, JSON.stringify(state, null, 2), "utf8");
  return state;
}

export async function readFaqPlacementReport(): Promise<FaqPlacementReport> {
  try {
    const fileContents = await readFile(faqPlacementResultsFilePath, "utf8");
    return JSON.parse(fileContents) as FaqPlacementReport;
  } catch {
    return emptyFaqPlacementReport();
  }
}

export async function writeFaqPlacementReport(
  report: FaqPlacementReport
): Promise<FaqPlacementReport> {
  // FAQ placement previews and results stay local so homepage content changes remain reviewable.
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(faqPlacementResultsFilePath, JSON.stringify(report, null, 2), "utf8");
  return report;
}

export async function readPuppyPlacementReport(): Promise<PuppyPlacementReport> {
  try {
    const fileContents = await readFile(puppyPlacementResultsFilePath, "utf8");
    return JSON.parse(fileContents) as PuppyPlacementReport;
  } catch {
    return emptyPuppyPlacementReport();
  }
}

export async function writePuppyPlacementReport(
  report: PuppyPlacementReport
): Promise<PuppyPlacementReport> {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(puppyPlacementResultsFilePath, JSON.stringify(report, null, 2), "utf8");
  return report;
}
