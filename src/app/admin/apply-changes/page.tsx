"use client";

import { useEffect, useState } from "react";

import { AdminNav } from "@/components/admin-nav";
import type { ApplyQueueItem, ApplyQueueReport } from "@/types/health";

const sourceLabels: Record<ApplyQueueItem["sourceType"], string> = {
  proposed_fix: "Approved proposed fixes",
  content_draft: "Approved content drafts"
};

const emptyReport: ApplyQueueReport = {
  generatedAt: "",
  items: []
};

export default function ApplyChangesPage() {
  const [report, setReport] = useState<ApplyQueueReport>(emptyReport);
  const [loading, setLoading] = useState(true);
  const [applyingKey, setApplyingKey] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadQueue() {
      try {
        const response = await fetch("/api/apply-changes", { cache: "no-store" });
        const data = (await response.json()) as ApplyQueueReport | { error: string };

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

  async function applyItem(itemId: string, sourceType: ApplyQueueItem["sourceType"]) {
    const key = `${sourceType}-${itemId}`;
    setApplyingKey(key);
    setErrorMessage("");

    try {
      const response = await fetch("/api/apply-changes", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          itemId,
          sourceType
        })
      });

      const data = (await response.json()) as ApplyQueueReport | { error: string };

      if ("error" in data) {
        setErrorMessage(data.error);
        return;
      }

      setReport(data);
    } finally {
      setApplyingKey("");
    }
  }

  const groupedBySource = report.items.reduce<
    Record<ApplyQueueItem["sourceType"], ApplyQueueItem[]>
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
          <h1>Apply Changes</h1>
          <p className="muted">
            Stage approved fixes and content drafts into the local site codebase without deploying or committing.
          </p>
        </div>
      </section>

      <AdminNav currentPath="/admin/apply-changes" />

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Approved items ready to apply</h2>
            <p className="muted">
              {report.generatedAt
                ? `Loaded: ${new Date(report.generatedAt).toLocaleString()}`
                : "No apply-ready items found yet."}
            </p>
          </div>
        </div>

        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
        {loading ? <p className="muted">Loading apply queue...</p> : null}

        {!loading && report.items.length === 0 ? (
          <p className="muted">
            No approved proposed fixes or content drafts are ready yet. Approve items first in the Approvals page.
          </p>
        ) : null}

        {!loading && report.items.length > 0 ? (
          <div className="group-list">
            {(Object.entries(groupedBySource) as [
              ApplyQueueItem["sourceType"],
              ApplyQueueItem[]
            ][])
              .filter(([, items]) => items.length > 0)
              .map(([sourceType, items]) => (
                <section className="finding-group" key={sourceType}>
                  <div className="group-heading">
                    <h3>{sourceLabels[sourceType]}</h3>
                    <span className="group-count">{items.length}</span>
                  </div>

                  <div className="finding-list">
                    {items.map((item) => {
                      const key = `${item.sourceType}-${item.itemId}`;

                      return (
                        <article className="finding-card" key={key}>
                          <div className="finding-topline">
                            <span className={`badge badge-${item.status}`}>{item.status}</span>
                            <span className="finding-type">{sourceLabels[item.sourceType]}</span>
                          </div>
                          <h3>{item.title}</h3>
                          {item.pageUrl ? <p className="finding-url">{item.pageUrl}</p> : null}
                          <div className="fix-content">
                            <div>
                              <strong>Suggested target file</strong>
                              <p className="muted">{item.suggestedTargetFile}</p>
                            </div>
                            <div>
                              <strong>Change summary</strong>
                              <p className="muted">{item.changeSummary}</p>
                            </div>
                            <div>
                              <strong>Patch preview or replacement suggestion</strong>
                              <pre className="patch-preview">{item.patchPreview}</pre>
                            </div>
                            {item.message ? (
                              <div>
                                <strong>Apply status</strong>
                                <p className="muted">{item.message}</p>
                              </div>
                            ) : null}
                          </div>
                          <button
                            className="button"
                            disabled={applyingKey === key}
                            onClick={() => applyItem(item.itemId, item.sourceType)}
                            type="button"
                          >
                            {applyingKey === key ? "Applying..." : "Apply to local site"}
                          </button>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
