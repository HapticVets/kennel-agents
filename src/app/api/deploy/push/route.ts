import { NextResponse } from "next/server";

import { pushDeployChanges } from "@/lib/deploy-agent";

export async function POST() {
  try {
    const report = await pushDeployChanges();
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to push website changes."
      },
      { status: 500 }
    );
  }
}
