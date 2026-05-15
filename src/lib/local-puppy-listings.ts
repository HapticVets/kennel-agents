import path from "path";
import { randomUUID } from "crypto";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getSupabaseConfig, isSupabasePuppyStoreConfigured } from "@/lib/supabase-config";
import type {
  PuppyListingRecord,
  PuppyListingStatus,
  PuppyListingsStore
} from "@/types/health";

const supportedImageTypes = new Map<string, string>([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"]
]);

const metadataStartMarker = "[KENNEL_AGENT_SIMPLE_FIELDS]";
const metadataEndMarker = "[/KENNEL_AGENT_SIMPLE_FIELDS]";

type PuppyListingRow = {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  puppy_name: string;
  sex: string;
  age: string;
  litter: string;
  availability: string;
  temperament_notes: string;
  breeder_notes: string;
  price_or_deposit: string | null;
  short_summary: string;
  full_description: string;
};

type PuppyListingImageRow = {
  id: string;
  listing_id: string | null;
  file_name: string;
  public_url: string;
  alt_text: string;
  created_at?: string;
};

type SimplePuppyListingInput = Omit<PuppyListingRecord, "id" | "createdAt" | "updatedAt">;

type SimpleListingMetadata = {
  color: string;
  birthDate: string;
  readyDate: string;
  goodDogLink: string;
};

function assertSupabaseConfigured(): void {
  if (!isSupabasePuppyStoreConfigured()) {
    throw new Error(
      "Supabase puppy listing storage is not configured. Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_PUPPY_IMAGE_BUCKET."
    );
  }
}

function emptyStore(): PuppyListingsStore {
  return {
    updatedAt: "",
    listings: []
  };
}

function normalizeStatus(value: string): PuppyListingStatus {
  if (value === "reserved" || value === "sold") {
    return value;
  }

  return "available";
}

function sanitizeFileNameSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "puppy";
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function titleCaseStatus(status: PuppyListingStatus): string {
  if (status === "reserved") {
    return "Reserved";
  }

  if (status === "sold") {
    return "Sold";
  }

  return "Available";
}

function buildMetadata(input: SimplePuppyListingInput): SimpleListingMetadata {
  return {
    color: input.color.trim(),
    birthDate: input.birthDate.trim(),
    readyDate: input.readyDate.trim(),
    goodDogLink: input.goodDogLink?.trim() ?? ""
  };
}

function buildMetadataBlock(metadata: SimpleListingMetadata): string {
  const rows = Object.entries(metadata)
    .filter(([, value]) => value.trim())
    .map(([key, value]) => `${key}=${value.trim()}`);

  if (rows.length === 0) {
    return "";
  }

  return `${metadataStartMarker}\n${rows.join("\n")}\n${metadataEndMarker}`;
}

function parseMetadataBlock(value: string): SimpleListingMetadata {
  const metadata: SimpleListingMetadata = {
    color: "",
    birthDate: "",
    readyDate: "",
    goodDogLink: ""
  };
  const startIndex = value.indexOf(metadataStartMarker);
  const endIndex = value.indexOf(metadataEndMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return metadata;
  }

  const inner = value
    .slice(startIndex + metadataStartMarker.length, endIndex)
    .trim()
    .split(/\r?\n/);

  for (const row of inner) {
    const separatorIndex = row.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = row.slice(0, separatorIndex).trim();
    const itemValue = row.slice(separatorIndex + 1).trim();

    if (key === "color") {
      metadata.color = itemValue;
    } else if (key === "birthDate") {
      metadata.birthDate = itemValue;
    } else if (key === "readyDate") {
      metadata.readyDate = itemValue;
    } else if (key === "goodDogLink") {
      metadata.goodDogLink = itemValue;
    }
  }

  return metadata;
}

function stripMetadataBlock(value: string): string {
  const metadataPattern = new RegExp(
    `\\n?${metadataStartMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${metadataEndMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n?`,
    "g"
  );

  return value.replace(metadataPattern, "").trim();
}

function buildAgeSummary(birthDate: string, readyDate: string): string {
  const parts = [
    birthDate ? `Born ${birthDate}` : "",
    readyDate ? `Ready ${readyDate}` : ""
  ].filter(Boolean);

  return parts.join(" | ");
}

