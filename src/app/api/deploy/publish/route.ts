import { NextResponse } from "next/server";

import { publishToLiveSite } from "@/lib/deploy-agent";

export async function POST() {
  try {
    const report = await publishToLiveSite();
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to publish website changes."
      },
      { status: 500 }
    );
  }
}
