import { access, readFile, writeFile } from "fs/promises";
import path from "path";

import { TARGET_SITE_PATH } from "@/lib/config";
import {
  readApprovalStates,
  readOptimizationMergeReport,
  readSectionRewriteReport,
  writeOptimizationMergeReport
} from "@/lib/storage";
import type {
  ApprovalState,
  OptimizationMergeItem,
  OptimizationMergeReport,
  RewriteSectionName,
  SectionRewriteDraft
} from "@/types/health";

const layoutFilePath = path.join(TARGET_SITE_PATH, "src", "app", "layout.tsx");
const homePageClientFilePath = path.join(
  TARGET_SITE_PATH,
  "src",
  "components",
  "HomePageClient.tsx"
);

const finalCopyBySection: Record<RewriteSectionName, string> = {
  seo_title:
    "German Shepherd Puppies for Sale | Structured Training & Placement | Patriot K9 Kennel",
  meta_description:
    "Purpose-bred German Shepherd puppies with structured placement, proven training foundations, and ongoing support. Apply today to secure your dog.",
  hero_headline:
    "Purpose-Bred German Shepherds Trained and Matched for the Right Home",
  hero_supporting_paragraph:
    "Patriot K9 Kennel provides purpose-bred German Shepherd puppies with structured placement, clear training standards, and support that continues long after pickup. Every dog is raised, evaluated, and matched with intention.",
  primary_cta_text: "Start Your Puppy Application"
};

const currentHeroLiteralBySection: Record<
  "hero_headline" | "hero_supporting_paragraph" | "primary_cta_text",
  string
> = {
  hero_headline: `Purpose-bred German Shepherds.
                <br />
                Structured training.
                <br />
                Veteran-driven mission.`,
  hero_supporting_paragraph: `Das MÃƒÂ¼ller is built to place the right German Shepherd in the
                right home, backed by structure, screening, and a training path
                that continues beyond pickup day.`,
  primary_cta_text: "Apply for a Puppy"
};

type HomepageRewriteSection =
  | "hero_headline"
  | "hero_supporting_paragraph"
  | "primary_cta_text";

const mergeDebugEnabled = process.env.KENNEL_HEALTH_DEBUG === "true";

function isApprovedSectionRewrite(states: ApprovalState[], itemId: string): boolean {
  return states.some(
    (state) =>
      state.itemId === itemId &&
      state.sourceType === "section_rewrite" &&
      state.status === "approved"
  );
}

function getApprovedSectionRewriteDrafts(
  states: ApprovalState[],
  drafts: SectionRewriteDraft[]
): SectionRewriteDraft[] {
  const explicitApprovedDrafts = drafts.filter((draft) =>
    isApprovedSectionRewrite(states, draft.id)
  );

  if (explicitApprovedDrafts.length > 0) {
    return explicitApprovedDrafts;
  }

  const hasAnySectionRewriteState = states.some(
    (state) => state.sourceType === "section_rewrite"
  );

  // Backward-compatible fallback:
  // older local data may contain generated rewrites without the newer
  // section_rewrite approval records yet. In that case, still build previews
  // so the operator is not left with an empty merge queue.
  return hasAnySectionRewriteState ? [] : drafts;
}

function getSavedItem(
  report: OptimizationMergeReport,
  itemId: string
): OptimizationMergeItem | undefined {
  return report.items.find((item) => item.itemId === itemId);
}

function buildDiffPreview(currentValue: string, proposedReplacement: string): string {
  return [
    "--- Current",
    currentValue || "(not found)",
    "",
    "+++ Proposed",
    proposedReplacement
  ].join("\n");
}

function normalizeInlineText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function matchTopLevelMetadataField(
  fileContent: string,
  fieldName: "title" | "description"
): { currentValue: string } | null {
  // Keep metadata updates conservative by only touching the top-level metadata export field.
  const metadataBlockMatch = fileContent.match(
    /export const metadata: Metadata = \{[\s\S]*?\n\};/
  );

  if (!metadataBlockMatch) {
    return null;
  }

  const propertyPattern = new RegExp(
    fieldName === "title"
      ? String.raw`^\s*title:\s*"([^"]*)",?`
      : String.raw`^\s*description:\s*"([^"]*)",?`,
    "m"
  );

  const propertyMatch = metadataBlockMatch[0].match(propertyPattern);

  if (!propertyMatch) {
    return null;
  }

  return {
    currentValue: propertyMatch[1]
  };
}

function replaceTopLevelMetadataField(
  fileContent: string,
  fieldName: "title" | "description",
  replacement: string
): string | null {
  const metadataBlockMatch = fileContent.match(
    /export const metadata: Metadata = \{[\s\S]*?\n\};/
  );

  if (!metadataBlockMatch) {
    return null;
  }

  const propertyPattern = new RegExp(
    fieldName === "title"
      ? String.raw`(^\s*title:\s*)"([^"]*)"(,?)`
      : String.raw`(^\s*description:\s*)"([^"]*)"(,?)`,
    "m"
  );

  if (!propertyPattern.test(metadataBlockMatch[0])) {
    return null;
  }

  const updatedMetadataBlock = metadataBlockMatch[0].replace(
    propertyPattern,
    `$1"${replacement}"$3`
  );

  return fileContent.replace(metadataBlockMatch[0], updatedMetadataBlock);
}

