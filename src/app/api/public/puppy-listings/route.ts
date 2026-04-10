import { NextResponse } from "next/server";

import { readPuppyListingReport } from "@/lib/storage";
import type { PuppyListingDraftStatus } from "@/types/health";

const publicListingStatuses = new Set<PuppyListingDraftStatus>([
  // Only explicitly published puppy inventory should render on the public site.
  "live_on_site",
  // Keep legacy live statuses readable during migration.
  "active_on_site",
  "sold_or_reserved"
]);

export async function GET() {
  const report = await readPuppyListingReport();

  return NextResponse.json({
    generatedAt: report.generatedAt,
    listings: report.drafts.filter((listing) => publicListingStatuses.has(listing.status))
  });
}