function buildFullDescription(
  shortDescription: string,
  metadata: SimpleListingMetadata,
  status: PuppyListingStatus
): string {
  const detailLines = [
    metadata.color ? `Color: ${metadata.color}` : "",
    metadata.birthDate ? `Birth date: ${metadata.birthDate}` : "",
    metadata.readyDate ? `Ready date: ${metadata.readyDate}` : "",
    `Status: ${titleCaseStatus(status)}`,
    metadata.goodDogLink ? `GoodDog: ${metadata.goodDogLink}` : ""
  ].filter(Boolean);

  return [shortDescription.trim(), detailLines.join("\n")].filter(Boolean).join("\n\n");
}

function buildHomepageCardCopy(input: SimplePuppyListingInput): string {
  const parts = [
    input.puppyName.trim(),
    input.sex.trim(),
    input.color.trim() ? `Color: ${input.color.trim()}` : "",
    `Status: ${titleCaseStatus(input.status)}`,
    input.price.trim() ? `Price: ${input.price.trim()}` : ""
  ].filter(Boolean);

  return parts.join(" | ");
}

function mapSupabaseRowToRecord(
  row: PuppyListingRow,
  imageRows: PuppyListingImageRow[]
): PuppyListingRecord {
  const metadata = parseMetadataBlock(row.breeder_notes ?? "");
  const primaryImage = imageRows[0];

  return {
    id: row.id,
    puppyName: row.puppy_name,
    litterName: row.litter,
    sex: row.sex,
    color: metadata.color,
    birthDate: metadata.birthDate,
    readyDate: metadata.readyDate,
    price: row.price_or_deposit ?? "",
    status: normalizeStatus(row.availability),
    shortDescription: row.short_summary || stripMetadataBlock(row.full_description ?? ""),
    imagePath: primaryImage?.public_url ?? "",
    goodDogLink: metadata.goodDogLink,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function buildSupabaseInsertPayload(
  input: SimplePuppyListingInput,
  imagePath: string
): {
  listing: Record<string, string | null>;
  image:
    | {
        id: string;
        file_name: string;
        public_url: string;
        alt_text: string;
      }
    | null;
} {
  const metadata = buildMetadata(input);
  const metadataBlock = buildMetadataBlock(metadata);
  const now = new Date().toISOString();
  const listingId = `puppy-listing-${slugify(`${input.puppyName}-${input.litterName}`)}-${Date.now()}`;
  const objectPath = imagePath.startsWith("http") ? imagePath : "";
  const imageFileName = imagePath.startsWith("http")
    ? new URL(imagePath).pathname.split("/").slice(-2).join("/")
    : path.basename(imagePath);

  return {
    listing: {
      id: listingId,
      batch_id: `simple-admin-${now.slice(0, 10)}`,
      // Write a public-ready lifecycle state so the website's Supabase reader can use it directly.
      status: "live_on_site",
      created_at: now,
      updated_at: now,
      puppy_name: input.puppyName.trim(),
      sex: input.sex.trim(),
      age: buildAgeSummary(metadata.birthDate, metadata.readyDate),
      litter: input.litterName.trim(),
      availability: normalizeStatus(input.status),
      temperament_notes: input.shortDescription.trim(),
      breeder_notes: metadataBlock || null,
      price_or_deposit: input.price.trim() || null,
      listing_title: `${input.puppyName.trim()} | ${titleCaseStatus(input.status)} ${input.sex.trim()} Puppy`,
      short_summary: input.shortDescription.trim(),
      full_description: buildFullDescription(input.shortDescription, metadata, input.status),
      homepage_card_copy: buildHomepageCardCopy(input),
      suggested_slug: slugify(`${input.puppyName}-${input.litterName}-${input.status}`)
    },
    image: imagePath
      ? {
          id: randomUUID(),
          file_name: objectPath || imageFileName,
          public_url: imagePath,
          alt_text: `${input.puppyName.trim()} puppy photo`
        }
      : null
  };
}

export function validateLocalPuppyImage(file: File): string | null {
  if (!supportedImageTypes.has(file.type)) {
    return "Unsupported image type. Use jpg, jpeg, png, or webp.";
  }

  return null;
}

export async function saveLocalPuppyImage(
  puppyName: string,
  file: File
): Promise<string> {
  const validationError = validateLocalPuppyImage(file);

  if (validationError) {
    throw new Error(validationError);
  }

  assertSupabaseConfigured();

  const supabase = createSupabaseAdminClient();
  const config = getSupabaseConfig();
  const extension = supportedImageTypes.get(file.type) ?? ".jpg";
  const imageId = randomUUID();
  const fileName = `${sanitizeFileNameSegment(puppyName)}-${Date.now()}${extension}`;
  const objectPath = `${imageId}/${fileName}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage
    .from(config.puppyImageBucket)
    .upload(objectPath, buffer, {
      contentType: file.type || "image/jpeg",
      upsert: false
    });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(config.puppyImageBucket).getPublicUrl(objectPath);
  return data.publicUrl;
}

export async function readLocalPuppyListingsStore(): Promise<PuppyListingsStore> {
  assertSupabaseConfigured();

  const supabase = createSupabaseAdminClient();
  const [{ data: listingRows, error: listingError }, { data: imageRows, error: imageError }] =
    await Promise.all([
      supabase.from("puppy_listings").select(
        "id, status, created_at, updated_at, puppy_name, sex, age, litter, availability, temperament_notes, breeder_notes, price_or_deposit, short_summary, full_description"
      ).order("updated_at", { ascending: false }),
      supabase.from("puppy_listing_images").select(
        "id, listing_id, file_name, public_url, alt_text, created_at"
      ).order("created_at", { ascending: true })
    ]);

  if (listingError) {
    throw listingError;
  }

  if (imageError) {
    throw imageError;
  }

  const imagesByListingId = new Map<string, PuppyListingImageRow[]>();

  for (const row of (imageRows ?? []) as PuppyListingImageRow[]) {
    if (!row.listing_id) {
      continue;
    }

    const current = imagesByListingId.get(row.listing_id) ?? [];
    current.push(row);
    imagesByListingId.set(row.listing_id, current);
  }

  const listings = ((listingRows ?? []) as PuppyListingRow[])
    .filter((row) => row.status !== "archived")
    .map((row) => mapSupabaseRowToRecord(row, imagesByListingId.get(row.id) ?? []));

  return {
    updatedAt: listings[0]?.updatedAt ?? "",
    listings
  };
}

export async function createLocalPuppyListing(
  input: SimplePuppyListingInput
): Promise<PuppyListingsStore> {
  assertSupabaseConfigured();

  const supabase = createSupabaseAdminClient();
  const { listing, image } = buildSupabaseInsertPayload(input, input.imagePath);
  const { error: listingError } = await supabase.from("puppy_listings").insert(listing);

  if (listingError) {
    throw listingError;
  }

  if (image) {
    const { error: imageError } = await supabase.from("puppy_listing_images").insert({
      ...image,
      listing_id: listing.id
    });

    if (imageError) {
      // Keep the listing row, but surface the image write issue so we don't silently hide it.
      throw imageError;
    }
  }

  return readLocalPuppyListingsStore();
}

export async function deleteLocalPuppyListing(
  itemId: string
): Promise<PuppyListingsStore | null> {
  assertSupabaseConfigured();

  const supabase = createSupabaseAdminClient();
  const { data: imageRows, error: imageReadError } = await supabase
    .from("puppy_listing_images")
    .select("id, file_name, listing_id")
    .eq("listing_id", itemId);

  if (imageReadError) {
    throw imageReadError;
  }

  const linkedImages = (imageRows ?? []) as Array<{
    id: string;
    file_name: string;
    listing_id: string | null;
  }>;

  if (linkedImages.length > 0) {
    const { error: imageDeleteError } = await supabase
      .from("puppy_listing_images")
      .delete()
      .eq("listing_id", itemId);

    if (imageDeleteError) {
      throw imageDeleteError;
    }

    const storageObjectPaths = linkedImages
      .map((row) => row.file_name)
      .filter((value) => value.includes("/"));

    if (storageObjectPaths.length > 0) {
      const { error: storageDeleteError } = await supabase.storage
        .from(getSupabaseConfig().puppyImageBucket)
        .remove(storageObjectPaths);

      if (storageDeleteError && process.env.KENNEL_HEALTH_DEBUG === "true") {
        console.log("[PuppyListings] Storage cleanup skipped", {
          itemId,
          storageObjectPaths,
          error: storageDeleteError.message
        });
      }
    }
  }

  const { error: listingDeleteError, count } = await supabase
    .from("puppy_listings")
    .delete({ count: "exact" })
    .eq("id", itemId);

  if (listingDeleteError) {
    throw listingDeleteError;
  }

  if (!count) {
    return null;
  }

  return readLocalPuppyListingsStore();
}

export { emptyStore };