function extractHomepageSectionValue(
  fileContent: string,
  sectionName: HomepageRewriteSection
): string | null {
  if (sectionName === "hero_headline") {
    const match = fileContent.match(/<h1[^>]*>\s*([\s\S]*?)\s*<\/h1>/);

    if (!match) {
      return null;
    }

    return normalizeInlineText(
      match[1].replace(/<br\s*\/?>/g, " ").replace(/<[^>]+>/g, " ")
    );
  }

  if (sectionName === "hero_supporting_paragraph") {
    const match = fileContent.match(
      /<p className="mt-6 max-w-2xl text-lg leading-8 text-neutral-300">\s*([\s\S]*?)\s*<\/p>/
    );

    if (!match) {
      return null;
    }

    return normalizeInlineText(match[1].replace(/<[^>]+>/g, " "));
  }

  const match = fileContent.match(
    /<a\s+[^>]*href="#application"[^>]*>\s*([\s\S]*?)\s*<\/a>/
  );

  if (!match) {
    return null;
  }

  return normalizeInlineText(match[1].replace(/<[^>]+>/g, " "));
}

function buildMetadataPreviewItem(
  draft: SectionRewriteDraft,
  fileContent: string,
  savedItem?: OptimizationMergeItem
): OptimizationMergeItem {
  const targetField =
    draft.sectionName === "seo_title" ? "metadata.title" : "metadata.description";
  const match = matchTopLevelMetadataField(
    fileContent,
    draft.sectionName === "seo_title" ? "title" : "description"
  );
  const proposedReplacement = finalCopyBySection[draft.sectionName];

  return {
    itemId: draft.id,
    sourceType: "section_rewrite",
    title: draft.sourceInsightTitle,
    sectionName: draft.sectionName,
    targetFile: layoutFilePath,
    targetField,
    currentValue: match?.currentValue ?? "",
    proposedReplacement,
    diffPreview: buildDiffPreview(match?.currentValue ?? "", proposedReplacement),
    status: savedItem?.status ?? (match ? "ready" : "unmatched"),
    message:
      savedItem?.message ??
      (match
        ? undefined
        : "The target metadata field could not be matched safely in layout.tsx.")
  };
}

function buildHomepagePreviewItem(
  draft: SectionRewriteDraft & { sectionName: HomepageRewriteSection },
  fileContent: string,
  savedItem?: OptimizationMergeItem
): OptimizationMergeItem {
  const proposedReplacement = finalCopyBySection[draft.sectionName];
  const targetFieldMap = {
    hero_headline: "hero heading",
    hero_supporting_paragraph: "hero supporting paragraph",
    primary_cta_text: "hero primary CTA"
  } as const;
  const currentValue = extractHomepageSectionValue(fileContent, draft.sectionName);

  return {
    itemId: draft.id,
    sourceType: "section_rewrite",
    title: draft.sourceInsightTitle,
    sectionName: draft.sectionName,
    targetFile: homePageClientFilePath,
    targetField: targetFieldMap[draft.sectionName],
    currentValue: currentValue ?? "",
    proposedReplacement,
    diffPreview: buildDiffPreview(currentValue ?? "", proposedReplacement),
    status: savedItem?.status ?? (currentValue ? "ready" : "unmatched"),
    message:
      savedItem?.message ??
      (currentValue
        ? undefined
        : "The target hero field could not be matched safely in HomePageClient.tsx.")
  };
}

async function ensureTargetFilesAccessible(): Promise<void> {
  await access(layoutFilePath);
  await access(homePageClientFilePath);
}

export async function buildOptimizationMergeReport(): Promise<OptimizationMergeReport> {
  await ensureTargetFilesAccessible();

  const [approvals, rewriteReport, savedReport, layoutContent, homePageClientContent] =
    await Promise.all([
      readApprovalStates(),
      readSectionRewriteReport(),
      readOptimizationMergeReport(),
      readFile(layoutFilePath, "utf8"),
      readFile(homePageClientFilePath, "utf8")
    ]);

  const approvedDrafts = getApprovedSectionRewriteDrafts(
    approvals,
    rewriteReport.drafts
  );

  if (mergeDebugEnabled) {
    console.log("[OptimizationMergeAgent]", {
      approvedRewriteCount: approvedDrafts.length,
      mappedSections: approvedDrafts.map((draft) => draft.sectionName),
      usingExplicitSectionRewriteApprovals: approvals.some(
        (state) => state.sourceType === "section_rewrite" && state.status === "approved"
      )
    });
  }

  const items = approvedDrafts.map((draft) => {
    const savedItem = getSavedItem(savedReport, draft.id);

    if (draft.sectionName === "seo_title" || draft.sectionName === "meta_description") {
      return buildMetadataPreviewItem(draft, layoutContent, savedItem);
    }

    return buildHomepagePreviewItem(
      draft as SectionRewriteDraft & { sectionName: HomepageRewriteSection },
      homePageClientContent,
      savedItem
    );
  });

  return {
    generatedAt: new Date().toISOString(),
    items
  };
}

