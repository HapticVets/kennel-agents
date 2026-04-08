"use client";

import { useEffect, useState } from "react";

import type { HealthReport, Severity } from "@/types/health";

const severityOrder: Record<Severity, number> = {
  high: 0,
  medium: 1,
  low: 2
};

const emptyReport: HealthReport = {
  checkedAt: "",
  baseUrl: "",
  findings: []
};

export default function AdminDashboardPage() {
  const [report, setReport] = useState<HealthReport>(emptyReport);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    async function loadFindings() {
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        const data = (await response.json()) as HealthReport;
        setReport(data);
      } finally {
        setLoading(false);
      }
    }

    void loadFindings();
  }, []);

  async function runAgent() {
    setRunning(true);

    try {
      // The dashboard triggers the agent manually so the first phase stays simple.
      const response = await fetch("/api/health", {
        method: "POST"
      });

      const data = (await response.json()) as HealthReport;
      setReport(data);
    } finally {
      setRunning(false);
    }
  }

  const findings = [...report.findings].sort(
    (left, right) => severityOrder[left.severity] - severityOrder[right.severity]
  );

  return (
    <main className="shell">
      <section className="dashboard-header">
        <div>
          <p className="eyebrow">Admin Dashboard</p>
          <h1>Kennel Health Agent</h1>
          <p className="muted">
            Checks availability, link health, SEO basics, and missing images.
          </p>
        </div>
        <button className="button" onClick={runAgent} disabled={running}>
          {running ? "Running scan..." : "Run scan"}
        </button>
      </section>

      <section className="stats-grid">
        <StatCard label="High" value={findings.filter((item) => item.severity === "high").length} />
        <StatCard label="Medium" value={findings.filter((item) => item.severity === "medium").length} />
        <StatCard label="Low" value={findings.filter((item) => item.severity === "low").length} />
        <StatCard label="Total" value={findings.length} />
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Latest findings</h2>
            <p className="muted">
              {report.checkedAt
                ? `Last checked: ${new Date(report.checkedAt).toLocaleString()}`
                : "No scan has been run yet."}
            </p>
          </div>
        </div>

        {loading ? <p className="muted">Loading findings...</p> : null}

        {!loading && findings.length === 0 ? (
          <p className="muted">
            No findings stored yet. Run the health agent to create the first report.
          </p>
        ) : null}

        {!loading && findings.length > 0 ? (
          <div className="finding-list">
            {findings.map((finding) => (
              <article className="finding-card" key={finding.id}>
                <div className="finding-topline">
                  <span className={`badge badge-${finding.severity}`}>{finding.severity}</span>
                  <span className="finding-type">{finding.type.replaceAll("_", " ")}</span>
                </div>
                <h3>{finding.message}</h3>
                <p className="finding-url">{finding.pageUrl}</p>
                {finding.details ? <p className="muted">{finding.details}</p> : null}
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card stat-card">
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
    </div>
  );
}
