"use client";

import { useEffect, useState } from "react";

import { AdminNav } from "@/components/admin-nav";
import type { OptimizationMergeItem, OptimizationMergeReport } from "@/types/health";

const emptyReport: OptimizationMergeReport = {
  generatedAt: "",
  items: []
};

const sectionLabels: Record<OptimizationMergeItem["sectionName"], string> = {
  seo_title: "SEO title",
  meta_description: "Meta description",
  hero_headline: "Hero headline",
  hero_supporting_paragraph: "Hero supporting paragraph",
  primary_cta_text: "Primary CTA text"
};

export default function OptimizationMergePage() {
  const [report, setReport] = useState<OptimizationMergeReport>(emptyReport);
  const [loading, setLoading] = useState(true);
  const [pendingActionKey, setPendingActionKey] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadReport() {
      try {
        const response = await fetch("/api/optimization-merge", {
          cache: "no-store"
        });
        const data = (await response.json()) as
          | OptimizationMergeReport
          | { error: string };

        if ("error" in data) {
          setErrorMessage(data.error);
          return;
        }

        setReport(data);
      } finally {
        setLoading(false);
      }
    }

    void loadReport();
  }, []);

  async function runAction(itemId: string, action: "apply" | "skip") {
    const key = `${itemId}-${action}`;
    setPendingActionKey(key);
    setErrorMessage("");

    try {
      const response = await fetch("/api/optimization-merge", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          itemId,
          action
        })
      });

      const data = (await response.json()) as
        | OptimizationMergeReport
        | { error: string };

      if ("error" in data) {
        setErrorMessage(data.error);
        return;
      }

      setReport(data);
    } finally {
      setPendingActionKey("");
    }
  }

  return (
    <main className="shell">
      <section className="dashboard-header">
        <div>
          <p className="eyebrow">Admin Dashboard</p>
          <h1>Optimization Merge</h1>
          <p className="muted">
            Review exact-match homepage and metadata replacements before writing approved section rewrites into the real site files.
          </p>
        </div>
      </section>

      <AdminNav currentPath="/admin/optimization-merge" />

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Optimization merge queue</h2>
            <p className="muted">
              {report.generatedAt
                ? `Loaded: ${new Date(report.generatedAt).toLocaleString()}`
                : "No optimization merge previews are available yet."}
            </p>
          </div>
        </div>

        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
        {loading ? <p className="muted">Loading optimization merge previews...</p> : null}

        {!loading && report.items.length === 0 ? (
          <p className="muted">
            No approved section rewrites are ready for merge yet. Generate section rewrites and mark the ones you want as approved first.
          </p>
        ) : null}

        {!loading && report.items.length > 0 ? (
          <div className="finding-list">
            {report.items.map((item) => (
              <article className="finding-card" key={item.itemId}>
                <div className="finding-topline">
                  <span className={`badge badge-${item.status}`}>{item.status}</span>
                  <span className="finding-type">{sectionLabels[item.sectionName]}</span>
                </div>
                <h3>{item.title}</h3>
                <div className="fix-content">
                  <div>
                    <strong>Target file</strong>
                    <p className="muted">{item.targetFile}</p>
                  </div>
                  <div>
                    <strong>Target field / section</strong>
                    <p className="muted">{item.targetField}</p>
                  </div>
                  <div>
                    <strong>Current value</strong>
                    <p className="muted">{item.currentValue || "No safe exact match found."}</p>
                  </div>
                  <div>
                    <strong>Proposed replacement</strong>
                    <p className="muted">{item.proposedReplacement}</p>
                  </div>
                  <div>
                    <strong>Diff preview</strong>
                    <pre className="patch-preview">{item.diffPreview}</pre>
                  </div>
                  {item.message ? (
                    <div>
                      <strong>Merge status</strong>
                      <p className="muted">{item.message}</p>
                    </div>
                  ) : null}
                </div>
                <div className="approval-actions">
                  <button
                    className="button"
                    disabled={
                      item.status === "unmatched" ||
                      pendingActionKey === `${item.itemId}-apply`
                    }
                    onClick={() => runAction(item.itemId, "apply")}
                    type="button"
                  >
                    {pendingActionKey === `${item.itemId}-apply`
                      ? "Applying..."
                      : "Apply Merge"}
                  </button>
                  <details className="secondary-action-details">
                    <summary>More</summary>
                    <button
                      className="button approval-button approval-button-secondary"
                      disabled={pendingActionKey === `${item.itemId}-skip`}
                      onClick={() => runAction(item.itemId, "skip")}
                      type="button"
                    >
                      {pendingActionKey === `${item.itemId}-skip` ? "Skipping..." : "Skip"}
                    </button>
                  </details>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