function replaceHomepageSection(
  fileContent: string,
  sectionName: HomepageRewriteSection
): string | null {
  const replacement = finalCopyBySection[sectionName];

  if (sectionName === "hero_headline") {
    const exactLiteral = currentHeroLiteralBySection.hero_headline;

    if (fileContent.includes(exactLiteral)) {
      return fileContent.replace(exactLiteral, replacement);
    }

    if (!/<h1[^>]*>[\s\S]*?<\/h1>/.test(fileContent)) {
      return null;
    }

    return fileContent.replace(
      /(<h1[^>]*>\s*)([\s\S]*?)(\s*<\/h1>)/,
      `$1${replacement}$3`
    );
  }

  if (sectionName === "hero_supporting_paragraph") {
    const exactLiteral = currentHeroLiteralBySection.hero_supporting_paragraph;

    if (fileContent.includes(exactLiteral)) {
      return fileContent.replace(exactLiteral, replacement);
    }

    if (
      !/<p className="mt-6 max-w-2xl text-lg leading-8 text-neutral-300">[\s\S]*?<\/p>/.test(
        fileContent
      )
    ) {
      return null;
    }

    return fileContent.replace(
      /(<p className="mt-6 max-w-2xl text-lg leading-8 text-neutral-300">\s*)([\s\S]*?)(\s*<\/p>)/,
      `$1${replacement}$3`
    );
  }

  const exactLiteral = currentHeroLiteralBySection.primary_cta_text;

  if (fileContent.includes(exactLiteral)) {
    return fileContent.replace(exactLiteral, replacement);
  }

  if (!/<a\s+[^>]*href="#application"[^>]*>[\s\S]*?<\/a>/.test(fileContent)) {
    return null;
  }

  return fileContent.replace(
    /(<a\s+[^>]*href="#application"[^>]*>\s*)([\s\S]*?)(\s*<\/a>)/,
    `$1${replacement}$3`
  );
}

async function saveOptimizationMergeItem(
  nextItem: OptimizationMergeItem
): Promise<void> {
  const currentReport = await readOptimizationMergeReport();
  const nextItems = currentReport.items.filter((item) => item.itemId !== nextItem.itemId);

  nextItems.push(nextItem);

  await writeOptimizationMergeReport({
    generatedAt: new Date().toISOString(),
    items: nextItems
  });
}

export async function applyOptimizationMerge(itemId: string): Promise<OptimizationMergeReport> {
  const queue = await buildOptimizationMergeReport();
  const item = queue.items.find((queueItem) => queueItem.itemId === itemId);

  if (!item) {
    throw new Error("Optimization merge item not found.");
  }

  if (item.status === "unmatched") {
    throw new Error(item.message ?? "The target field could not be matched safely.");
  }

  try {
    if (item.sectionName === "seo_title" || item.sectionName === "meta_description") {
      const layoutContent = await readFile(layoutFilePath, "utf8");
      const mergedContent = replaceTopLevelMetadataField(
        layoutContent,
        item.sectionName === "seo_title" ? "title" : "description",
        item.proposedReplacement
      );

      if (!mergedContent) {
        throw new Error("The target metadata field could not be matched safely.");
      }

      await writeFile(layoutFilePath, mergedContent, "utf8");
    } else {
      const homePageClientContent = await readFile(homePageClientFilePath, "utf8");
      const mergedContent = replaceHomepageSection(homePageClientContent, item.sectionName);

      if (!mergedContent) {
        throw new Error("The target hero field could not be matched safely.");
      }

      await writeFile(homePageClientFilePath, mergedContent, "utf8");
    }

    await saveOptimizationMergeItem({
      ...item,
      status: "applied",
      message: "Optimization rewrite was merged into the real site file."
    });
  } catch (error) {
    await saveOptimizationMergeItem({
      ...item,
      status: "failed",
      message: error instanceof Error ? error.message : "Unknown optimization merge error."
    });
  }

  return buildOptimizationMergeReport();
}

export async function skipOptimizationMerge(itemId: string): Promise<OptimizationMergeReport> {
  const queue = await buildOptimizationMergeReport();
  const item = queue.items.find((queueItem) => queueItem.itemId === itemId);

  if (!item) {
    throw new Error("Optimization merge item not found.");
  }

  await saveOptimizationMergeItem({
    ...item,
    status: "skipped",
    message: "Optimization merge was skipped by review choice."
  });

  return buildOptimizationMergeReport();
}
