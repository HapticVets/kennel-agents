import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import type {
  PuppyListingRecord,
  PuppyListingStatus,
  PuppyListingsStore
} from "@/types/health";

const dataDirectory = path.join(process.cwd(), "data");
const puppyListingsFilePath = path.join(dataDirectory, "puppy-listings.json");

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

function isNewStoreShape(value: unknown): value is PuppyListingsStore {
  return Boolean(
    value &&
      typeof value === "object" &&
      "listings" in value &&
      Array.isArray((value as PuppyListingsStore).listings)
  );
}

function buildLegacyListingRecord(legacy: Record<string, unknown>): PuppyListingRecord {
  const imagePath =
    Array.isArray(legacy.images) && legacy.images.length > 0
      ? String((legacy.images[0] as { publicUrl?: string })?.publicUrl ?? "")
      : "";

  return {
    id: String(legacy.id),
    puppyName: String(legacy.puppyName ?? ""),
    litterName: String(legacy.litter ?? ""),
    sex: String(legacy.sex ?? ""),
    color: "",
    birthDate: "",
    readyDate: "",
    price: String(legacy.priceOrDeposit ?? ""),
    status: normalizeStatus(String(legacy.availability ?? "available")),
    shortDescription: String(
      legacy.shortSummary ?? legacy.breederNotes ?? legacy.temperamentNotes ?? ""
    ),
    imagePath,
    goodDogLink: "",
    createdAt: String(legacy.createdAt ?? new Date().toISOString()),
    updatedAt: String(legacy.updatedAt ?? legacy.createdAt ?? new Date().toISOString())
  };
}

function migrateLegacyStore(value: unknown): PuppyListingsStore {
  if (isNewStoreShape(value)) {
    return value;
  }

  if (value && typeof value === "object" && "drafts" in value) {
    const legacyValue = value as {
      drafts?: Record<string, unknown>[];
      archivedDrafts?: Record<string, unknown>[];
      generatedAt?: string;
    };

    const listings = [
      ...(legacyValue.drafts ?? []),
      ...(legacyValue.archivedDrafts ?? [])
    ].map(buildLegacyListingRecord);

    return {
      updatedAt: legacyValue.generatedAt ?? new Date().toISOString(),
      listings
    };
  }

  return emptyStore();
}

async function writeStore(store: PuppyListingsStore): Promise<PuppyListingsStore> {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(puppyListingsFilePath, JSON.stringify(store, null, 2), "utf8");
  return store;
}

export async function readLocalPuppyListingsStore(): Promise<PuppyListingsStore> {
  try {
    const fileContents = await readFile(puppyListingsFilePath, "utf8");
    const parsed = JSON.parse(fileContents) as unknown;
    const migrated = migrateLegacyStore(parsed);

    if (JSON.stringify(parsed) !== JSON.stringify(migrated)) {
      await writeStore(migrated);
    }

    return {
      ...migrated,
      listings: [...migrated.listings].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt)
      )
    };
  } catch {
    return emptyStore();
  }
}

export async function createLocalPuppyListing(
  input: Omit<PuppyListingRecord, "id" | "createdAt" | "updatedAt">
): Promise<PuppyListingsStore> {
  const store = await readLocalPuppyListingsStore();
  const now = new Date().toISOString();

  const nextListing: PuppyListingRecord = {
    ...input,
    id: `puppy-${Date.now()}`,
    createdAt: now,
    updatedAt: now
  };

  return writeStore({
    updatedAt: now,
    listings: [nextListing, ...store.listings]
  });
}

export async function deleteLocalPuppyListing(
  itemId: string
): Promise<PuppyListingsStore | null> {
  const store = await readLocalPuppyListingsStore();
  const nextListings = store.listings.filter((listing) => listing.id !== itemId);

  if (nextListings.length === store.listings.length) {
    return null;
  }

  return writeStore({
    updatedAt: new Date().toISOString(),
    listings: nextListings
  });
}
