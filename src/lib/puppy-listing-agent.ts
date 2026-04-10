import type {
  PuppyListingAvailability,
  PuppyListingDraft,
  PuppyListingImage
} from "@/types/health";

export interface PuppyListingIntakeInput {
  puppyName: string;
  sex: string;
  age: string;
  litter: string;
  availability: PuppyListingAvailability;
  temperamentNotes: string;
  breederNotes: string;
  priceOrDeposit?: string;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function titleCaseAvailability(availability: PuppyListingAvailability): string {
  if (availability === "sold") {
    return "Sold";
  }

  if (availability === "reserved") {
    return "Reserved";
  }

  return "Available";
}

function buildImageAltText(
  puppyName: string,
  sex: string,
  litter: string,
  availability: PuppyListingAvailability,
  index: number
): string {
  const parts = [
    puppyName,
    sex ? `${sex} puppy` : "puppy",
    litter ? `from the ${litter} litter` : "",
    titleCaseAvailability(availability).toLowerCase(),
    `photo ${index + 1}`
  ].filter(Boolean);

  return parts.join(" ");
}

function buildShortSummary(input: PuppyListingIntakeInput): string {
  const pieces = [
    `${input.puppyName} is a ${input.sex.toLowerCase()} puppy`,
    input.age ? `${input.age} old` : "",
    input.litter ? `from the ${input.litter} litter` : "",
    input.temperamentNotes ? `showing ${input.temperamentNotes.trim()}` : ""
  ].filter(Boolean);

  return `${pieces.join(" ")}.`.replace(/\s+/g, " ").trim();
}

function buildFullDescription(input: PuppyListingIntakeInput): string {
  const firstParagraph = [
    `${input.puppyName} is currently marked ${titleCaseAvailability(input.availability).toLowerCase()}.`,
    input.age ? `${input.sex} puppy, ${input.age} old.` : `${input.sex} puppy.`,
    input.litter ? `Raised as part of the ${input.litter} litter.` : ""
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const temperamentParagraph = input.temperamentNotes.trim()
    ? `Temperament notes: ${input.temperamentNotes.trim()}.`
    : "Temperament notes have not been added yet.";

  const breederParagraph = input.breederNotes.trim()
    ? `Breeder notes: ${input.breederNotes.trim()}.`
    : "Breeder notes have not been added yet.";

  const pricingParagraph = input.priceOrDeposit?.trim()
    ? `Pricing or deposit details: ${input.priceOrDeposit.trim()}.`
    : "";

  return [firstParagraph, temperamentParagraph, breederParagraph, pricingParagraph]
    .filter(Boolean)
    .join("\n\n");
}

export function buildPuppyListingContent(
  input: PuppyListingIntakeInput,
  images: Omit<PuppyListingImage, "altText">[]
): Pick<
  PuppyListingDraft,
  | "puppyName"
  | "sex"
  | "age"
  | "litter"
  | "availability"
  | "temperamentNotes"
  | "breederNotes"
  | "priceOrDeposit"
  | "listingTitle"
  | "shortSummary"
  | "fullDescription"
  | "homepageCardCopy"
  | "suggestedSlug"
  | "images"
> {
  const safeName = input.puppyName.trim() || "puppy";
  const suggestedSlug = slugify(
    `${safeName}-${input.sex}-${input.litter}-${input.availability}`
  );
  const imageRecords: PuppyListingImage[] = images.map((image, index) => ({
    ...image,
    altText: buildImageAltText(
      safeName,
      input.sex,
      input.litter,
      input.availability,
      index
    )
  }));
  const listingTitle = `${safeName} | ${titleCaseAvailability(input.availability)} ${input.sex} Puppy`;
  const shortSummary = buildShortSummary(input);
  const fullDescription = buildFullDescription(input);
  const homepageCardCopy = [
    safeName,
    input.age ? `${input.age} old` : "",
    input.temperamentNotes ? `Temperament: ${input.temperamentNotes.trim()}` : "",
    `Status: ${titleCaseAvailability(input.availability)}`
  ]
    .filter(Boolean)
    .join(" • ");

  return {
    puppyName: safeName,
    sex: input.sex.trim(),
    age: input.age.trim(),
    litter: input.litter.trim(),
    availability: input.availability,
    temperamentNotes: input.temperamentNotes.trim(),
    breederNotes: input.breederNotes.trim(),
    priceOrDeposit: input.priceOrDeposit?.trim(),
    listingTitle,
    shortSummary,
    fullDescription,
    homepageCardCopy,
    suggestedSlug,
    images: imageRecords
  };
}

export function buildPuppyListingDraft(
  input: PuppyListingIntakeInput,
  images: Omit<PuppyListingImage, "altText">[],
  batchId: string
): PuppyListingDraft {
  const now = new Date().toISOString();
  const listingContent = buildPuppyListingContent(input, images);

  return {
    id: `puppy-listing-${listingContent.suggestedSlug || "draft"}-${Date.now()}`,
    batchId,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    ...listingContent
  };
}
