import { access, mkdir, writeFile } from "fs/promises";
import path from "path";

import { TARGET_SITE_PATH } from "@/lib/config";
import {
  readApprovalStates,
  readApplyResults,
  readContentDraftReport,
  readProposedFixReport,
  writeApplyResults
} from "@/lib/storage";
import type {
  ApplyQueueItem,
  ApplyQueueReport,
  ApplyResult,
  ApplyStatus,
  ApprovalState,
  ContentDraft,
  ProposedFix
} from "@/types/health";

function isApproved(
  states: ApprovalState[],
  itemId: string,
  sourceType: "proposed_fix" | "content_draft"
): boolean {
  return states.some(
    (state) =>
      state.itemId === itemId &&
      state.sourceType === sourceType &&
      state.status === "approved"
  );
}

function getExistingResult(
  results: ApplyResult[],
  itemId: string,
  sourceType: "proposed_fix" | "content_draft"
): ApplyResult | undefined {
  return results.find(
    (result) => result.itemId === itemId && result.sourceType === sourceType
  );
}

function buildProposedFixTargetFile(fix: ProposedFix): string {
  return path.join(
    TARGET_SITE_PATH,
    "src",
    "agent-applied",
    "proposed-fixes",
    `${fix.id}.md`
  );
}

function buildContentDraftTargetFile(draft: ContentDraft): string {
  return path.join(
    TARGET_SITE_PATH,
    "src",
    "agent-applied",
    "content-drafts",
    `${draft.id}.md`
  );
}

function buildProposedFixPreview(fix: ProposedFix): string {
  return [
    `# ${fix.issueTitle}`,
    "",
    `- Severity: ${fix.severity}`,
    `- Page URL: ${fix.pageUrl}`,
    `- Category: ${fix.category}`,
    "",
    "## Recommended Fix",
    fix.recommendedFix,
    "",
    "## Before Preview",
    fix.beforePreview,
    "",
    "## After Preview",
    fix.afterPreview,
    "",
    "## Implementation Notes",
    fix.implementationNotes,
    ""
  ].join("\n");
}

function buildContentDraftPreview(draft: ContentDraft): string {
  return [
    `# ${draft.title}`,
    "",
    `- Content Type: ${draft.contentType}`,
    `- Purpose: ${draft.purpose}`,
    `- Target Audience: ${draft.targetAudience}`,
    draft.ctaSuggestion ? `- CTA Suggestion: ${draft.ctaSuggestion}` : null,
    "",
    "## Draft Text",
    draft.draftText,
    "",
    "## Notes",
    draft.notes,
    ""
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

async function ensureTargetSiteAccessible(): Promise<void> {
  await access(TARGET_SITE_PATH);
}

export async function buildApplyQueue(): Promise<ApplyQueueReport> {
  const [states, results, proposedFixReport, contentDraftReport] = await Promise.all([
    readApprovalStates(),
    readApplyResults(),
    readProposedFixReport(),
    readContentDraftReport()
  ]);

  const items: ApplyQueueItem[] = [
    ...proposedFixReport.fixes
      .filter((fix) => isApproved(states, fix.id, "proposed_fix"))
      .map((fix) => {
        const existing = getExistingResult(results, fix.id, "proposed_fix");

        return {
          itemId: fix.id,
          sourceType: "proposed_fix" as const,
          title: fix.issueTitle,
          pageUrl: fix.pageUrl,
          suggestedTargetFile: buildProposedFixTargetFile(fix),
          changeSummary: `Stage an approved proposed fix as a local review document for ${fix.category}.`,
          patchPreview: buildProposedFixPreview(fix),
          status: existing?.status ?? "ready",
          message: existing?.message
        };
      }),
    ...contentDraftReport.drafts
      .filter((draft) => isApproved(states, draft.id, "content_draft"))
      .map((draft) => {
        const existing = getExistingResult(results, draft.id, "content_draft");

        return {
          itemId: draft.id,
          sourceType: "content_draft" as const,
          title: draft.title,
          suggestedTargetFile: buildContentDraftTargetFile(draft),
          changeSummary: `Stage an approved content draft for ${draft.contentType} inside the local site repo.`,
          patchPreview: buildContentDraftPreview(draft),
          status: existing?.status ?? "ready",
          message: existing?.message
        };
      })
  ];

  return {
    generatedAt: new Date().toISOString(),
    items
  };
}

export async function applyApprovedItem(
  itemId: string,
  sourceType: "proposed_fix" | "content_draft"
): Promise<ApplyQueueReport> {
  await ensureTargetSiteAccessible();

  const queue = await buildApplyQueue();
  const targetItem = queue.items.find(
    (item) => item.itemId === itemId && item.sourceType === sourceType
  );

  if (!targetItem) {
    throw new Error("Approved item not found in the apply queue.");
  }

  try {
    const targetDirectory = path.dirname(targetItem.suggestedTargetFile);

    // Phase 6 stages approved changes into clearly marked local files inside the site repo.
    await mkdir(targetDirectory, { recursive: true });
    await writeFile(targetItem.suggestedTargetFile, targetItem.patchPreview, "utf8");

    const currentResults = await readApplyResults();
    const nextResults = currentResults.filter(
      (result) =>
        !(result.itemId === itemId && result.sourceType === sourceType)
    );

    nextResults.push({
      itemId,
      sourceType,
      targetFile: targetItem.suggestedTargetFile,
      changeSummary: targetItem.changeSummary,
      patchPreview: targetItem.patchPreview,
      status: "applied",
      updatedAt: new Date().toISOString(),
      message: "Approved item was written to the local site codebase."
    });

    await writeApplyResults(nextResults);
  } catch (error) {
    const currentResults = await readApplyResults();
    const nextResults = currentResults.filter(
      (result) =>
        !(result.itemId === itemId && result.sourceType === sourceType)
    );

    nextResults.push({
      itemId,
      sourceType,
      targetFile: targetItem.suggestedTargetFile,
      changeSummary: targetItem.changeSummary,
      patchPreview: targetItem.patchPreview,
      status: "failed",
      updatedAt: new Date().toISOString(),
      message: error instanceof Error ? error.message : "Unknown apply error."
    });

    await writeApplyResults(nextResults);
  }

  return buildApplyQueue();
}
