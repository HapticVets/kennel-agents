import { NextResponse } from "next/server";

import { readLocalPuppyListingsStore } from "@/lib/local-puppy-listings";

function toAbsoluteImageUrl(request: Request, imagePath: string): string {
  if (!imagePath) {
    return "";
  }

  if (/^https?:\/\//i.test(imagePath)) {
    return imagePath;
  }

  return new URL(imagePath, request.url).toString();
}

export async function GET(request: Request) {
  const store = await readLocalPuppyListingsStore();

  return NextResponse.json({
    updatedAt: store.updatedAt,
    listings: store.listings.map((listing) => ({
      id: listing.id,
      puppyName: listing.puppyName,
      litterName: listing.litterName,
      sex: listing.sex,
      color: listing.color,
      birthDate: listing.birthDate,
      readyDate: listing.readyDate,
      price: listing.price,
      status: listing.status,
      shortDescription: listing.shortDescription,
      goodDogLink: listing.goodDogLink,
      imagePath: listing.imagePath,
      imageUrl: toAbsoluteImageUrl(request, listing.imagePath),
      updatedAt: listing.updatedAt
    }))
  });
}
