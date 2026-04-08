import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import { MAX_SCAN_HISTORY } from "@/lib/config";
import type {
  HealthReport,
  HealthReportStore,
  ProposedFixReport
} from "@/types/health";

const dataDirectory = path.join(process.cwd(), "data");
const findingsFilePath = path.join(dataDirectory, "findings.json");
const proposedFixesFilePath = path.join(dataDirectory, "proposed-fixes.json");

const emptyReport = (): HealthReport => ({
  checkedAt: "",
  baseUrl: "",
  findings: []
});

const emptyStore = (): HealthReportStore => ({
  latest: emptyReport(),
  history: []
});

const emptyProposedFixReport = (): ProposedFixReport => ({
  generatedAt: "",
  sourceCheckedAt: "",
  fixes: []
});

function normalizeStore(data: unknown): HealthReportStore {
  // This fallback keeps older single-report JSON files compatible.
  if (
    data &&
    typeof data === "object" &&
    "latest" in data &&
    "history" in data
  ) {
    return data as HealthReportStore;
  }

  if (data && typeof data === "object" && "findings" in data) {
    const report = data as HealthReport;
    return {
      latest: report,
      history: report.checkedAt ? [report] : []
    };
  }

  return emptyStore();
}

export async function readHealthReportStore(): Promise<HealthReportStore> {
  try {
    const fileContents = await readFile(findingsFilePath, "utf8");
    return normalizeStore(JSON.parse(fileContents));
  } catch {
    return emptyStore();
  }
}

export async function appendHealthReport(report: HealthReport): Promise<HealthReportStore> {
  const currentStore = await readHealthReportStore();
  const history = [report, ...currentStore.history].slice(0, MAX_SCAN_HISTORY);
  const nextStore: HealthReportStore = {
    latest: report,
    history
  };

  // A local JSON file keeps Phase 1 easy to inspect before we introduce a database.
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(findingsFilePath, JSON.stringify(nextStore, null, 2), "utf8");
  return nextStore;
}

export async function readProposedFixReport(): Promise<ProposedFixReport> {
  try {
    const fileContents = await readFile(proposedFixesFilePath, "utf8");
    return JSON.parse(fileContents) as ProposedFixReport;
  } catch {
    return emptyProposedFixReport();
  }
}

export async function writeProposedFixReport(
  report: ProposedFixReport
): Promise<ProposedFixReport> {
  // Proposed fixes are persisted separately so Phase 2 stays independent from the scan history file.
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(proposedFixesFilePath, JSON.stringify(report, null, 2), "utf8");
  return report;
}
