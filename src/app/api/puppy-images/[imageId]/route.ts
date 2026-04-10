import { NextResponse } from "next/server";

import { readPuppyImageRecord } from "@/lib/puppy-listing-store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ imageId: string }> }
) {
  const { imageId } = await context.params;
  const record = await readPuppyImageRecord(imageId);

  if (!record) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(record.buffer), {
    status: 200,
    headers: {
      "content-type": record.contentType,
      "cache-control": "public, max-age=3600"
    }
  });
}
