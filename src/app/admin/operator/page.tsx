"use client";

import { useEffect, useState } from "react";

import { AdminNav } from "@/components/admin-nav";
import type {
  OperatorDashboardReport,
  OperatorSuggestionItem
} from "@/types/health";

const emptyReport: OperatorDashboardReport = {
  generatedAt: "",
  health: {
    lastRunAt: "",
    issues: 0,
    opportunities: 0,
    verificationSummary: "Verification has not been run yet.",
    issueHighlights: [],
    opportunityHighlights: []
  },
  suggestions: {
    items: []
  },
  release: {
    approvedItems: [],
    changedFiles: [],
    status: "idle",
    message: "No local website changes are ready yet."
  }
};

const sourceLabels: Record<OperatorSuggestionItem["sourceType"], string> = {
  optimization_insight: "Optimization insight",
  section_rewrite: "Section rewrite",
  content_draft: "Content draft"
};

export default function OperatorModePage() {
  const [report, setReport] = useState<OperatorDashboardReport>(emptyReport);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    void loadReport();
  }, []);

  async function loadReport() {
    try {
      const response = await fetch("/api/operator", { cache: "no-store" });
      const data = (await response.json()) as OperatorDashboardReport | { error: string };

      if ("error" in data) {
        setErrorMessage(data.error);
        return;
      }

      setReport(data);
    } finally {
      setLoading(false);
    }
  }

  async function runAction(
    action: "health" | "suggestions" | "apply" | "approval",
    payload?: Record<string, string>
  ) {
    setBusyAction(action + (payload?.itemId ? `-${payload.itemId}` : ""));
    setErrorMessage("");

    try {
      const response = await fetch("/api/operator", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          action,
          ...payload
        })
      });
      const data = (await response.json()) as OperatorDashboardReport | { error: string };

      if ("error" in data) {
        setErrorMessage(data.error);
        return;
      }

      setReport(data);
    } finally {
      setBusyAction("");
    }
  }

  return (
    <main className="shell">
      <section className="dashboard-header">
        <div>
          <p className="eyebrow">Operator Mode</p>
          <h1>Daily Control Center</h1>
          <p className="muted">
            Operator mode wraps the SEO/content agents into three steps. Puppy listings are managed separately as dynamic public inventory.
          </p>
        </div>
      </section>

      <AdminNav currentPath="/admin/operator" />

      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

      <section className="operator-layout">
        <article className="card">
          <div className="section-heading">
            <div>
              <h2>1. Health Check</h2>
              <p className="muted">
                Runs the current health scan first, then verification, and summarizes the latest site condition.
              </p>
            </div>
            <button
              className="button"
              disabled={loading || busyAction === "health"}
              onClick={() => runAction("health")}
              type="button"
            >
              {busyAction === "health" ? "Running..." : "Run Health Check"}
            </button>
          </div>

          <div className="stats-grid">
            <div className="card stat-card">
              <span className="stat-label">Issues</span>
              <strong className="stat-value">{report.health.issues}</strong>
            </div>
            <div className="card stat-card">
              <span className="stat-label">Opportunities</span>
              <strong className="stat-value">{report.health.opportunities}</strong>
            </div>
          </div>

          <div className="fix-content">
            <div>
              <strong>Last run</strong>
              <p className="muted">
                {report.health.lastRunAt
                  ? new Date(report.health.lastRunAt).toLocaleString()
                  : "No operator health run yet."}
              </p>
            </div>
            <div>
              <strong>Verification</strong>
              <p className="muted">{report.health.verificationSummary}</p>
            </div>
            <div>
              <strong>Issue highlights</strong>
              {report.health.issueHighlights.length > 0 ? (
                <ul className="operator-list">
                  {report.health.issueHighlights.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No current issues detected.</p>
              )}
            </div>
            <div>
              <strong>Opportunity highlights</strong>
              {report.health.opportunityHighlights.length > 0 ? (
                <ul className="operator-list">
                  {report.health.opportunityHighlights.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No low-severity improvements are waiting right now.</p>
              )}
            </div>
          </div>
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <h2>2. Content Suggestions</h2>
              <p className="muted">
                Generates optimization ideas and content drafts, then keeps approval inline so the operator does not need the separate approvals queue.
              </p>
            </div>
            <button
              className="button"
              disabled={loading || busyAction === "suggestions"}
              onClick={() => runAction("suggestions")}
              type="button"
            >
              {busyAction === "suggestions" ? "Generating..." : "Generate Suggestions"}
            </button>
          </div>

          {report.suggestions.items.length === 0 ? (
            <p className="muted">
              No active suggestions are loaded yet. Generate suggestions to create a fresh optimization and content batch.
            </p>
          ) : (
            <div className="finding-list">
              {report.suggestions.items.map((item) => {
                const approveKey = `approval-${item.itemId}`;

                return (
                  <article className="finding-card" key={`${item.sourceType}-${item.itemId}`}>
                    <div className="finding-topline">
                      <span className={`badge badge-${item.status}`}>{item.status}</span>
                      <span className="finding-type">{sourceLabels[item.sourceType]}</span>
                    </div>
                    <h3>{item.title}</h3>
                    <p className="muted">{item.shortExplanation}</p>
                    {item.preview ? <p className="muted">{item.preview}</p> : null}
                    <div className="approval-actions">
                      <button
                        className="button approval-button"
                        disabled={
                          busyAction === approveKey ||
                          item.status === "published" ||
                          item.status === "consumed"
                        }
                        onClick={() =>
                          runAction("approval", {
                            itemId: item.itemId,
                            sourceType: item.sourceType,
                            status: "approved"
                          })
                        }
                        type="button"
                      >
                        {busyAction === approveKey ? "Saving..." : "Approve"}
                      </button>
                      <details className="secondary-action-details">
                        <summary>More</summary>
                        <button
                          className="button approval-button approval-button-secondary"
                          disabled={
                            busyAction === approveKey ||
                            item.status === "published" ||
                            item.status === "consumed"
                          }
                          onClick={() =>
                            runAction("approval", {
                              itemId: item.itemId,
                              sourceType: item.sourceType,
                              status: "rejected"
                            })
                          }
                          type="button"
                        >
                          Reject
                        </button>
                      </details>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <h2>3. Apply to Website</h2>
              <p className="muted">
                This wraps the SEO/content apply, merge, and publish logic into one operator action. Puppy listing inventory does not use this static release path.
              </p>
            </div>
            <button
              className="button"
              disabled={loading || busyAction === "apply" || report.release.approvedItems.length === 0}
              onClick={() => runAction("apply")}
              type="button"
            >
              {busyAction === "apply" ? "Applying..." : "Apply to Website"}
            </button>
          </div>

          <div className="fix-content">
            <div>
              <strong>Status</strong>
              <p className="muted">{report.release.message}</p>
            </div>
            <div>
              <strong>Approved items ready</strong>
              <p className="muted">{report.release.approvedItems.length}</p>
            </div>
            <div>
              <strong>Changed files</strong>
              {report.release.changedFiles.length > 0 ? (
                <ul className="operator-list">
                  {report.release.changedFiles.map((file) => (
                    <li key={`${file.statusCode}-${file.path}`}>
                      {file.summary}: {file.path}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No local website changes are staged for publish right now.</p>
              )}
            </div>
            <div>
              <strong>Approved queue</strong>
              {report.release.approvedItems.length > 0 ? (
                <ul className="operator-list">
                  {report.release.approvedItems.map((item) => (
                    <li key={`${item.sourceType}-${item.itemId}`}>
                      {item.title}: {item.readiness}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">
                  No approved items are waiting. Approve suggestions first, then run the apply step.
                </p>
              )}
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
