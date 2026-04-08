import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import { MAX_SCAN_HISTORY } from "@/lib/config";
import type {
  ContentDraftReport,
  ConversionInsightReport,
  HealthReport,
  HealthReportStore,
  ProposedFixReport
} from "@/types/health";

const dataDirectory = path.join(process.cwd(), "data");
const findingsFilePath = path.join(dataDirectory, "findings.json");
const proposedFixesFilePath = path.join(dataDirectory, "proposed-fixes.json");
const contentDraftsFilePath = path.join(dataDirectory, "content-drafts.json");
const conversionInsightsFilePath = path.join(dataDirectory, "conversion-insights.json");

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

const emptyContentDraftReport = (): ContentDraftReport => ({
  generatedAt: "",
  drafts: []
});

const emptyConversionInsightReport = (): ConversionInsightReport => ({
  generatedAt: "",
  insights: []
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

export async function readContentDraftReport(): Promise<ContentDraftReport> {
  try {
    const fileContents = await readFile(contentDraftsFilePath, "utf8");
    return JSON.parse(fileContents) as ContentDraftReport;
  } catch {
    return emptyContentDraftReport();
  }
}

export async function writeContentDraftReport(
  report: ContentDraftReport
): Promise<ContentDraftReport> {
  // Content drafts stay file-backed so the phase remains simple and easy to inspect.
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(contentDraftsFilePath, JSON.stringify(report, null, 2), "utf8");
  return report;
}

export async function readConversionInsightReport(): Promise<ConversionInsightReport> {
  try {
    const fileContents = await readFile(conversionInsightsFilePath, "utf8");
    return JSON.parse(fileContents) as ConversionInsightReport;
  } catch {
    return emptyConversionInsightReport();
  }
}

export async function writeConversionInsightReport(
  report: ConversionInsightReport
): Promise<ConversionInsightReport> {
  // Conversion insights stay local and review-only in Phase 4.
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(conversionInsightsFilePath, JSON.stringify(report, null, 2), "utf8");
  return report;
}
