import { NextResponse } from "next/server";

import {
  buildVerificationReport,
  runVerificationAgent
} from "@/lib/verification-agent";

export async function GET() {
  const report = await buildVerificationReport();
  return NextResponse.json(report);
}

export async function POST() {
  // A verification run compares the last saved findings against a fresh health scan.
  const report = await runVerificationAgent();
  return NextResponse.json(report);
}
