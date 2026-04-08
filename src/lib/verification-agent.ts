import { runKennelHealthAgent } from "@/lib/health-agent";
import {
  readApprovalStates,
  readApplyResults,
  readHealthReportStore,
  readMergeResults,
  readProposedFixReport,
  readVerificationReport,
  writeVerificationReport
} from "@/lib/storage";
import type {
  ApprovalState,
  ApplyResult,
  HealthFinding,
  MergeResult,
  ProposedFix,
  VerificationHistoryEntry,
  VerificationRecord,
  VerificationReport,
  VerificationStatus
} from "@/types/health";

function getBaseLifecycleStatus(
  finding: HealthFinding,
  fixes: ProposedFix[],
  approvals: ApprovalState[],
  applyResults: ApplyResult[],
  mergeResults: MergeResult[]
): VerificationStatus {
  const relatedFix = fixes.find((fix) => fix.sourceFindingId === finding.id);

  if (!relatedFix) {
    return "open";
  }

  const merged = mergeResults.find(
    (result) => result.itemId === relatedFix.id && result.sourceType === "proposed_fix" && result.status === "applied"
  );
  if (merged) {
    return "merged";
  }

  const applied = applyResults.find(
    (result) => result.itemId === relatedFix.id && result.sourceType === "proposed_fix" && result.status === "applied"
  );
  if (applied) {
    return "applied";
  }

  const approved = approvals.find(
    (state) =>
      state.itemId === relatedFix.id &&
      state.sourceType === "proposed_fix" &&
      state.status === "approved"
  );
  if (approved) {
    return "approved";
  }

  return "open";
}

function appendHistoryEntry(
  history: VerificationHistoryEntry[],
  status: VerificationStatus,
  checkedAt: string,
  notes: string
): VerificationHistoryEntry[] {
  const previousEntry = history.at(-1);
  if (
    previousEntry &&
    previousEntry.status === status &&
    previousEntry.notes === notes
  ) {
    return history;
  }

  return [...history, { status, checkedAt, notes }];
}

export async function buildVerificationReport(): Promise<VerificationReport> {
  const storedReport = await readVerificationReport();
  return storedReport;
}

export async function runVerificationAgent(): Promise<VerificationReport> {
  // Verification compares the prior saved findings to a fresh scan and records the lifecycle outcome.
  const [healthStore, fixesReport, approvals, applyResults, mergeResults, existingReport] =
    await Promise.all([
      readHealthReportStore(),
      readProposedFixReport(),
      readApprovalStates(),
      readApplyResults(),
      readMergeResults(),
      readVerificationReport()
    ]);

  const priorFindings = healthStore.latest.findings;
  const freshReport = await runKennelHealthAgent();
  const freshFindingIds = new Set(freshReport.findings.map((finding) => finding.id));
  const checkedAt = new Date().toISOString();

  const records: VerificationRecord[] = priorFindings.map((finding) => {
    const existingRecord = existingReport.records.find(
      (record) => record.findingId === finding.id
    );

    const baseStatus = getBaseLifecycleStatus(
      finding,
      fixesReport.fixes,
      approvals,
      applyResults,
      mergeResults
    );

    const status: VerificationStatus = freshFindingIds.has(finding.id)
      ? "still_failing"
      : "verified_resolved";

    const notes = freshFindingIds.has(finding.id)
      ? `Finding still appears in the fresh scan. Previous lifecycle stage was ${baseStatus}.`
      : `Finding no longer appears in the fresh scan. Previous lifecycle stage was ${baseStatus}.`;

    return {
      findingId: finding.id,
      findingTitle: finding.message,
      pageUrl: finding.pageUrl,
      severity: finding.severity,
      status,
      lastCheckedAt: checkedAt,
      notes,
      history: appendHistoryEntry(existingRecord?.history ?? [], status, checkedAt, notes)
    };
  });

  const report: VerificationReport = {
    generatedAt: checkedAt,
    records
  };

  await writeVerificationReport(report);
  return report;
}
