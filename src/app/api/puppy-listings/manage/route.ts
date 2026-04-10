import { NextResponse } from "next/server";

import {
  readApprovalStates,
  readPuppyListingReport,
  writeApprovalStates,
  writePuppyListingReport
} from "@/lib/storage";
import type { ApprovalState, PuppyListingDraft, PuppyListingReport } from "@/types/health";

type PuppyManageAction =
  | "archive"
  | "restore"
  | "delete"
  | "publish"
  | "mark_sold_or_reserved";

function upsertApprovalState(
  states: ApprovalState[],
  nextState: ApprovalState
): ApprovalState[] {
  return [
    ...states.filter(
      (state) =>
        !(state.itemId === nextState.itemId && state.sourceType === nextState.sourceType)
    ),
    nextState
  ];
}

function buildNextReport(
  report: PuppyListingReport,
  nextListing: PuppyListingDraft | null,
  itemId: string
): PuppyListingReport {
  const nextDrafts = report.drafts.filter((listing) => listing.id !== itemId);
  const nextArchivedDrafts = report.archivedDrafts.filter((listing) => listing.id !== itemId);

  if (!nextListing) {
    return {
      ...report,
      drafts: nextDrafts,
      archivedDrafts: nextArchivedDrafts
    };
  }

  if (nextListing.status === "archived") {
    return {
      ...report,
      drafts: nextDrafts,
      archivedDrafts: [...nextArchivedDrafts, nextListing]
    };
  }

  return {
    ...report,
    drafts: [...nextDrafts, nextListing],
    archivedDrafts: nextArchivedDrafts
  };
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    itemId?: string;
    action?: PuppyManageAction;
  };

  if (!body.itemId || !body.action) {
    return NextResponse.json(
      { error: "itemId and action are required." },
      { status: 400 }
    );
  }

  const [report, approvals] = await Promise.all([
    readPuppyListingReport(),
    readApprovalStates()
  ]);
  const allListings = [...report.drafts, ...report.archivedDrafts];
  const existingListing = allListings.find((listing) => listing.id === body.itemId);

  if (!existingListing) {
    return NextResponse.json({ error: "Puppy listing not found." }, { status: 404 });
  }

  const updatedAt = new Date().toISOString();
  let nextListing: PuppyListingDraft | null = existingListing;
  let nextApprovals = approvals;

  switch (body.action) {
    case "archive":
      nextListing = {
        ...existingListing,
        status: "archived",
        updatedAt
      };
      nextApprovals = upsertApprovalState(nextApprovals, {
        itemId: existingListing.id,
        sourceType: "puppy_listing",
        status: "rejected",
        updatedAt
      });
      break;
    case "restore":
      nextListing = {
        ...existingListing,
        status: "approved",
        updatedAt
      };
      nextApprovals = upsertApprovalState(nextApprovals, {
        itemId: existingListing.id,
        sourceType: "puppy_listing",
        status: "approved",
        updatedAt
      });
      break;
    case "publish":
      if (
        existingListing.status !== "approved" &&
        existingListing.status !== "ready_for_placement" &&
        existingListing.status !== "applied" &&
        existingListing.status !== "deployed"
      ) {
        return NextResponse.json(
          { error: "Only approved puppy listings can be published." },
          { status: 400 }
        );
      }

      nextListing = {
        ...existingListing,
        status: "live_on_site",
        updatedAt
      };
      nextApprovals = upsertApprovalState(nextApprovals, {
        itemId: existingListing.id,
        sourceType: "puppy_listing",
        status: "published",
        updatedAt
      });
      break;
    case "delete":
      nextListing = null;
      nextApprovals = nextApprovals.filter(
        (state) =>
          !(state.itemId === existingListing.id && state.sourceType === "puppy_listing")
      );
      break;
    case "mark_sold_or_reserved": {
      const nextAvailability =
        existingListing.availability === "available" ? "reserved" : "sold";

      nextListing = {
        ...existingListing,
        availability: nextAvailability,
        status: "sold_or_reserved",
        updatedAt
      };
      break;
    }
    default:
      return NextResponse.json({ error: "Unsupported puppy listing action." }, { status: 400 });
  }

  const nextReport = buildNextReport(report, nextListing, existingListing.id);

  // Puppy inventory is now API-driven, so management actions only update the
  // listing source of truth instead of regenerating website JSX.
  await Promise.all([
    writePuppyListingReport(nextReport),
    writeApprovalStates(nextApprovals)
  ]);

  if (process.env.KENNEL_HEALTH_DEBUG === "true") {
    console.log("[PuppyListingManage]", {
      itemId: existingListing.id,
      action: body.action,
      oldStatus: existingListing.status,
      newStatus: nextListing?.status ?? "deleted",
      storageWriteSucceeded: true,
      publicFeedUpdatesImmediately: true,
      wrotePuppyListings: true,
      wroteApprovals: true
    });
  }

  const nextSyncedReport = await readPuppyListingReport();
  return NextResponse.json(nextSyncedReport);
}
