"use client";

import { useEffect, useState } from "react";

import { AdminNav } from "@/components/admin-nav";
import type {
  VerificationRecord,
  VerificationReport,
  VerificationStatus
} from "@/types/health";

const statusLabels: Record<VerificationStatus, string> = {
  open: "Open",
  approved: "Approved",
  applied: "Applied",
  merged: "Merged",
  verified_resolved: "Verified resolved",
  still_failing: "Still failing"
};

const emptyReport: VerificationReport = {
  generatedAt: "",
  records: []
};

export default function VerificationPage() {
  const [report, setReport] = useState<VerificationReport>(emptyReport);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    async function loadReport() {
      try {
        const response = await fetch("/api/verification", { cache: "no-store" });
        const data = (await response.json()) as VerificationReport;
        setReport(data);
      } finally {
        setLoading(false);
      }
    }

    void loadReport();
  }, []);

  async function runVerification() {
    setRunning(true);

    try {
      const response = await fetch("/api/verification", {
        method: "POST"
      });
      const data = (await response.json()) as VerificationReport;
      setReport(data);
    } finally {
      setRunning(false);
    }
  }

  const groupedByStatus = report.records.reduce<Record<VerificationStatus, VerificationRecord[]>>(
    (groups, record) => {
      groups[record.status].push(record);
      return groups;
    },
    {
      open: [],
      approved: [],
      applied: [],
      merged: [],
      verified_resolved: [],
      still_failing: []
    }
  );

  return (
    <main className="shell">
      <section className="dashboard-header">
        <div>
          <p className="eyebrow">Admin Dashboard</p>
          <h1>Verification</h1>
          <p className="muted">
            Confirm whether previously detected health findings still appear after approval and merge work.
          </p>
        </div>
        <button className="button" onClick={runVerification} disabled={running}>
          {running ? "Running verification..." : "Run verification"}
        </button>
      </section>

      <AdminNav currentPath="/admin/verification" />

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Verification records</h2>
            <p className="muted">
              {report.generatedAt
                ? `Last checked: ${new Date(report.generatedAt).toLocaleString()}`
                : "No verification run has been recorded yet."}
            </p>
          </div>
        </div>

        {loading ? <p className="muted">Loading verification records...</p> : null}

        {!loading && report.records.length === 0 ? (
          <p className="muted">
            No verification records yet. Run verification after you have health findings to compare.
          </p>
        ) : null}

        {!loading && report.records.length > 0 ? (
          <div className="group-list">
            {(Object.entries(groupedByStatus) as [VerificationStatus, VerificationRecord[]][])
              .filter(([, records]) => records.length > 0)
              .map(([status, records]) => (
                <section className="finding-group" key={status}>
                  <div className="group-heading">
                    <h3>{statusLabels[status]}</h3>
                    <span className="group-count">{records.length}</span>
                  </div>
                  <div className="finding-list">
                    {records.map((record) => (
                      <article className="finding-card" key={record.findingId}>
                        <div className="finding-topline">
                          <span className={`badge badge-${record.status}`}>{statusLabels[record.status]}</span>
                          <span className="finding-type">{record.severity}</span>
                        </div>
                        <h3>{record.findingTitle}</h3>
                        <p className="finding-url">{record.pageUrl}</p>
                        <div className="fix-content">
                          <div>
                            <strong>Original severity</strong>
                            <p className="muted">{record.severity}</p>
                          </div>
                          <div>
                            <strong>Current verification status</strong>
                            <p className="muted">{statusLabels[record.status]}</p>
                          </div>
                          <div>
                            <strong>Last checked time</strong>
                            <p className="muted">{new Date(record.lastCheckedAt).toLocaleString()}</p>
                          </div>
                          <div>
                            <strong>Verification notes</strong>
                            <p className="muted">{record.notes}</p>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
