import { access, copyFile, mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import { TARGET_SITE_PATH } from "@/lib/config";
import {
  readApprovalStates,
  readPuppyListingReport,
  readPuppyPlacementReport,
  writePuppyListingReport,
  writePuppyPlacementReport
} from "@/lib/storage";
import type {
  ApprovalState,
  PuppyListingDraft,
  PuppyPlacementItem,
  PuppyPlacementReport
} from "@/types/health";

const homePageClientFilePath = path.join(
  TARGET_SITE_PATH,
  "src",
  "components",
  "HomePageClient.tsx"
);
const sourcePuppyUploadsDirectory = path.join(
  process.cwd(),
  "public",
  "uploads",
  "puppy-listings"
);
const targetPuppyUploadsDirectory = path.join(
  TARGET_SITE_PATH,
  "public",
  "uploads",
  "puppy-listings"
);

function normalizePuppyImagePublicUrl(fileName: string): string {
  return `/uploads/puppy-listings/${fileName.replace(/^\/+/, "")}`;
}

function isApprovedListing(states: ApprovalState[], draft: PuppyListingDraft): boolean {
  return (
    (draft.status === "approved" || draft.status === "ready_for_placement") &&
    !states.some(
      (state) =>
        state.itemId === draft.id &&
        state.sourceType === "puppy_listing" &&
        (state.status === "rejected" || state.status === "consumed")
    )
  );
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getExistingSectionState(fileContent: string): string {
  if (/AGENT_MANAGED_PUPPY_LISTINGS_START/.test(fileContent)) {
    return "An existing agent-managed puppy listings section is already present.";
  }

  if (/Available Puppies/.test(fileContent)) {
    return "A puppy listings section already exists outside the agent-managed block.";
  }

  return "No puppy listings section exists yet.";
}

function buildListingCard(draft: PuppyListingDraft): string {
  const primaryImage = draft.images[0];
  const renderedImageSrc = primaryImage
    ? primaryImage.publicUrl.startsWith("http")
      ? primaryImage.publicUrl
      : normalizePuppyImagePublicUrl(primaryImage.fileName)
    : "";
  const imageMarkup = primaryImage
    ? [
        '                <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900">',
        `                  <img src="${escapeText(renderedImageSrc)}" alt="${escapeText(primaryImage.altText)}" className="h-64 w-full object-cover" />`,
        "                </div>"
      ].join("\n")
    : "";

  return [
    '            <article className="rounded-3xl border border-neutral-800 bg-neutral-950 p-6">',
    imageMarkup,
    '              <div className="mt-5 flex items-center justify-between gap-4">',
    `                <h3 className="text-2xl font-semibold">${escapeText(draft.puppyName)}</h3>`,
    `                <span className="rounded-full bg-amber-500/15 px-3 py-1 text-sm font-semibold text-amber-300">${escapeText(draft.availability)}</span>`,
    "              </div>",
    `              <p className="mt-4 text-neutral-300">${escapeText(draft.shortSummary)}</p>`,
    `              <p className="mt-4 text-sm text-neutral-400">${escapeText(draft.homepageCardCopy)}</p>`,
    `              <a href="#application" className="mt-6 inline-flex text-sm font-semibold text-amber-400 hover:underline">Ask about ${escapeText(draft.puppyName)} →</a>`,
    "            </article>"
  ]
    .filter(Boolean)
    .join("\n");
}

function buildListingPreview(drafts: PuppyListingDraft[]): string {
  return drafts
    .map(
      (draft) =>
        `${draft.puppyName} (${draft.availability})\n${draft.shortSummary}\n${draft.homepageCardCopy}`
    )
    .join("\n\n");
}

function buildPuppySection(drafts: PuppyListingDraft[]): string {
  const cards = drafts.map((draft) => buildListingCard(draft)).join("\n");

  return [
    '{/* <!-- AGENT_MANAGED_PUPPY_LISTINGS_START --> */}',
    '        <section id="available-puppies" className="border-t border-neutral-900 bg-neutral-900/40">',
    '          <div className="mx-auto max-w-7xl px-6 py-20 md:px-10 lg:px-12">',
    '            <div className="max-w-3xl">',
    '              <p className="text-sm uppercase tracking-[0.25em] text-amber-400">',
    "                Available Puppies",
    "              </p>",
    '              <h2 className="mt-4 text-3xl font-bold md:text-5xl">',
    "                Current puppy listings",
    "              </h2>",
    '              <p className="mt-6 text-lg leading-8 text-neutral-300">',
    "                These puppy cards come directly from approved listing drafts so the homepage can stay current without manual copy-paste updates.",
    "              </p>",
    "            </div>",
    '            <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">',
    cards,
    "            </div>",
    "          </div>",
    "        </section>",
    '{/* <!-- AGENT_MANAGED_PUPPY_LISTINGS_END --> */}'
  ].join("\n");
}

function buildDiffPreview(currentState: string, drafts: PuppyListingDraft[]): string {
  return ["--- Current", currentState, "", "+++ Proposed", buildListingPreview(drafts)].join(
    "\n"
  );
}

const existingBlockPattern =
  /\s*\{\/\*\s*<!-- AGENT_MANAGED_PUPPY_LISTINGS_START -->\s*\*\/\}[\s\S]*?\{\/\*\s*<!-- AGENT_MANAGED_PUPPY_LISTINGS_END -->\s*\*\/\}/m;

function replaceOrInsertPuppySection(fileContent: string, drafts: PuppyListingDraft[]): string {
  const puppySection = buildPuppySection(drafts);

  if (existingBlockPattern.test(fileContent)) {
    return fileContent.replace(existingBlockPattern, `\n${puppySection}\n`);
  }

  const afterLittersPattern = /(\s*<AvailableLitters \/>)/m;

  if (afterLittersPattern.test(fileContent)) {
    return fileContent.replace(afterLittersPattern, `$1\n\n${puppySection}`);
  }

  throw new Error("Could not find a safe insertion point after the litters section.");
}

function replaceOrRemovePuppySection(fileContent: string, drafts: PuppyListingDraft[]): string {
  if (drafts.length === 0) {
    return existingBlockPattern.test(fileContent)
      ? fileContent.replace(existingBlockPattern, "\n")
      : fileContent;
  }

  return replaceOrInsertPuppySection(fileContent, drafts);
}

function isVisibleOnSiteStatus(status: PuppyListingDraft["status"]): boolean {
  return (
    status === "applied" ||
    status === "deployed" ||
    status === "active_on_site" ||
    status === "sold_or_reserved"
  );
}

function buildSiteVisibleListings(
  drafts: PuppyListingDraft[],
  extraAppliedIds: Set<string> = new Set()
): PuppyListingDraft[] {
  return drafts.filter(
    (draft) => extraAppliedIds.has(draft.id) || isVisibleOnSiteStatus(draft.status)
  );
}

async function ensureHomepageAccessible(): Promise<void> {
  await access(homePageClientFilePath);
}

async function copyListingImagesToTargetSite(drafts: PuppyListingDraft[]): Promise<void> {
  await mkdir(targetPuppyUploadsDirectory, { recursive: true });

  for (const draft of drafts) {
    for (const image of draft.images) {
      // Hosted storage images are already web-accessible and do not need to be copied
      // into the local website repo during the migration window.
      if (image.publicUrl.startsWith("http")) {
        continue;
      }

      const sourceFilePath = path.join(sourcePuppyUploadsDirectory, image.fileName);
      const targetFilePath = path.join(targetPuppyUploadsDirectory, image.fileName);
      let sourceExists = true;
      let targetExists = true;

      try {
        await access(sourceFilePath);
      } catch {
        sourceExists = false;
      }

      try {
        await access(targetFilePath);
      } catch {
        targetExists = false;
      }

      if (process.env.KENNEL_HEALTH_DEBUG === "true") {
        console.log("[PuppyListingImage]", {
          itemId: draft.id,
          storedImagePath: image.publicUrl,
          renderedImageSrc: normalizePuppyImagePublicUrl(image.fileName),
          sourceExists,
          targetExists
        });
      }

      if (!sourceExists) {
        throw new Error(`Source puppy image is missing: ${sourceFilePath}`);
      }

      if (!targetExists) {
        await copyFile(sourceFilePath, targetFilePath);
      }
    }
  }
}

async function savePuppyPlacementItem(nextItem: PuppyPlacementItem): Promise<void> {
  const currentReport = await readPuppyPlacementReport();
  const nextItems = currentReport.items.filter((item) => item.itemId !== nextItem.itemId);
  nextItems.push(nextItem);

  await writePuppyPlacementReport({
    generatedAt: new Date().toISOString(),
    items: nextItems
  });
}

export async function buildPuppyPlacementReport(): Promise<PuppyPlacementReport> {
  await ensureHomepageAccessible();

  const [states, listingReport, savedReport, homePageClientContent] = await Promise.all([
    readApprovalStates(),
    readPuppyListingReport(),
    readPuppyPlacementReport(),
    readFile(homePageClientFilePath, "utf8")
  ]);
  const readyListingIds = new Set(
    listingReport.drafts
      .filter(
        (draft) =>
          draft.status === "approved" ||
          (
            draft.status === "draft" &&
            states.some(
              (state) =>
                state.itemId === draft.id &&
                state.sourceType === "puppy_listing" &&
                state.status === "approved"
            )
          )
      )
      .map((draft) => draft.id)
  );
  const sourceStatusSnapshot = Object.fromEntries(
    listingReport.drafts.map((draft) => [draft.id, draft.status])
  );

  if (readyListingIds.size > 0) {
    const updatedAt = new Date().toISOString();

    await writePuppyListingReport({
      ...listingReport,
      drafts: listingReport.drafts.map((draft) =>
        readyListingIds.has(draft.id)
          ? {
              ...draft,
              status: "ready_for_placement" as const,
              updatedAt
            }
          : draft
      )
    });

    if (process.env.KENNEL_HEALTH_DEBUG === "true") {
      console.log("[PuppyListingLifecycle]", {
        itemIds: [...readyListingIds],
        transition: "ready_for_placement",
        updatedAt,
        sourceStatuses: Object.fromEntries(
          [...readyListingIds].map((itemId) => [itemId, sourceStatusSnapshot[itemId] ?? "missing"])
        ),
        wrotePuppyListings: true
      });
    }
  }

  const refreshedListingReport =
    readyListingIds.size > 0 ? await readPuppyListingReport() : listingReport;

  const approvedListings = refreshedListingReport.drafts.filter((draft) =>
    isApprovedListing(states, draft)
  );
  const currentSectionState = getExistingSectionState(homePageClientContent);

  if (process.env.KENNEL_HEALTH_DEBUG === "true") {
    console.log("[PuppyPlacementReport]", {
      foundListingCount: approvedListings.length,
      listingIds: approvedListings.map((draft) => draft.id),
      acceptedStatuses: ["approved", "ready_for_placement"]
    });
  }

  const items = approvedListings.map((draft) => {
    const savedItem = savedReport.items.find((item) => item.itemId === draft.id);

    return {
      itemId: draft.id,
      sourceType: "puppy_listing" as const,
      title: draft.listingTitle,
      targetFile: homePageClientFilePath,
      currentSectionState,
      listingPreview: buildListingPreview([draft]),
      diffPreview: buildDiffPreview(currentSectionState, [draft]),
      status: savedItem?.status ?? "ready",
      updatedAt: savedItem?.updatedAt,
      message: savedItem?.message
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    items
  };
}

export async function syncPuppyListingsSection(): Promise<void> {
  const listingReport = await readPuppyListingReport();
  const siteVisibleListings = buildSiteVisibleListings(listingReport.drafts);
  const homePageClientContent = await readFile(homePageClientFilePath, "utf8");

  if (siteVisibleListings.length > 0) {
    await copyListingImagesToTargetSite(siteVisibleListings);
  }

  const mergedContent = replaceOrRemovePuppySection(
    homePageClientContent,
    siteVisibleListings
  );

  if (mergedContent !== homePageClientContent) {
    await writeFile(homePageClientFilePath, mergedContent, "utf8");
  }

  if (process.env.KENNEL_HEALTH_DEBUG === "true") {
    console.log("[PuppyPlacementSync]", {
      itemIds: siteVisibleListings.map((draft) => draft.id),
      listingCount: siteVisibleListings.length,
      wroteHomepageFile: mergedContent !== homePageClientContent
    });
  }
}

export async function applyPuppyPlacement(itemId?: string): Promise<PuppyPlacementReport> {
  const queue = await buildPuppyPlacementReport();
  const queuedItems = itemId
    ? queue.items.filter((item) => item.itemId === itemId)
    : queue.items;

  if (queuedItems.length === 0) {
    throw new Error("No approved puppy listings are ready for placement.");
  }

  const listingReport = await readPuppyListingReport();
  const approvedListings = listingReport.drafts.filter((draft) =>
    queuedItems.some((item) => item.itemId === draft.id)
  );

  try {
    const homePageClientContent = await readFile(homePageClientFilePath, "utf8");
    const appliedIds = new Set(approvedListings.map((draft) => draft.id));
    const siteVisibleListings = buildSiteVisibleListings(listingReport.drafts, appliedIds);

    await copyListingImagesToTargetSite(siteVisibleListings);
    const mergedContent = replaceOrRemovePuppySection(
      homePageClientContent,
      siteVisibleListings
    );
    await writeFile(homePageClientFilePath, mergedContent, "utf8");

    const updatedAt = new Date().toISOString();

    if (process.env.KENNEL_HEALTH_DEBUG === "true") {
      console.log("[PuppyListingLifecycle]", {
        itemIds: approvedListings.map((draft) => draft.id),
        transition: "inserted_into_site",
        updatedAt
      });
    }

    await writePuppyListingReport({
      ...listingReport,
      drafts: listingReport.drafts.map((draft) =>
        approvedListings.some((approved) => approved.id === draft.id)
          ? {
              ...draft,
              status: "applied" as const,
              updatedAt
            }
          : draft
      ),
      consumedDrafts: listingReport.consumedDrafts
    });

    for (const item of queuedItems) {
      await savePuppyPlacementItem({
        ...item,
        status: "applied",
        updatedAt,
        message: "Approved puppy listings were merged into the homepage component."
      });
    }
  } catch (error) {
    for (const item of queuedItems) {
      await savePuppyPlacementItem({
        ...item,
        status: "failed",
        updatedAt: new Date().toISOString(),
        message:
          error instanceof Error
            ? error.message
            : "Unknown puppy placement error."
      });
    }
  }

  return buildPuppyPlacementReport();
}

export async function skipPuppyPlacement(itemId: string): Promise<PuppyPlacementReport> {
  const queue = await buildPuppyPlacementReport();
  const item = queue.items.find((entry) => entry.itemId === itemId);

  if (!item) {
    throw new Error("Puppy placement item not found.");
  }

  await savePuppyPlacementItem({
    ...item,
    status: "skipped",
    updatedAt: new Date().toISOString(),
    message: "Puppy placement was skipped by review choice."
  });

  return buildPuppyPlacementReport();
}
