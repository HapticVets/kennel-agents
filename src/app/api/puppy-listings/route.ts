import { NextResponse } from "next/server";

import {
  createLocalPuppyListing,
  deleteLocalPuppyListing,
  readLocalPuppyListingsStore,
  saveLocalPuppyImage,
  validateLocalPuppyImage
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
  const formData = await request.formData();
  const fileEntry = formData.get("imageFile");
  const imageFile = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null;
  const body: Partial<PuppyListingRequestBody> = {
    puppyName: String(formData.get("puppyName") ?? "").trim(),
    litterName: String(formData.get("litterName") ?? "").trim(),
    sex: String(formData.get("sex") ?? "").trim(),
    color: String(formData.get("color") ?? "").trim(),
    birthDate: String(formData.get("birthDate") ?? "").trim(),
    readyDate: String(formData.get("readyDate") ?? "").trim(),
    price: String(formData.get("price") ?? "").trim(),
    status: normalizeStatus(String(formData.get("status") ?? "")),
    shortDescription: String(formData.get("shortDescription") ?? "").trim(),
    imagePath: String(formData.get("imagePath") ?? "").trim(),
    goodDogLink: String(formData.get("goodDogLink") ?? "").trim()
  };
  const validationError = validateRequestBody(body);

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  if (imageFile) {
    const fileValidationError = validateLocalPuppyImage(imageFile);

    if (fileValidationError) {
      return NextResponse.json({ error: fileValidationError }, { status: 400 });
    }
  }

  const savedImagePath = imageFile
    ? await saveLocalPuppyImage(body.puppyName?.trim() ?? "puppy", imageFile)
    : body.imagePath?.trim() ?? "";

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
    imagePath: savedImagePath,
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
