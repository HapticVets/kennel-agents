import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import { MAX_SCAN_HISTORY } from "@/lib/config";
import type {
  ApplyResult,
  ApprovalState,
  ContentDraftReport,
  ConversionInsightReport,
  HealthReport,
  HealthReportStore,
  MergeResult,
  ProposedFixReport
  ,
  VerificationReport
} from "@/types/health";

const dataDirectory = path.join(process.cwd(), "data");
const findingsFilePath = path.join(dataDirectory, "findings.json");
const proposedFixesFilePath = path.join(dataDirectory, "proposed-fixes.json");
const contentDraftsFilePath = path.join(dataDirectory, "content-drafts.json");
const conversionInsightsFilePath = path.join(dataDirectory, "conversion-insights.json");
const approvalsFilePath = path.join(dataDirectory, "approvals.json");
const applyResultsFilePath = path.join(dataDirectory, "apply-results.json");
const mergeResultsFilePath = path.join(dataDirectory, "merge-results.json");
const verificationFilePath = path.join(dataDirectory, "verification.json");

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

const emptyApprovalStates = (): ApprovalState[] => [];
const emptyApplyResults = (): ApplyResult[] => [];
const emptyMergeResults = (): MergeResult[] => [];
const emptyVerificationReport = (): VerificationReport => ({
  generatedAt: "",
  records: []
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

export async function readApprovalStates(): Promise<ApprovalState[]> {
  try {
    const fileContents = await readFile(approvalsFilePath, "utf8");
    return JSON.parse(fileContents) as ApprovalState[];
  } catch {
    return emptyApprovalStates();
  }
}

export async function writeApprovalStates(
  states: ApprovalState[]
): Promise<ApprovalState[]> {
  // Approval state is kept separate so review decisions do not mutate source draft files.
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(approvalsFilePath, JSON.stringify(states, null, 2), "utf8");
  return states;
}

export async function readApplyResults(): Promise<ApplyResult[]> {
  try {
    const fileContents = await readFile(applyResultsFilePath, "utf8");
    return JSON.parse(fileContents) as ApplyResult[];
  } catch {
    return emptyApplyResults();
  }
}

export async function writeApplyResults(
  results: ApplyResult[]
): Promise<ApplyResult[]> {
  // Apply results are tracked separately so staging actions remain auditable and reversible by hand.
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(applyResultsFilePath, JSON.stringify(results, null, 2), "utf8");
  return results;
}

export async function readMergeResults(): Promise<MergeResult[]> {
  try {
    const fileContents = await readFile(mergeResultsFilePath, "utf8");
    return JSON.parse(fileContents) as MergeResult[];
  } catch {
    return emptyMergeResults();
  }
}

export async function writeMergeResults(
  results: MergeResult[]
): Promise<MergeResult[]> {
  // Merge results are stored separately so preview/apply decisions remain auditable.
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(mergeResultsFilePath, JSON.stringify(results, null, 2), "utf8");
  return results;
}

export async function readVerificationReport(): Promise<VerificationReport> {
  try {
    const fileContents = await readFile(verificationFilePath, "utf8");
    return JSON.parse(fileContents) as VerificationReport;
  } catch {
    return emptyVerificationReport();
  }
}

export async function writeVerificationReport(
  report: VerificationReport
): Promise<VerificationReport> {
  // Verification records are stored separately so repeated checks preserve their own lifecycle history.
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(verificationFilePath, JSON.stringify(report, null, 2), "utf8");
  return report;
}
