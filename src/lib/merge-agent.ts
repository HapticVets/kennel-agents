import { access, readFile, writeFile } from "fs/promises";
import path from "path";

import { TARGET_SITE_PATH } from "@/lib/config";
import {
  readApprovalStates,
  readContentDraftReport,
  readMergeResults,
  readProposedFixReport,
  writeMergeResults
} from "@/lib/storage";
import type {
  ApprovalState,
  ContentDraft,
  MergeQueueItem,
  MergeQueueReport,
  MergeResult,
  MergeStatus,
  ProposedFix
} from "@/types/health";

const homepageFilePath = path.join(TARGET_SITE_PATH, "src", "app", "page.tsx");
const layoutFilePath = path.join(TARGET_SITE_PATH, "src", "app", "layout.tsx");

function sanitizePathSegment(value: string): string {
  return value
    .replace(/^https?:\/\//, "")
    .replace(/[/:.]/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/_+/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "")
    .toLowerCase();
}

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

function getMergeResult(
  results: MergeResult[],
  itemId: string,
  sourceType: "proposed_fix" | "content_draft"
): MergeResult | undefined {
  return results.find(
    (result) => result.itemId === itemId && result.sourceType === sourceType
  );
}

function buildStagedProposedFixPath(fix: ProposedFix): string {
  return path.join(
    TARGET_SITE_PATH,
    "src",
    "agent-applied",
    "proposed-fixes",
    `${sanitizePathSegment(fix.id)}.md`
  );
}

function buildStagedContentDraftPath(draft: ContentDraft): string {
  return path.join(
    TARGET_SITE_PATH,
    "src",
    "agent-applied",
    "content-drafts",
    `${sanitizePathSegment(draft.id)}.md`
  );
}

async function resolveStagedContentDraftPath(draft: ContentDraft): Promise<string> {
  const preferredPath = buildStagedContentDraftPath(draft);

  try {
    await access(preferredPath);
    return preferredPath;
  } catch {
    const legacyPath = preferredPath.replace(/\.md$/, "");
    await access(legacyPath);
    return legacyPath;
  }
}

async function readStagedFile(filePath: string): Promise<string> {
  return readFile(filePath, "utf8");
}

function extractDraftText(stagedContent: string): string {
  const match = stagedContent.match(/## Draft Text\s+([\s\S]*?)\n## Notes/);
  return match?.[1]?.trim() ?? "";
}

function extractCtaSuggestion(stagedContent: string): string {
  const match = stagedContent.match(/- CTA Suggestion:\s*(.+)/);
  return match?.[1]?.trim() ?? "";
}

function buildDiffPreview(existingSnippet: string, proposedSnippet: string): string {
  return [
    "--- Existing",
    existingSnippet.trim(),
    "",
    "+++ Proposed",
    proposedSnippet.trim()
  ].join("\n");
}

function ensureMetadataComment(fileContent: string): string {
  if (fileContent.includes("// Merge Agent: approved SEO metadata updates.")) {
    return fileContent;
  }

  return fileContent.replace(
    'import "./globals.css";',
    'import "./globals.css";\n\n// Merge Agent: approved SEO metadata updates.'
  );
}

function mergeSeoFixIntoLayout(layoutContent: string, fix: ProposedFix): {
  mergedContent: string;
  existingSnippet: string;
  proposedSnippet: string;
  summary: string;
} {
  let mergedContent = ensureMetadataComment(layoutContent);
  const currentBlockMatch = layoutContent.match(/export const metadata: Metadata = \{[\s\S]*?\n\};/);
  const existingSnippet = currentBlockMatch?.[0] ?? layoutContent;

  if (fix.issueTitle.toLowerCase().includes("title")) {
    mergedContent = mergedContent
      .replace(/title: ".*?"/, 'title: "Das Muller German Shepherds | Structured Training and Puppy Placement"')
      .replace(/openGraph: \{([\s\S]*?)title: ".*?"/, 'openGraph: {$1title: "Das Muller German Shepherds | Structured Training and Puppy Placement"')
      .replace(/twitter: \{([\s\S]*?)title: ".*?"/, 'twitter: {$1title: "Das Muller German Shepherds | Structured Training and Puppy Placement"');

    return {
      mergedContent,
      existingSnippet,
      proposedSnippet:
        'title: "Das Muller German Shepherds | Structured Training and Puppy Placement"\nopenGraph.title: "Das Muller German Shepherds | Structured Training and Puppy Placement"\ntwitter.title: "Das Muller German Shepherds | Structured Training and Puppy Placement"',
      summary: "Update the Next.js metadata title fields with a clearer homepage title."
    };
  }

  mergedContent = mergedContent
    .replace(
      /description:\s*"[\s\S]*?",/,
      'description:\n    "Purpose-bred German Shepherds, structured puppy placement, and training support for serious homes.",'
    )
    .replace(
      /openGraph: \{([\s\S]*?)description:\s*"[\s\S]*?",/,
      'openGraph: {$1description:\n      "Purpose-bred German Shepherds, structured puppy placement, and training support for serious homes.",'
    )
    .replace(
      /twitter: \{([\s\S]*?)description:\s*"[\s\S]*?",/,
      'twitter: {$1description:\n      "Purpose-bred German Shepherds, structured puppy placement, and training support for serious homes.",'
    );

  return {
    mergedContent,
    existingSnippet,
    proposedSnippet:
      'description: "Purpose-bred German Shepherds, structured puppy placement, and training support for serious homes."\nopenGraph.description: same updated copy\ntwitter.description: same updated copy',
    summary: "Update the Next.js metadata description fields with clearer search-facing copy."
  };
}

function buildHomepageDraftBlock(
  draft: ContentDraft,
  draftText: string,
  ctaSuggestion: string
): string {
  const ctaBlock = ctaSuggestion
    ? `\n            <a\n              href="#application"\n              className="mt-6 inline-flex rounded-2xl border border-amber-500 px-6 py-3 font-semibold text-amber-400 hover:bg-neutral-900"\n            >\n              ${ctaSuggestion}\n            </a>`
    : "";

  return [
    `        {/* Merge Agent: approved homepage content start - ${draft.id} */}`,
    '        <section className="border-t border-neutral-900 bg-neutral-900/30">',
    '          <div className="mx-auto max-w-7xl px-6 py-12 md:px-10 lg:px-12">',
    '            <div className="max-w-3xl rounded-3xl border border-neutral-800 bg-neutral-950 p-8">',
    `              <p className="text-sm uppercase tracking-[0.25em] text-amber-400">${draft.title}</p>`,
    `              <p className="mt-4 text-lg leading-8 text-neutral-300">${draftText}</p>${ctaBlock}`,
    "            </div>",
    "          </div>",
    "        </section>",
    `        {/* Merge Agent: approved homepage content end - ${draft.id} */}`
  ].join("\n");
}

function mergeContentDraftIntoHomepage(
  pageContent: string,
  draft: ContentDraft,
  stagedContent: string
): {
  mergedContent: string;
  existingSnippet: string;
  proposedSnippet: string;
  summary: string;
} {
  const draftText = extractDraftText(stagedContent);
  const ctaSuggestion = extractCtaSuggestion(stagedContent);

  if (!draftText) {
    throw new Error("Staged content draft file is empty or missing draft text.");
  }

  const insertBlock = buildHomepageDraftBlock(draft, draftText, ctaSuggestion);
  const existingMarkedPattern = new RegExp(
    String.raw`\s*\{\/\* Merge Agent: approved homepage content start - ${draft.id.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")} \*\/\}[\s\S]*?\{\/\* Merge Agent: approved homepage content end - ${draft.id.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")} \*\/\}`,
    "m"
  );

  const existingSnippet = pageContent.includes("<AvailableLitters />")
    ? "<AvailableLitters />"
    : pageContent;

  let mergedContent: string;
  if (existingMarkedPattern.test(pageContent)) {
    mergedContent = pageContent.replace(existingMarkedPattern, `\n${insertBlock}\n`);
  } else if (pageContent.includes("<AvailableLitters />")) {
    mergedContent = pageContent.replace("<AvailableLitters />", `${insertBlock}\n\n        <AvailableLitters />`);
  } else {
    throw new Error("Could not find a safe homepage insertion point before <AvailableLitters />.");
  }

  return {
    mergedContent,
    existingSnippet,
    proposedSnippet: insertBlock,
    summary: "Inject approved homepage draft content in a clearly marked section before the litters block."
  };
}

async function ensureTargetSiteAccessible(): Promise<void> {
  await access(homepageFilePath);
  await access(layoutFilePath);
}

export async function buildMergeQueue(): Promise<MergeQueueReport> {
  await ensureTargetSiteAccessible();

  const [states, results, fixReport, draftReport] = await Promise.all([
    readApprovalStates(),
    readMergeResults(),
    readProposedFixReport(),
    readContentDraftReport()
  ]);

  const items: MergeQueueItem[] = [];

  for (const fix of fixReport.fixes.filter((item) => isApproved(states, item.id, "proposed_fix"))) {
    const stagedFile = buildStagedProposedFixPath(fix);
    const existing = getMergeResult(results, fix.id, "proposed_fix");

    try {
      const stagedContent = await readStagedFile(stagedFile);
      const layoutContent = await readFile(layoutFilePath, "utf8");
      const mergeResult = mergeSeoFixIntoLayout(layoutContent, fix);

      items.push({
        itemId: fix.id,
        sourceType: "proposed_fix",
        title: fix.issueTitle,
        stagedFile,
        targetFile: layoutFilePath,
        changeSummary: mergeResult.summary,
        diffPreview: buildDiffPreview(mergeResult.existingSnippet, mergeResult.proposedSnippet),
        status: existing?.status ?? "ready",
        message: existing?.message ?? (stagedContent.trim() ? undefined : "Staged fix file is empty.")
      });
    } catch (error) {
      items.push({
        itemId: fix.id,
        sourceType: "proposed_fix",
        title: fix.issueTitle,
        stagedFile,
        targetFile: layoutFilePath,
        changeSummary: "Unable to prepare a safe metadata merge preview.",
        diffPreview: "",
        status: existing?.status ?? "failed",
        message: error instanceof Error ? error.message : "Unknown merge preview error."
      });
    }
  }

  for (const draft of draftReport.drafts.filter((item) => isApproved(states, item.id, "content_draft"))) {
    const existing = getMergeResult(results, draft.id, "content_draft");

    try {
      const stagedFile = await resolveStagedContentDraftPath(draft);
      const stagedContent = await readStagedFile(stagedFile);
      const pageContent = await readFile(homepageFilePath, "utf8");
      const mergeResult = mergeContentDraftIntoHomepage(pageContent, draft, stagedContent);

      items.push({
        itemId: draft.id,
        sourceType: "content_draft",
        title: draft.title,
        stagedFile,
        targetFile: homepageFilePath,
        changeSummary: mergeResult.summary,
        diffPreview: buildDiffPreview(mergeResult.existingSnippet, mergeResult.proposedSnippet),
        status: existing?.status ?? "ready",
        message: existing?.message
      });
    } catch (error) {
      items.push({
        itemId: draft.id,
        sourceType: "content_draft",
        title: draft.title,
        stagedFile: buildStagedContentDraftPath(draft),
        targetFile: homepageFilePath,
        changeSummary: "Unable to prepare a safe homepage merge preview.",
        diffPreview: "",
        status: existing?.status ?? "failed",
        message: error instanceof Error ? error.message : "Unknown merge preview error."
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    items
  };
}

export async function applyMerge(
  itemId: string,
  sourceType: "proposed_fix" | "content_draft"
): Promise<MergeQueueReport> {
  const queue = await buildMergeQueue();
  const item = queue.items.find(
    (queueItem) => queueItem.itemId === itemId && queueItem.sourceType === sourceType
  );

  if (!item) {
    throw new Error("Merge item not found.");
  }

  if (!item.diffPreview) {
    throw new Error(item.message ?? "This merge item does not have a safe preview.");
  }

  try {
    if (sourceType === "proposed_fix") {
      const fixReport = await readProposedFixReport();
      const fix = fixReport.fixes.find((entry) => entry.id === itemId);

      if (!fix) {
        throw new Error("Approved proposed fix could not be found.");
      }

      const layoutContent = await readFile(layoutFilePath, "utf8");
      const mergeResult = mergeSeoFixIntoLayout(layoutContent, fix);
      await writeFile(layoutFilePath, mergeResult.mergedContent, "utf8");
    } else {
      const draftReport = await readContentDraftReport();
      const draft = draftReport.drafts.find((entry) => entry.id === itemId);

      if (!draft) {
        throw new Error("Approved content draft could not be found.");
      }

      const stagedFile = await resolveStagedContentDraftPath(draft);
      const stagedContent = await readStagedFile(stagedFile);
      const pageContent = await readFile(homepageFilePath, "utf8");
      const mergeResult = mergeContentDraftIntoHomepage(pageContent, draft, stagedContent);
      await writeFile(homepageFilePath, mergeResult.mergedContent, "utf8");
    }

    const currentResults = await readMergeResults();
    const nextResults = currentResults.filter(
      (result) => !(result.itemId === itemId && result.sourceType === sourceType)
    );

    nextResults.push({
      itemId,
      sourceType,
      targetFile: item.targetFile,
      status: "applied",
      diffPreview: item.diffPreview,
      updatedAt: new Date().toISOString(),
      message: "Merge was written into the real site file."
    });

    await writeMergeResults(nextResults);
  } catch (error) {
    const currentResults = await readMergeResults();
    const nextResults = currentResults.filter(
      (result) => !(result.itemId === itemId && result.sourceType === sourceType)
    );

    nextResults.push({
      itemId,
      sourceType,
      targetFile: item.targetFile,
      status: "failed",
      diffPreview: item.diffPreview,
      updatedAt: new Date().toISOString(),
      message: error instanceof Error ? error.message : "Unknown merge error."
    });

    await writeMergeResults(nextResults);
  }

  return buildMergeQueue();
}

export async function skipMerge(
  itemId: string,
  sourceType: "proposed_fix" | "content_draft"
): Promise<MergeQueueReport> {
  const queue = await buildMergeQueue();
  const item = queue.items.find(
    (queueItem) => queueItem.itemId === itemId && queueItem.sourceType === sourceType
  );

  if (!item) {
    throw new Error("Merge item not found.");
  }

  const currentResults = await readMergeResults();
  const nextResults = currentResults.filter(
    (result) => !(result.itemId === itemId && result.sourceType === sourceType)
  );

  nextResults.push({
    itemId,
    sourceType,
    targetFile: item.targetFile,
    status: "skipped",
    diffPreview: item.diffPreview,
    updatedAt: new Date().toISOString(),
    message: "Merge was skipped by review choice."
  });

  await writeMergeResults(nextResults);
  return buildMergeQueue();
}
