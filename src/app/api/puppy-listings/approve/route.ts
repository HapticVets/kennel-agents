import { NextResponse } from "next/server";

import { updateApprovalStatus } from "@/lib/approval-queue";
import { readPuppyListingReport, writePuppyListingReport } from "@/lib/storage";
import type { ApprovalStatus } from "@/types/health";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    itemId?: string;
    status?: ApprovalStatus;
  };

  if (!body.itemId || !body.status) {
    return NextResponse.json(
      { error: "itemId and status are required." },
      { status: 400 }
    );
  }

  await updateApprovalStatus(body.itemId, "puppy_listing", body.status);
  const report = await readPuppyListingReport();
  const allListings = [
    ...report.drafts,
    ...report.consumedDrafts,
    ...report.archivedDrafts
  ];
  const existingListing = allListings.find((listing) => listing.id === body.itemId);

  if (!existingListing) {
    return NextResponse.json(
      { error: "Puppy listing could not be found for approval update." },
      { status: 404 }
    );
  }

  const nextStatus =
    body.status === "approved"
      ? "approved"
      : body.status === "rejected"
        ? "archived"
        : existingListing.status;
  const updatedAt = new Date().toISOString();
  const nextDrafts = report.drafts
    .filter((listing) => listing.id !== body.itemId)
    .concat(
      nextStatus !== "archived"
        ? [
            {
              ...existingListing,
              status: nextStatus,
              updatedAt
            }
          ]
        : []
    );
  const nextArchivedDrafts = report.archivedDrafts
    .filter((listing) => listing.id !== body.itemId)
    .concat(
      nextStatus === "archived"
        ? [
            {
              ...existingListing,
              status: "archived",
              updatedAt
            }
          ]
        : []
    );
  const nextReport = await writePuppyListingReport({
    ...report,
    drafts: nextDrafts,
    consumedDrafts: report.consumedDrafts.filter((listing) => listing.id !== body.itemId),
    archivedDrafts: nextArchivedDrafts
  });

  if (process.env.KENNEL_HEALTH_DEBUG === "true") {
    console.log("[PuppyListingApproval]", {
      itemId: body.itemId,
      oldStatus: existingListing.status,
      newStatus: nextStatus,
      wrotePuppyListings: true
    });
  }
  return NextResponse.json(nextReport);
}
