import { access, readFile, writeFile } from "fs/promises";
import path from "path";

import { TARGET_SITE_PATH } from "@/lib/config";
import {
  readApprovalStates,
  readContentDraftReport,
  readFaqPlacementReport,
  writeFaqPlacementReport
} from "@/lib/storage";
import type {
  ApprovalState,
  ContentDraft,
  FaqItem,
  FaqPlacementItem,
  FaqPlacementReport
} from "@/types/health";

const homePageClientFilePath = path.join(
  TARGET_SITE_PATH,
  "src",
  "components",
  "HomePageClient.tsx"
);

function isApprovedFaqDraft(states: ApprovalState[], draft: ContentDraft): boolean {
  return (
    draft.contentType === "faq_items" &&
    states.some(
      (state) =>
        state.itemId === draft.id &&
        state.sourceType === "content_draft" &&
        state.status === "approved"
    )
  );
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function parseFaqItems(draftText: string): FaqItem[] {
  const matches = [...draftText.matchAll(/(?:^|\n)(\d+)\.\s*(.+?)\n([\s\S]*?)(?=(?:\n\d+\.\s)|$)/g)];

  return matches
    .map((match) => ({
      question: normalizeText(match[2]),
      answer: normalizeText(match[3])
    }))
    .filter((item) => item.question && item.answer);
}

function buildFaqBlock(draft: ContentDraft, faqItems: FaqItem[]): string {
  const faqCards = faqItems
    .map(
      (item) => [
        '              <details className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">',
        `                <summary className="cursor-pointer text-lg font-semibold text-white">${item.question}</summary>`,
        `                <p className="mt-4 text-neutral-300">${item.answer}</p>`,
        "              </details>"
      ].join("\n")
    )
    .join("\n");

  return [
    `        {/* FAQ Placement Agent: approved FAQ section start - ${draft.id} */}`,
    '        <section id="faq" className="border-t border-neutral-900 bg-neutral-900/40">',
    '          <div className="mx-auto max-w-5xl px-6 py-20 md:px-10">',
    '            <div className="max-w-3xl">',
    '              <p className="text-sm uppercase tracking-[0.25em] text-amber-400">',
    "                FAQ",
    "              </p>",
    '              <h2 className="mt-4 text-3xl font-bold md:text-5xl">',
    "                Common questions before you apply.",
    "              </h2>",
    '              <p className="mt-6 text-lg leading-8 text-neutral-300">',
    "                These answers come from the approved FAQ content draft so visitors can get clarity before contacting the kennel or starting the application.",
    "              </p>",
    "            </div>",
    '            <div className="mt-10 space-y-4">',
    faqCards,
    "            </div>",
    "          </div>",
    "        </section>",
    `        {/* FAQ Placement Agent: approved FAQ section end - ${draft.id} */}`
  ].join("\n");
}

function getExistingFaqState(fileContent: string): string {
  if (/FAQ Placement Agent: approved FAQ section start -/.test(fileContent)) {
    return "An existing agent-managed FAQ section is already present.";
  }

  if (/id="faq"/.test(fileContent)) {
    return "A homepage FAQ section already exists outside the agent-managed block.";
  }

  return "No FAQ section exists yet.";
}

function buildDiffPreview(currentFaqState: string, faqItems: FaqItem[]): string {
  const proposed = faqItems
    .map((item, index) => `${index + 1}. ${item.question}\n${item.answer}`)
    .join("\n\n");

  return ["--- Current", currentFaqState, "", "+++ Proposed", proposed].join("\n");
}

function replaceOrInsertFaqBlock(fileContent: string, draft: ContentDraft, faqItems: FaqItem[]): string {
  const faqBlock = buildFaqBlock(draft, faqItems);
  const existingBlockPattern =
    /\s*\{\/\* FAQ Placement Agent: approved FAQ section start - [^*]+ \*\/\}[\s\S]*?\{\/\* FAQ Placement Agent: approved FAQ section end - [^*]+ \*\/\}/m;

  if (existingBlockPattern.test(fileContent)) {
    return fileContent.replace(existingBlockPattern, `\n${faqBlock}\n\n`);
  }

  const applicationSectionPattern = /(\s*<section\s+id="application"[\s\S]*$)/m;

  if (applicationSectionPattern.test(fileContent)) {
    return fileContent.replace(applicationSectionPattern, `\n${faqBlock}\n$1`);
  }

  throw new Error("Could not find a safe insertion point before the application section.");
}

async function ensureHomepageAccessible(): Promise<void> {
  await access(homePageClientFilePath);
}

async function saveFaqPlacementItem(nextItem: FaqPlacementItem): Promise<void> {
  const currentReport = await readFaqPlacementReport();
  const nextItems = currentReport.items.filter((item) => item.itemId !== nextItem.itemId);

  nextItems.push(nextItem);

  await writeFaqPlacementReport({
    generatedAt: new Date().toISOString(),
    items: nextItems
  });
}

export async function buildFaqPlacementReport(): Promise<FaqPlacementReport> {
  await ensureHomepageAccessible();

  const [states, draftReport, savedReport, homePageClientContent] = await Promise.all([
    readApprovalStates(),
    readContentDraftReport(),
    readFaqPlacementReport(),
    readFile(homePageClientFilePath, "utf8")
  ]);

  const approvedFaqDrafts = draftReport.drafts.filter((draft) =>
    isApprovedFaqDraft(states, draft)
  );

  const items = approvedFaqDrafts
    .map((draft) => {
      const proposedFaqItems = parseFaqItems(draft.draftText);

      if (proposedFaqItems.length === 0) {
        return {
          itemId: draft.id,
          sourceType: "content_draft" as const,
          title: draft.title,
          targetFile: homePageClientFilePath,
          currentFaqState: getExistingFaqState(homePageClientContent),
          proposedFaqItems: [],
          diffPreview: buildDiffPreview(
            getExistingFaqState(homePageClientContent),
            []
          ),
          status: "failed" as const,
          message: "The approved FAQ draft could not be parsed into question and answer items."
        };
      }

      const savedItem = savedReport.items.find((item) => item.itemId === draft.id);
      const currentFaqState = getExistingFaqState(homePageClientContent);

      return {
        itemId: draft.id,
        sourceType: "content_draft" as const,
        title: draft.title,
        targetFile: homePageClientFilePath,
        currentFaqState,
        proposedFaqItems,
        diffPreview: buildDiffPreview(currentFaqState, proposedFaqItems),
        status: savedItem?.status ?? "ready",
        message: savedItem?.message
      };
    });

  return {
    generatedAt: new Date().toISOString(),
    items
  };
}

export async function applyFaqPlacement(itemId: string): Promise<FaqPlacementReport> {
  const queue = await buildFaqPlacementReport();
  const item = queue.items.find((entry) => entry.itemId === itemId);

  if (!item) {
    throw new Error("FAQ placement item not found.");
  }

  if (item.proposedFaqItems.length === 0) {
    throw new Error(item.message ?? "There are no FAQ items to place.");
  }

  try {
    const draftReport = await readContentDraftReport();
    const draft = draftReport.drafts.find((entry) => entry.id === itemId);

    if (!draft) {
      throw new Error("Approved FAQ draft could not be found.");
    }

    const homePageClientContent = await readFile(homePageClientFilePath, "utf8");
    const mergedContent = replaceOrInsertFaqBlock(
      homePageClientContent,
      draft,
      item.proposedFaqItems
    );

    await writeFile(homePageClientFilePath, mergedContent, "utf8");

    await saveFaqPlacementItem({
      ...item,
      status: "applied",
      message: "FAQ section was merged into the homepage component."
    });
  } catch (error) {
    await saveFaqPlacementItem({
      ...item,
      status: "failed",
      message: error instanceof Error ? error.message : "Unknown FAQ placement error."
    });
  }

  return buildFaqPlacementReport();
}

export async function skipFaqPlacement(itemId: string): Promise<FaqPlacementReport> {
  const queue = await buildFaqPlacementReport();
  const item = queue.items.find((entry) => entry.itemId === itemId);

  if (!item) {
    throw new Error("FAQ placement item not found.");
  }

  await saveFaqPlacementItem({
    ...item,
    status: "skipped",
    message: "FAQ placement was skipped by review choice."
  });

  return buildFaqPlacementReport();
}
