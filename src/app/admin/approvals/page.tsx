"use client";

import { useEffect, useState } from "react";

import { AdminNav } from "@/components/admin-nav";
import type {
  ApprovalQueueItem,
  ApprovalQueueReport,
  ApprovalSourceType,
  ApprovalStatus
} from "@/types/health";

const sourceLabels: Record<ApprovalSourceType, string> = {
  proposed_fix: "Proposed fixes",
  content_draft: "Content drafts",
  conversion_insight: "Conversion recommendations"
};

const statusLabels: Record<ApprovalStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected"
};

const emptyReport: ApprovalQueueReport = {
  generatedAt: "",
  items: []
};

export default function ApprovalsPage() {
  const [report, setReport] = useState<ApprovalQueueReport>(emptyReport);
  const [loading, setLoading] = useState(true);
  const [updatingKey, setUpdatingKey] = useState("");

  useEffect(() => {
    async function loadQueue() {
      try {
        const response = await fetch("/api/approvals", { cache: "no-store" });
        const data = (await response.json()) as ApprovalQueueReport;
        setReport(data);
      } finally {
        setLoading(false);
      }
    }

    void loadQueue();
  }, []);

  async function updateStatus(
    itemId: string,
    sourceType: ApprovalSourceType,
    status: ApprovalStatus
  ) {
    const key = `${sourceType}-${itemId}-${status}`;
    setUpdatingKey(key);

    try {
      // Approval changes only update local review state for drafts and recommendations.
      const response = await fetch("/api/approvals", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          itemId,
          sourceType,
          status
        })
      });

      const data = (await response.json()) as ApprovalQueueReport;
      setReport(data);
    } finally {
      setUpdatingKey("");
    }
  }

  const groupedBySource = report.items.reduce<Record<ApprovalSourceType, ApprovalQueueItem[]>>(
    (groups, item) => {
      groups[item.sourceType].push(item);
      return groups;
    },
    {
      proposed_fix: [],
      content_draft: [],
      conversion_insight: []
    }
  );

  return (
    <main className="shell">
      <section className="dashboard-header">
        <div>
          <p className="eyebrow">Admin Dashboard</p>
          <h1>Approvals</h1>
          <p className="muted">
            Review and track approval state for fixes, content drafts, and conversion recommendations.
          </p>
        </div>
      </section>

      <AdminNav currentPath="/admin/approvals" />

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Approval queue</h2>
            <p className="muted">
              {report.generatedAt
                ? `Loaded: ${new Date(report.generatedAt).toLocaleString()}`
                : "No reviewable items are available yet."}
            </p>
          </div>
        </div>

        {loading ? <p className="muted">Loading approval queue...</p> : null}

        {!loading && report.items.length === 0 ? (
          <p className="muted">
            No approval items found yet. Generate proposed fixes, content drafts, or conversion insights first.
          </p>
        ) : null}

        {!loading && report.items.length > 0 ? (
          <div className="group-list">
            {(Object.entries(groupedBySource) as [ApprovalSourceType, ApprovalQueueItem[]][])
              .filter(([, items]) => items.length > 0)
              .map(([sourceType, items]) => (
                <section className="finding-group" key={sourceType}>
                  <div className="group-heading">
                    <h3>{sourceLabels[sourceType]}</h3>
                    <span className="group-count">{items.length}</span>
                  </div>

                  <div className="approval-status-groups">
                    {(["pending", "approved", "rejected"] as ApprovalStatus[]).map((status) => {
                      const statusItems = items.filter((item) => item.status === status);

                      return (
                        <div className="approval-status-column" key={status}>
                          <div className="group-heading">
                            <h4>{statusLabels[status]}</h4>
                            <span className="group-count">{statusItems.length}</span>
                          </div>

                          {statusItems.length === 0 ? (
                            <p className="muted">No items in this status.</p>
                          ) : (
                            <div className="finding-list">
                              {statusItems.map((item) => (
                                <article className="finding-card" key={`${item.sourceType}-${item.itemId}`}>
                                  <div className="finding-topline">
                                    <span className={`badge badge-${item.status}`}>
                                      {item.status}
                                    </span>
                                    <span className="finding-type">{item.categoryOrType}</span>
                                  </div>
                                  <h3>{item.title}</h3>
                                  {item.pageUrl ? <p className="finding-url">{item.pageUrl}</p> : null}
                                  {item.severity ? (
                                    <p className="muted">Severity: {item.severity}</p>
                                  ) : null}
                                  <p className="muted">{item.summary}</p>
                                  <div className="approval-actions">
                                    {(["pending", "approved", "rejected"] as ApprovalStatus[]).map(
                                      (nextStatus) => {
                                        const key = `${item.sourceType}-${item.itemId}-${nextStatus}`;

                                        return (
                                          <button
                                            key={nextStatus}
                                            className={`button approval-button ${item.status === nextStatus ? "approval-button-active" : "approval-button-secondary"}`}
                                            disabled={updatingKey === key}
                                            onClick={() =>
                                              updateStatus(item.itemId, item.sourceType, nextStatus)
                                            }
                                            type="button"
                                          >
                                            {updatingKey === key ? "Saving..." : statusLabels[nextStatus]}
                                          </button>
                                        );
                                      }
                                    )}
                                  </div>
                                </article>
                              ))}
                            </div>
                          )}
                        </div>
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
