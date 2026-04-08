import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import type { HealthReport } from "@/types/health";

const dataDirectory = path.join(process.cwd(), "data");
const findingsFilePath = path.join(dataDirectory, "findings.json");

const emptyReport = (): HealthReport => ({
  checkedAt: "",
  baseUrl: "",
  findings: []
});

export async function readHealthReport(): Promise<HealthReport> {
  try {
    const fileContents = await readFile(findingsFilePath, "utf8");
    return JSON.parse(fileContents) as HealthReport;
  } catch {
    return emptyReport();
  }
}

export async function writeHealthReport(report: HealthReport): Promise<void> {
  // A local JSON file keeps Phase 1 easy to inspect before we introduce a database.
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(findingsFilePath, JSON.stringify(report, null, 2), "utf8");
}
