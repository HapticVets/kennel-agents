import { NextResponse } from "next/server";

import { commitDeployChanges } from "@/lib/deploy-agent";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    message?: string;
  };

  try {
    const report = await commitDeployChanges(body.message);
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to commit website changes."
      },
      { status: 500 }
    );
  }
}
