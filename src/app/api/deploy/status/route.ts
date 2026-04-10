import { NextResponse } from "next/server";

import { buildDeployStatusReport } from "@/lib/deploy-agent";

export async function GET() {
  try {
    const report = await buildDeployStatusReport();
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load deploy status."
      },
      { status: 500 }
    );
  }
}
