"use client";

import { useEffect, useState } from "react";

import { AdminNav } from "@/components/admin-nav";
import type { MergeQueueItem, MergeQueueReport } from "@/types/health";

const sourceLabels: Record<MergeQueueItem["sourceType"], string> = {
  proposed_fix: "Approved proposed fixes",
  content_draft: "Approved content drafts"
};

const emptyReport: MergeQueueReport = {
  generatedAt: "",
  items: []
};

export default function MergeChangesPage() {
  const [report, setReport] = useState<MergeQueueReport>(emptyReport);
  const [loading, setLoading] = useState(true);
  const [pendingActionKey, setPendingActionKey] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadQueue() {
      try {
        const response = await fetch("/api/merge-changes", { cache: "no-store" });
        const data = (await response.json()) as MergeQueueReport | { error: string };

        if ("error" in data) {
          setErrorMessage(data.error);
          return;
        }

        setReport(data);
      } finally {
        setLoading(false);
      }
    }

    void loadQueue();
  }, []);

  async function runAction(
    itemId: string,
    sourceType: MergeQueueItem["sourceType"],
    action: "apply" | "skip"
  ) {
    const key = `${sourceType}-${itemId}-${action}`;
    setPendingActionKey(key);
    setErrorMessage("");

    try {
      const response = await fetch("/api/merge-changes", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          itemId,
          sourceType,
          action
        })
      });

      const data = (await response.json()) as MergeQueueReport | { error: string };

      if ("error" in data) {
        setErrorMessage(data.error);
        return;
      }

      setReport(data);
    } finally {
      setPendingActionKey("");
    }
  }

  const groupedBySource = report.items.reduce<
    Record<MergeQueueItem["sourceType"], MergeQueueItem[]>
  >(
    (groups, item) => {
      groups[item.sourceType].push(item);
      return groups;
    },
    {
      proposed_fix: [],
      content_draft: []
    }
  );

  return (
    <main className="shell">
      <section className="dashboard-header">
        <div>
          <p className="eyebrow">Admin Dashboard</p>
          <h1>Merge Changes</h1>
          <p className="muted">
            Review safe diff previews before writing approved staged changes into real site files.
          </p>
        </div>
      </section>

      <AdminNav currentPath="/admin/merge-changes" />

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Merge previews</h2>
            <p className="muted">
              {report.generatedAt
                ? `Loaded: ${new Date(report.generatedAt).toLocaleString()}`
                : "No merge previews are available yet."}
            </p>
          </div>
        </div>

        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
        {loading ? <p className="muted">Loading merge previews...</p> : null}

        {!loading && report.items.length === 0 ? (
          <p className="muted">
            No approved staged items are ready for merge. Approve and apply items to `src/agent-applied` first.
          </p>
        ) : null}

        {!loading && report.items.length > 0 ? (
          <div className="group-list">
            {(Object.entries(groupedBySource) as [
              MergeQueueItem["sourceType"],
              MergeQueueItem[]
            ][])
              .filter(([, items]) => items.length > 0)
              .map(([sourceType, items]) => (
                <section className="finding-group" key={sourceType}>
                  <div className="group-heading">
                    <h3>{sourceLabels[sourceType]}</h3>
                    <span className="group-count">{items.length}</span>
                  </div>

                  <div className="finding-list">
                    {items.map((item) => (
                      <article className="finding-card" key={`${item.sourceType}-${item.itemId}`}>
                        <div className="finding-topline">
                          <span className={`badge badge-${item.status}`}>{item.status}</span>
                          <span className="finding-type">{sourceLabels[item.sourceType]}</span>
                        </div>
                        <h3>{item.title}</h3>
                        <div className="fix-content">
                          <div>
                            <strong>Staged file</strong>
                            <p className="muted">{item.stagedFile}</p>
                          </div>
                          <div>
                            <strong>Target file</strong>
                            <p className="muted">{item.targetFile}</p>
                          </div>
                          <div>
                            <strong>Change summary</strong>
                            <p className="muted">{item.changeSummary}</p>
                          </div>
                          <div>
                            <strong>Diff preview</strong>
                            <pre className="patch-preview">{item.diffPreview || "No diff preview available."}</pre>
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
                              pendingActionKey === `${item.sourceType}-${item.itemId}-apply`
                            }
                            onClick={() => runAction(item.itemId, item.sourceType, "apply")}
                            type="button"
                          >
                            {pendingActionKey === `${item.sourceType}-${item.itemId}-apply`
                              ? "Applying..."
                              : "Apply Merge"}
                          </button>
                          <details className="secondary-action-details">
                            <summary>More</summary>
                            <button
                              className="button approval-button approval-button-secondary"
                              disabled={
                                pendingActionKey === `${item.sourceType}-${item.itemId}-skip`
                              }
                              onClick={() => runAction(item.itemId, item.sourceType, "skip")}
                              type="button"
                            >
                              {pendingActionKey === `${item.sourceType}-${item.itemId}-skip`
                                ? "Skipping..."
                                : "Skip"}
                            </button>
                          </details>
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
