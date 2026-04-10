import { mkdir, readFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import type { DatabaseSync } from "node:sqlite";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  getSupabaseConfig,
  isSupabasePuppyStoreConfigured
} from "@/lib/supabase-config";
import type {
  PuppyListingDraft,
  PuppyListingImage,
  PuppyListingReport
} from "@/types/health";

const dataDirectory = path.join(process.cwd(), "data");
const databasePath = path.join(dataDirectory, "kennel.sqlite");
const legacyPuppyListingsPath = path.join(dataDirectory, "puppy-listings.json");

let database: DatabaseSync | null = null;

type PuppyListingRow = {
  id: string;
  batch_id: string;
  status: PuppyListingDraft["status"];
  created_at: string;
  updated_at: string;
  puppy_name: string;
  sex: string;
  age: string;
  litter: string;
  availability: PuppyListingDraft["availability"];
  temperament_notes: string;
  breeder_notes: string;
  price_or_deposit: string | null;
  listing_title: string;
  short_summary: string;
  full_description: string;
  homepage_card_copy: string;
  suggested_slug: string;
};

type PuppyImageRow = {
  id: string;
  listing_id: string | null;
  file_name: string;
  public_url: string;
  alt_text: string;
  created_at?: string;
};

function assertSupabasePuppyStoreConfiguredForProduction(): void {
  if (process.env.NODE_ENV === "production" && !isSupabasePuppyStoreConfigured()) {
    throw new Error(
      "Supabase puppy listing storage is required in production. Configure NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_PUPPY_IMAGE_BUCKET."
    );
  }
}

