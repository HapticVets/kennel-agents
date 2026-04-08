"use client";

import { useEffect, useState } from "react";

import { AdminNav } from "@/components/admin-nav";
import type {
  FindingCategory,
  HealthFinding,
  HealthReport,
  HealthReportStore,
  Severity
} from "@/types/health";

const severityOrder: Record<Severity, number> = {
  high: 0,
  medium: 1,
  low: 2
};

const categoryLabels: Record<FindingCategory, string> = {
  availability: "Availability",
  links: "Links",
  seo: "SEO",
  images: "Images",
  system: "System"
};

const emptyReport: HealthReport = {
  checkedAt: "",
  baseUrl: "",
  findings: []
};

const emptyStore: HealthReportStore = {
  latest: emptyReport,
  history: []
};

export default function AdminDashboardPage() {
  const [store, setStore] = useState<HealthReportStore>(emptyStore);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    async function loadFindings() {
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        const data = (await response.json()) as HealthReportStore;
        setStore(data);
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

      const data = (await response.json()) as HealthReportStore;
      setStore(data);
    } finally {
      setRunning(false);
    }
  }

  const report = store.latest;
  const findings = [...report.findings].sort(
    (left, right) => severityOrder[left.severity] - severityOrder[right.severity]
  );
  const severityCounts = {
    high: findings.filter((item) => item.severity === "high").length,
    medium: findings.filter((item) => item.severity === "medium").length,
    low: findings.filter((item) => item.severity === "low").length
  };
  const findingsByCategory = findings.reduce<Record<FindingCategory, HealthFinding[]>>(
    (groups, finding) => {
      groups[finding.category].push(finding);
      return groups;
    },
    {
      availability: [],
      links: [],
      seo: [],
      images: [],
      system: []
    }
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

      <AdminNav currentPath="/admin" />

      <section className="stats-grid">
        <StatCard label="High severity" value={severityCounts.high} tone="high" />
        <StatCard label="Medium severity" value={severityCounts.medium} tone="medium" />
        <StatCard label="Low severity" value={severityCounts.low} tone="low" />
        <StatCard label="Total" value={findings.length} />
      </section>

      <section className="dashboard-grid">
        <div className="card">
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
            <div className="group-list">
              {(
                Object.entries(findingsByCategory) as [FindingCategory, HealthFinding[]][]
              )
                .filter(([, items]) => items.length > 0)
                .map(([category, items]) => (
                  <section className="finding-group" key={category}>
                    <div className="group-heading">
                      <h3>{categoryLabels[category]}</h3>
                      <span className="group-count">{items.length}</span>
                    </div>
                    <div className="finding-list">
                      {items.map((finding) => (
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
                  </section>
                ))}
            </div>
          ) : null}
        </div>

        <aside className="card history-card">
          <div className="section-heading">
            <div>
              <h2>Recent scans</h2>
              <p className="muted">Latest 10 saved runs</p>
            </div>
          </div>

          {store.history.length === 0 ? (
            <p className="muted">No scan history yet.</p>
          ) : (
            <div className="history-list">
              {store.history.map((scan) => {
                const highCount = scan.findings.filter((item) => item.severity === "high").length;
                const mediumCount = scan.findings.filter((item) => item.severity === "medium").length;
                const lowCount = scan.findings.filter((item) => item.severity === "low").length;

                return (
                  <article className="history-item" key={scan.checkedAt}>
                    <strong>{new Date(scan.checkedAt).toLocaleString()}</strong>
                    <span className="muted">{scan.findings.length} findings</span>
                    <div className="history-severities">
                      <span className="badge badge-high">{highCount} high</span>
                      <span className="badge badge-medium">{mediumCount} medium</span>
                      <span className="badge badge-low">{lowCount} low</span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}

function StatCard({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone?: Severity;
}) {
  return (
    <div className={`card stat-card ${tone ? `stat-card-${tone}` : ""}`}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
    </div>
  );
}
