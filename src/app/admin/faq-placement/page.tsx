"use client";

import { useEffect, useState } from "react";

import { AdminNav } from "@/components/admin-nav";
import type { FaqPlacementReport } from "@/types/health";

const emptyReport: FaqPlacementReport = {
  generatedAt: "",
  items: []
};

export default function FaqPlacementPage() {
  const [report, setReport] = useState<FaqPlacementReport>(emptyReport);
  const [loading, setLoading] = useState(true);
  const [pendingActionKey, setPendingActionKey] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadReport() {
      try {
        const response = await fetch("/api/faq-placement", {
          cache: "no-store"
        });
        const data = (await response.json()) as FaqPlacementReport | { error: string };

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
      const response = await fetch("/api/faq-placement", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          itemId,
          action
        })
      });

      const data = (await response.json()) as FaqPlacementReport | { error: string };

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
          <h1>FAQ Placement</h1>
          <p className="muted">
            Turn approved FAQ content drafts into a real homepage FAQ block through a conservative merge preview.
          </p>
        </div>
      </section>

      <AdminNav currentPath="/admin/faq-placement" />

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>FAQ placement previews</h2>
            <p className="muted">
              {report.generatedAt
                ? `Loaded: ${new Date(report.generatedAt).toLocaleString()}`
                : "No FAQ placement previews are available yet."}
            </p>
          </div>
        </div>

        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
        {loading ? <p className="muted">Loading FAQ placement previews...</p> : null}

        {!loading && report.items.length === 0 ? (
          <p className="muted">
            No approved FAQ drafts are ready for placement yet. Approve an FAQ content draft first.
          </p>
        ) : null}

        {!loading && report.items.length > 0 ? (
          <div className="finding-list">
            {report.items.map((item) => (
              <article className="finding-card" key={item.itemId}>
                <div className="finding-topline">
                  <span className={`badge badge-${item.status}`}>{item.status}</span>
                  <span className="finding-type">Approved FAQ draft</span>
                </div>
                <h3>{item.title}</h3>
                <div className="fix-content">
                  <div>
                    <strong>Target file</strong>
                    <p className="muted">{item.targetFile}</p>
                  </div>
                  <div>
                    <strong>Current FAQ section state</strong>
                    <p className="muted">{item.currentFaqState}</p>
                  </div>
                  <div>
                    <strong>Proposed FAQ items</strong>
                    <div className="muted">
                      {item.proposedFaqItems.map((faq, index) => (
                        <p key={`${item.itemId}-${index}`}>
                          <strong>{faq.question}</strong>
                          <br />
                          {faq.answer}
                        </p>
                      ))}
                    </div>
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
                      pendingActionKey === `${item.itemId}-apply` ||
                      item.proposedFaqItems.length === 0
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
