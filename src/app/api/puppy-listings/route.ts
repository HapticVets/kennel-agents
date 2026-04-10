import { NextResponse } from "next/server";

import {
  buildPuppyListingContent,
  buildPuppyListingDraft,
  type PuppyListingIntakeInput
} from "@/lib/puppy-listing-agent";
import { storeUploadedPuppyImages } from "@/lib/puppy-listing-store";
import {
  readPuppyListingReport,
  writePuppyListingReport
} from "@/lib/storage";
import type {
  PuppyListingAvailability,
  PuppyListingDraft,
  PuppyListingReport
} from "@/types/health";

function parseAvailability(value: FormDataEntryValue | null): PuppyListingAvailability {
  const availability = typeof value === "string" ? value : "";

  if (availability === "reserved" || availability === "sold") {
    return availability;
  }

  return "available";
}

function buildIntakeInput(formData: FormData): PuppyListingIntakeInput {
  return {
    puppyName: String(formData.get("puppyName") || "").trim(),
    sex: String(formData.get("sex") || "").trim(),
    age: String(formData.get("age") || "").trim(),
    litter: String(formData.get("litter") || "").trim(),
    availability: parseAvailability(formData.get("availability")),
    temperamentNotes: String(formData.get("temperamentNotes") || "").trim(),
    breederNotes: String(formData.get("breederNotes") || "").trim(),
    priceOrDeposit: String(formData.get("priceOrDeposit") || "").trim() || undefined
  };
}

function validateIntakeInput(input: PuppyListingIntakeInput): string | null {
  if (
    !input.puppyName ||
    !input.sex ||
    !input.age ||
    !input.litter ||
    !input.temperamentNotes ||
    !input.breederNotes
  ) {
    return "puppyName, sex, age, litter, temperamentNotes, and breederNotes are required.";
  }

  return null;
}

function parseRemovedImageIds(formData: FormData): string[] {
  return formData
    .getAll("removedImageIds")
    .map((entry) => String(entry).trim())
    .filter(Boolean);
}

export async function GET() {
  const report = await readPuppyListingReport();
  return NextResponse.json(report);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const intakeInput = buildIntakeInput(formData);
  const validationError = validateIntakeInput(intakeInput);

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const files = formData
    .getAll("images")
    .filter((entry): entry is File => entry instanceof File);

  if (files.length === 0) {
    return NextResponse.json(
      { error: "At least one puppy image is required." },
      { status: 400 }
    );
  }

  const batchId = `puppy-listing-batch-${Date.now()}`;
  const savedImages = await storeUploadedPuppyImages(intakeInput.puppyName, files);
  const draft = buildPuppyListingDraft(intakeInput, savedImages, batchId);
  const existingReport = await readPuppyListingReport();

  const nextReport: PuppyListingReport = {
    generatedAt: draft.createdAt,
    activeBatchId: batchId,
    drafts: [draft, ...existingReport.drafts],
    consumedDrafts: existingReport.consumedDrafts,
    archivedDrafts: existingReport.archivedDrafts
  };

  const savedReport = await writePuppyListingReport(nextReport);
  return NextResponse.json(savedReport);
}

export async function PUT(request: Request) {
  const formData = await request.formData();
  const listingId = String(formData.get("listingId") || "").trim();

  if (!listingId) {
    return NextResponse.json({ error: "listingId is required." }, { status: 400 });
  }

  const intakeInput = buildIntakeInput(formData);
  const validationError = validateIntakeInput(intakeInput);

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const report = await readPuppyListingReport();
  const existingListing =
    report.drafts.find((listing) => listing.id === listingId) ||
    report.archivedDrafts.find((listing) => listing.id === listingId);

  if (!existingListing) {
    return NextResponse.json({ error: "Puppy listing not found." }, { status: 404 });
  }

  const files = formData
    .getAll("images")
    .filter((entry): entry is File => entry instanceof File);
  const removedImageIds = new Set(parseRemovedImageIds(formData));
  const keptImages = existingListing.images.filter((image) => !removedImageIds.has(image.id));
  const appendedImages = await storeUploadedPuppyImages(intakeInput.puppyName, files);
  const mergedImages = [...keptImages, ...appendedImages];

  if (mergedImages.length === 0) {
    return NextResponse.json(
      { error: "A puppy listing must keep at least one image." },
      { status: 400 }
    );
  }

  const nextContent = buildPuppyListingContent(intakeInput, mergedImages);
  const updatedAt = new Date().toISOString();
  // Public puppy listings are now data-driven, so editing keeps the lifecycle state.
  const nextStatus = existingListing.status;
  const nextListing: PuppyListingDraft = {
    ...existingListing,
    ...nextContent,
    status: nextStatus,
    updatedAt
  };
  const nextReport = {
    ...report,
    drafts: report.drafts.map((listing) =>
      listing.id === listingId ? nextListing : listing
    ),
    archivedDrafts: report.archivedDrafts.map((listing) =>
      listing.id === listingId ? nextListing : listing
    )
  };

  await writePuppyListingReport(nextReport);

  if (process.env.KENNEL_HEALTH_DEBUG === "true") {
    console.log("[PuppyListingEdit]", {
      itemId: listingId,
      oldStatus: existingListing.status,
      newStatus: nextStatus,
      removedImageIds: [...removedImageIds],
      appendedImageCount: appendedImages.length,
      totalImageCount: nextListing.images.length,
      publicFeedUpdatesImmediately: nextStatus !== "draft" && nextStatus !== "archived"
    });
  }

  return NextResponse.json(await readPuppyListingReport());
}