async function getDatabase(): Promise<DatabaseSync> {
  assertSupabasePuppyStoreConfiguredForProduction();

  if (!database) {
    // The local SQLite fallback is dev-only. Load it lazily so Vercel can run
    // the Supabase-backed puppy workflow without importing node:sqlite.
    const { DatabaseSync } = await import("node:sqlite");

    database = new DatabaseSync(databasePath);
    database.exec(`
      CREATE TABLE IF NOT EXISTS puppy_listing_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS puppy_listings (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        puppy_name TEXT NOT NULL,
        sex TEXT NOT NULL,
        age TEXT NOT NULL,
        litter TEXT NOT NULL,
        availability TEXT NOT NULL,
        temperament_notes TEXT NOT NULL,
        breeder_notes TEXT NOT NULL,
        price_or_deposit TEXT,
        listing_title TEXT NOT NULL,
        short_summary TEXT NOT NULL,
        full_description TEXT NOT NULL,
        homepage_card_copy TEXT NOT NULL,
        suggested_slug TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS puppy_listing_images (
        id TEXT PRIMARY KEY,
        listing_id TEXT,
        file_name TEXT NOT NULL,
        public_url TEXT NOT NULL,
        alt_text TEXT NOT NULL,
        content_type TEXT NOT NULL,
        content_base64 TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }

  return database;
}

async function readMetaValue(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = db
    .prepare("SELECT value FROM puppy_listing_meta WHERE key = ? LIMIT 1")
    .get(key) as { value?: string } | undefined;

  return row?.value ?? null;
}

async function writeMetaValue(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  db.prepare(`
    INSERT INTO puppy_listing_meta (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
}

export async function ensurePuppyListingDatabase(): Promise<void> {
  assertSupabasePuppyStoreConfiguredForProduction();

  if (process.env.NODE_ENV === "production" && isSupabasePuppyStoreConfigured()) {
    return;
  }

  await mkdir(dataDirectory, { recursive: true });
  await getDatabase();
}

function mapListingRow(row: Record<string, unknown>, images: PuppyListingImage[]): PuppyListingDraft {
  return {
    id: String(row.id),
    batchId: String(row.batch_id),
    status: row.status as PuppyListingDraft["status"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    puppyName: String(row.puppy_name),
    sex: String(row.sex),
    age: String(row.age),
    litter: String(row.litter),
    availability: row.availability as PuppyListingDraft["availability"],
    temperamentNotes: String(row.temperament_notes),
    breederNotes: String(row.breeder_notes),
    priceOrDeposit: row.price_or_deposit ? String(row.price_or_deposit) : undefined,
    listingTitle: String(row.listing_title),
    shortSummary: String(row.short_summary),
    fullDescription: String(row.full_description),
    homepageCardCopy: String(row.homepage_card_copy),
    suggestedSlug: String(row.suggested_slug),
    images
  };
}

function mapListingToRow(listing: PuppyListingDraft): PuppyListingRow {
  return {
    id: listing.id,
    batch_id: listing.batchId,
    status: listing.status,
    created_at: listing.createdAt,
    updated_at: listing.updatedAt,
    puppy_name: listing.puppyName,
    sex: listing.sex,
    age: listing.age,
    litter: listing.litter,
    availability: listing.availability,
    temperament_notes: listing.temperamentNotes,
    breeder_notes: listing.breederNotes,
    price_or_deposit: listing.priceOrDeposit ?? null,
    listing_title: listing.listingTitle,
    short_summary: listing.shortSummary,
    full_description: listing.fullDescription,
    homepage_card_copy: listing.homepageCardCopy,
    suggested_slug: listing.suggestedSlug
  };
}

function buildReportFromListings(listings: PuppyListingDraft[]): PuppyListingReport {
  return {
    generatedAt: new Date().toISOString(),
    activeBatchId: listings[0]?.batchId ?? "",
    drafts: listings.filter((listing) => listing.status !== "archived"),
    consumedDrafts: [],
    archivedDrafts: listings.filter((listing) => listing.status === "archived")
  };
}

async function readPuppyListingReportFromSupabase(): Promise<PuppyListingReport> {
  const supabase = createSupabaseAdminClient();
  const [{ data: listingRows, error: listingError }, { data: imageRows, error: imageError }] =
    await Promise.all([
      supabase
        .from("puppy_listings")
        .select("*")
        .order("updated_at", { ascending: false }),
      supabase
        .from("puppy_listing_images")
        .select("id, listing_id, file_name, public_url, alt_text, created_at")
        .order("created_at", { ascending: true })
    ]);

  if (listingError) {
    throw listingError;
  }

  if (imageError) {
    throw imageError;
  }

  const imagesByListingId = new Map<string, PuppyListingImage[]>();

  for (const row of (imageRows ?? []) as PuppyImageRow[]) {
    if (!row.listing_id) {
      continue;
    }

    const current = imagesByListingId.get(row.listing_id) ?? [];
    current.push({
      id: row.id,
      fileName: row.file_name,
      publicUrl: row.public_url,
      altText: row.alt_text
    });
    imagesByListingId.set(row.listing_id, current);
  }

  const listings = ((listingRows ?? []) as PuppyListingRow[]).map((row) =>
    mapListingRow(row as unknown as Record<string, unknown>, imagesByListingId.get(row.id) ?? [])
  );

  if (listings.length === 0) {
    const legacyImportComplete = await readSupabaseMetaValue("legacy_import_complete");

    if (legacyImportComplete !== "true") {
      const migrated = await migrateLegacyPuppyListingsIfNeeded();

      if (migrated) {
        return readPuppyListingReportFromSupabase();
      }
    }
  }

  return buildReportFromListings(listings);
}

async function readSupabaseMetaValue(key: string): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("puppy_listing_meta")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return typeof data?.value === "string" ? data.value : null;
}

async function writeSupabaseMetaValue(key: string, value: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("puppy_listing_meta")
    .upsert({ key, value }, { onConflict: "key" });

  if (error) {
    throw error;
  }
}

async function writePuppyListingReportToSupabase(
  report: PuppyListingReport
): Promise<PuppyListingReport> {
  const supabase = createSupabaseAdminClient();
  const listings = [...report.drafts, ...report.archivedDrafts];
  const listingIds = listings.map((listing) => listing.id);
  const { data: existingRows, error: existingError } = await supabase
    .from("puppy_listings")
    .select("id");

  if (existingError) {
    throw existingError;
  }

  const staleIds = (existingRows ?? [])
    .map((row) => String(row.id))
    .filter((id) => !listingIds.includes(id));

  if (staleIds.length > 0) {
    const { error } = await supabase.from("puppy_listings").delete().in("id", staleIds);

    if (error) {
      throw error;
    }
  }

  if (listings.length > 0) {
    const { error } = await supabase
      .from("puppy_listings")
      .upsert(listings.map(mapListingToRow), { onConflict: "id" });

    if (error) {
      throw error;
    }
  }

  for (const listing of listings) {
    const imageRows: PuppyImageRow[] = listing.images.map((image) => ({
      id: image.id,
      listing_id: listing.id,
      file_name: image.fileName,
      public_url: image.publicUrl,
      alt_text: image.altText
    }));

    const { error: clearError } = await supabase
      .from("puppy_listing_images")
      .update({ listing_id: null })
      .eq("listing_id", listing.id);

    if (clearError) {
      throw clearError;
    }

    if (imageRows.length > 0) {
      const { error: imageError } = await supabase
        .from("puppy_listing_images")
        .upsert(imageRows, { onConflict: "id" });

      if (imageError) {
        throw imageError;
      }
    }
  }

  await writeSupabaseMetaValue("legacy_import_complete", "true");
  return readPuppyListingReportFromSupabase();
}

export async function readPuppyListingReportFromDatabase(): Promise<PuppyListingReport> {
  if (isSupabasePuppyStoreConfigured()) {
    return readPuppyListingReportFromSupabase();
  }

  await ensurePuppyListingDatabase();
  const db = await getDatabase();
  const listingRows = db
    .prepare("SELECT * FROM puppy_listings ORDER BY datetime(updated_at) DESC")
    .all() as Record<string, unknown>[];
  const imageRows = db
    .prepare(
      "SELECT id, listing_id, file_name, public_url, alt_text FROM puppy_listing_images ORDER BY datetime(created_at) ASC"
    )
    .all() as Record<string, unknown>[];

  const imagesByListingId = new Map<string, PuppyListingImage[]>();

  for (const row of imageRows) {
    const listingId = row.listing_id ? String(row.listing_id) : "";

    if (!listingId) {
      continue;
    }

    const current = imagesByListingId.get(listingId) ?? [];
    current.push({
      id: String(row.id),
      fileName: String(row.file_name),
      publicUrl: String(row.public_url),
      altText: String(row.alt_text)
    });
    imagesByListingId.set(listingId, current);
  }

  const listings = listingRows.map((row) =>
    mapListingRow(row, imagesByListingId.get(String(row.id)) ?? [])
  );

  const legacyImportComplete = (await readMetaValue("legacy_import_complete")) === "true";

  if (listings.length === 0 && !legacyImportComplete) {
    const migrated = await migrateLegacyPuppyListingsIfNeeded();

    if (migrated) {
      return readPuppyListingReportFromDatabase();
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    activeBatchId: listings[0]?.batchId ?? "",
    drafts: listings.filter((listing) => listing.status !== "archived"),
    consumedDrafts: [],
    archivedDrafts: listings.filter((listing) => listing.status === "archived")
  };
}

export async function writePuppyListingReportToDatabase(
  report: PuppyListingReport
): Promise<PuppyListingReport> {
  if (isSupabasePuppyStoreConfigured()) {
    return writePuppyListingReportToSupabase(report);
  }

  await ensurePuppyListingDatabase();
  const db = await getDatabase();
  const listings = [...report.drafts, ...report.archivedDrafts];
  const listingIds = listings.map((listing) => listing.id);

  const upsertListing = db.prepare(`
    INSERT INTO puppy_listings (
      id, batch_id, status, created_at, updated_at, puppy_name, sex, age, litter, availability,
      temperament_notes, breeder_notes, price_or_deposit, listing_title, short_summary,
      full_description, homepage_card_copy, suggested_slug
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      batch_id = excluded.batch_id,
      status = excluded.status,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      puppy_name = excluded.puppy_name,
      sex = excluded.sex,
      age = excluded.age,
      litter = excluded.litter,
      availability = excluded.availability,
      temperament_notes = excluded.temperament_notes,
      breeder_notes = excluded.breeder_notes,
      price_or_deposit = excluded.price_or_deposit,
      listing_title = excluded.listing_title,
      short_summary = excluded.short_summary,
      full_description = excluded.full_description,
      homepage_card_copy = excluded.homepage_card_copy,
      suggested_slug = excluded.suggested_slug
  `);
  const clearListingImages = db.prepare(
    "UPDATE puppy_listing_images SET listing_id = NULL WHERE listing_id = ?"
  );
  const upsertImage = db.prepare(`
    UPDATE puppy_listing_images
    SET listing_id = ?, file_name = ?, public_url = ?, alt_text = ?
    WHERE id = ?
  `);

  db.exec("BEGIN");

  try {
    if (listingIds.length > 0) {
      db.prepare(
        `DELETE FROM puppy_listings WHERE id NOT IN (${listingIds.map(() => "?").join(",")})`
      ).run(...listingIds);
    } else {
      db.exec("DELETE FROM puppy_listings");
    }

    for (const listing of listings) {
      upsertListing.run(
        listing.id,
        listing.batchId,
        listing.status,
        listing.createdAt,
        listing.updatedAt,
        listing.puppyName,
        listing.sex,
        listing.age,
        listing.litter,
        listing.availability,
        listing.temperamentNotes,
        listing.breederNotes,
        listing.priceOrDeposit ?? null,
        listing.listingTitle,
        listing.shortSummary,
        listing.fullDescription,
        listing.homepageCardCopy,
        listing.suggestedSlug
      );

      clearListingImages.run(listing.id);

      for (const image of listing.images) {
        upsertImage.run(
          listing.id,
          image.fileName,
          image.publicUrl,
          image.altText,
          image.id
        );
      }
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  await writeMetaValue("legacy_import_complete", "true");

  return readPuppyListingReportFromDatabase();
}

function sanitizeFileSegment(value: string): string {
  return value
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

export async function storeUploadedPuppyImages(
  puppyName: string,
  files: File[]
): Promise<Omit<PuppyListingImage, "altText">[]> {
  if (isSupabasePuppyStoreConfigured()) {
    const supabase = createSupabaseAdminClient();
    const config = getSupabaseConfig();
    const savedImages: Omit<PuppyListingImage, "altText">[] = [];

    for (const file of files) {
      if (!file.name || file.size === 0) {
        continue;
      }

      const extension = path.extname(file.name) || ".jpg";
      const fileName = `${sanitizeFileSegment(puppyName || "puppy")}-${Date.now()}-${randomUUID().slice(0, 8)}${extension}`;
      const imageId = randomUUID();
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

      const { data } = supabase.storage
        .from(config.puppyImageBucket)
        .getPublicUrl(objectPath);

      savedImages.push({
        id: imageId,
        fileName: objectPath,
        publicUrl: data.publicUrl
      });
    }

    return savedImages;
  }

  await ensurePuppyListingDatabase();
  const db = await getDatabase();
  const insertImage = db.prepare(`
    INSERT INTO puppy_listing_images (
      id, listing_id, file_name, public_url, alt_text, content_type, content_base64, created_at
    ) VALUES (?, NULL, ?, ?, '', ?, ?, ?)
  `);

  const savedImages: Omit<PuppyListingImage, "altText">[] = [];

  for (const file of files) {
    if (!file.name || file.size === 0) {
      continue;
    }

    const extension = path.extname(file.name) || ".jpg";
    const fileName = `${sanitizeFileSegment(puppyName || "puppy")}-${Date.now()}-${randomUUID().slice(0, 8)}${extension}`;
    const imageId = randomUUID();
    const contentBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const publicUrl = `/api/puppy-images/${imageId}`;

    insertImage.run(
      imageId,
      fileName,
      publicUrl,
      file.type || "image/jpeg",
      contentBase64,
      new Date().toISOString()
    );

    savedImages.push({
      id: imageId,
      fileName,
      publicUrl
    });
  }

  return savedImages;
}

export async function readPuppyImageRecord(imageId: string): Promise<{
  contentType: string;
  buffer: Buffer;
} | null> {
  if (isSupabasePuppyStoreConfigured()) {
    // Supabase-hosted images are served from public storage URLs, not this local fallback route.
    return null;
  }

  await ensurePuppyListingDatabase();
  const db = await getDatabase();
  const row = db
    .prepare(
      "SELECT content_type, content_base64 FROM puppy_listing_images WHERE id = ? LIMIT 1"
    )
    .get(imageId) as { content_type?: string; content_base64?: string } | undefined;

  if (!row?.content_base64) {
    return null;
  }

  return {
    contentType: row.content_type || "image/jpeg",
    buffer: Buffer.from(row.content_base64, "base64")
  };
}

async function migrateLegacyPuppyListingsIfNeeded(): Promise<boolean> {
  try {
    const fileContents = await readFile(legacyPuppyListingsPath, "utf8");
    const legacyReport = JSON.parse(fileContents) as PuppyListingReport;
    const hasLegacyListings =
      (legacyReport.drafts?.length ?? 0) > 0 || (legacyReport.archivedDrafts?.length ?? 0) > 0;

    if (!hasLegacyListings) {
      return false;
    }

    await writePuppyListingReportToDatabase({
      generatedAt: legacyReport.generatedAt || new Date().toISOString(),
      activeBatchId: legacyReport.activeBatchId || "",
      drafts: legacyReport.drafts ?? [],
      consumedDrafts: [],
      archivedDrafts: legacyReport.archivedDrafts ?? []
    });

    if (isSupabasePuppyStoreConfigured()) {
      await writeSupabaseMetaValue("legacy_import_complete", "true");
    } else {
      await writeMetaValue("legacy_import_complete", "true");
    }

    if (process.env.KENNEL_HEALTH_DEBUG === "true") {
      console.log("[PuppyListingMigration]", {
        migratedDraftIds: [
          ...(legacyReport.drafts ?? []).map((draft) => draft.id),
          ...(legacyReport.archivedDrafts ?? []).map((draft) => draft.id)
        ],
        source: legacyPuppyListingsPath,
        target: databasePath
      });
    }

    return true;
  } catch {
    return false;
  }
}
