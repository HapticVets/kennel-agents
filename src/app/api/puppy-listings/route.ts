import { NextResponse } from "next/server";

import {
  createLocalPuppyListing,
  deleteLocalPuppyListing,
  readLocalPuppyListingsStore
} from "@/lib/local-puppy-listings";
import type { PuppyListingRecord, PuppyListingStatus } from "@/types/health";

type PuppyListingRequestBody = Omit<
  PuppyListingRecord,
  "id" | "createdAt" | "updatedAt"
>;

function normalizeStatus(value: string | undefined): PuppyListingStatus {
  if (value === "reserved" || value === "sold") {
    return value;
  }

  return "available";
}

function validateRequestBody(body: Partial<PuppyListingRequestBody>): string | null {
  if (!body.puppyName?.trim()) {
    return "puppyName is required.";
  }

  if (!body.litterName?.trim()) {
    return "litterName is required.";
  }

  if (!body.sex?.trim()) {
    return "sex is required.";
  }

  if (!body.shortDescription?.trim()) {
    return "shortDescription is required.";
  }

  return null;
}

export async function GET() {
  const store = await readLocalPuppyListingsStore();
  return NextResponse.json(store);
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<PuppyListingRequestBody>;
  const validationError = validateRequestBody(body);

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const store = await createLocalPuppyListing({
    puppyName: body.puppyName?.trim() ?? "",
    litterName: body.litterName?.trim() ?? "",
    sex: body.sex?.trim() ?? "",
    color: body.color?.trim() ?? "",
    birthDate: body.birthDate?.trim() ?? "",
    readyDate: body.readyDate?.trim() ?? "",
    price: body.price?.trim() ?? "",
    status: normalizeStatus(body.status),
    shortDescription: body.shortDescription?.trim() ?? "",
    imagePath: body.imagePath?.trim() ?? "",
    goodDogLink: body.goodDogLink?.trim() ?? ""
  });

  return NextResponse.json(store);
}

export async function DELETE(request: Request) {
  const itemId = new URL(request.url).searchParams.get("itemId");

  if (!itemId) {
    return NextResponse.json({ error: "itemId is required." }, { status: 400 });
  }

  const store = await deleteLocalPuppyListing(itemId);

  if (!store) {
    return NextResponse.json({ error: "Puppy listing not found." }, { status: 404 });
  }

  return NextResponse.json(store);
}
