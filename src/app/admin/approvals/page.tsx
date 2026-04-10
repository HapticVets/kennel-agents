"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

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
  puppy_listing: "Puppy listings",
  conversion_insight: "Conversion recommendations",
  optimization_insight: "Optimization insights",
  section_rewrite: "Section rewrites"
};

const statusLabels: Record<ApprovalStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  published: "Published",
  consumed: "Consumed"
};

const emptyReport: ApprovalQueueReport = {
  generatedAt: "",
  items: []
};

export default function ApprovalsPage() {
  const [report, setReport] = useState<ApprovalQueueReport>(emptyReport);
  const [loading, setLoading] = useState(true);
  const [updatingKey, setUpdatingKey] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | "all">("all");
  const [showHistory, setShowHistory] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<ApprovalSourceType | "all">("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [expandedItemId, setExpandedItemId] = useState("");

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
      // This page still writes into the shared approval queue, so local review actions and other pages stay in sync.
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

  async function runBulkAction(status: ApprovalStatus) {
    const selectedItems = report.items.filter((item) =>
      selectedIds.includes(buildSelectionId(item))
    );

    if (selectedItems.length === 0) {
      return;
    }

    setUpdatingKey(`bulk-${status}`);

    try {
      let latestReport = report;

      for (const item of selectedItems) {
        const response = await fetch("/api/approvals", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            itemId: item.itemId,
            sourceType: item.sourceType,
            status
          })
        });

        latestReport = (await response.json()) as ApprovalQueueReport;
      }

      setReport(latestReport);
      setSelectedIds([]);
    } finally {
      setUpdatingKey("");
    }
  }

  function buildSelectionId(item: ApprovalQueueItem): string {
    return `${item.sourceType}:${item.itemId}`;
  }

  const visibleItems = useMemo(() => {
    return [...report.items]
      // Rejected items stay stored in the shared approval history, but the
      // default operational queue hides historical items unless the operator opts in.
      .filter(
        (item) =>
          showHistory ||
          statusFilter === "rejected" ||
          statusFilter === "published" ||
          statusFilter === "consumed" ||
          (item.status !== "rejected" &&
            item.status !== "published" &&
            item.status !== "consumed")
      )
      .filter((item) => statusFilter === "all" || item.status === statusFilter)
      .filter((item) => sourceFilter === "all" || item.sourceType === sourceFilter)
      .sort((left, right) => {
        const leftTime = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
        const rightTime = right.updatedAt ? new Date(right.updatedAt).getTime() : 0;

        return sortOrder === "newest" ? rightTime - leftTime : leftTime - rightTime;
      });
  }, [report.items, showHistory, sourceFilter, sortOrder, statusFilter]);

  const selectedVisibleCount = visibleItems.filter((item) =>
    selectedIds.includes(buildSelectionId(item))
  ).length;

  function toggleSelected(item: ApprovalQueueItem) {
    const selectionId = buildSelectionId(item);

    setSelectedIds((current) =>
      current.includes(selectionId)
        ? current.filter((entry) => entry !== selectionId)
        : [...current, selectionId]
    );
  }

  function toggleSelectAllVisible() {
    const visibleSelectionIds = visibleItems.map(buildSelectionId);
    const allVisibleSelected = visibleSelectionIds.every((id) => selectedIds.includes(id));

    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !visibleSelectionIds.includes(id))
        : [...new Set([...current, ...visibleSelectionIds])]
    );
  }

  return (
    <main className="shell">
      <section className="dashboard-header">
        <div>
          <p className="eyebrow">Admin Dashboard</p>
          <h1>Approvals</h1>
          <p className="muted">
            Review items in one compact queue, filter what you need, and process approvals in bulk.
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

        {!loading && report.items.length > 0 ? (
          <>
            <div className="approval-toolbar">
              <label className="approval-filter">
                <span>Status</span>
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as ApprovalStatus | "all")
                  }
                >
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="published">Published</option>
                  <option value="consumed">Consumed</option>
                </select>
              </label>

              <label className="approval-filter">
                <span>Source</span>
                <select
                  value={sourceFilter}
                  onChange={(event) =>
                    setSourceFilter(event.target.value as ApprovalSourceType | "all")
                  }
                >
                  <option value="all">All sources</option>
                  {Object.entries(sourceLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="approval-filter">
                <span>Sort</span>
                <select
                  value={sortOrder}
                  onChange={(event) =>
                    setSortOrder(event.target.value as "newest" | "oldest")
                  }
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </label>

              <label className="approval-filter">
                <span>History</span>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    checked={showHistory}
                    onChange={(event) => setShowHistory(event.target.checked)}
                    type="checkbox"
                  />
                  <span>Show historical</span>
                </label>
              </label>

              <div className="approval-bulk-actions">
                <span className="muted">{selectedVisibleCount} selected</span>
                <button
                  className="button approval-button"
                  disabled={selectedIds.length === 0 || updatingKey === "bulk-approved"}
                  onClick={() => runBulkAction("approved")}
                  type="button"
                >
                  {updatingKey === "bulk-approved" ? "Approving..." : "Approve selected"}
                </button>
                <button
                  className="button approval-button approval-button-secondary"
                  disabled={selectedIds.length === 0 || updatingKey === "bulk-rejected"}
                  onClick={() => runBulkAction("rejected")}
                  type="button"
                >
                  {updatingKey === "bulk-rejected" ? "Rejecting..." : "Reject selected"}
                </button>
              </div>
            </div>

            {visibleItems.length > 0 ? (
              <div className="approval-table-wrap">
                <table className="approval-table">
                  <thead>
                    <tr>
                      <th>
                        <input
                          checked={
                            visibleItems.length > 0 &&
                            visibleItems.every((item) =>
                              selectedIds.includes(buildSelectionId(item))
                            )
                          }
                          onChange={toggleSelectAllVisible}
                          type="checkbox"
                        />
                      </th>
                      <th>Source type</th>
                      <th>Title</th>
                      <th>Related page / section</th>
                      <th>Status</th>
                      <th>Severity / priority</th>
                      <th>Updated</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleItems.map((item) => {
                      const selectionId = buildSelectionId(item);
                      const isExpanded = expandedItemId === selectionId;

                      return (
                        <Fragment key={selectionId}>
                          <tr key={selectionId}>
                            <td>
                              <input
                                checked={selectedIds.includes(selectionId)}
                                onChange={() => toggleSelected(item)}
                                type="checkbox"
                              />
                            </td>
                            <td>{sourceLabels[item.sourceType]}</td>
                            <td>
                              <button
                                className="approval-row-title"
                                onClick={() =>
                                  setExpandedItemId(isExpanded ? "" : selectionId)
                                }
                                type="button"
                              >
                                {item.title}
                              </button>
                            </td>
                            <td>{item.pageUrl || item.categoryOrType}</td>
                            <td>
                              <span className={`badge badge-${item.status}`}>
                                {statusLabels[item.status]}
                              </span>
                            </td>
                            <td>{item.severity ? item.severity : item.categoryOrType}</td>
                            <td>
                              {item.updatedAt
                                ? new Date(item.updatedAt).toLocaleString()
                                : "—"}
                            </td>
                            <td>
                              <div className="approval-row-actions">
                                <button
                                  className="button approval-button"
                                  disabled={
                                    item.status === "published" ||
                                    item.status === "consumed" ||
                                    updatingKey === `${item.sourceType}-${item.itemId}-approved`
                                  }
                                  onClick={() =>
                                    updateStatus(item.itemId, item.sourceType, "approved")
                                  }
                                  type="button"
                                >
                                  {updatingKey === `${item.sourceType}-${item.itemId}-approved`
                                    ? "Saving..."
                                    : "Approve"}
                                </button>
                                <button
                                  className="button approval-button approval-button-secondary"
                                  disabled={
                                    item.status === "published" ||
                                    item.status === "consumed" ||
                                    updatingKey === `${item.sourceType}-${item.itemId}-rejected`
                                  }
                                  onClick={() =>
                                    updateStatus(item.itemId, item.sourceType, "rejected")
                                  }
                                  type="button"
                                >
                                  {updatingKey === `${item.sourceType}-${item.itemId}-rejected`
                                    ? "Saving..."
                                    : "Reject"}
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isExpanded ? (
                            <tr className="approval-detail-row">
                              <td colSpan={8}>
                                <div className="approval-detail-panel">
                                  <div>
                                    <strong>Summary</strong>
                                    <p className="muted">{item.summary}</p>
                                  </div>
                                  <div>
                                    <strong>Category / type</strong>
                                    <p className="muted">{item.categoryOrType}</p>
                                  </div>
                                  {item.pageUrl ? (
                                    <div>
                                      <strong>Related page</strong>
                                      <p className="muted">{item.pageUrl}</p>
                                    </div>
                                  ) : null}
                                  <div>
                                    <strong>Current status</strong>
                                    <p className="muted">{statusLabels[item.status]}</p>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">
                No items match the current filters. Rejected, published, and consumed items stay in history and can be shown with the toggle above.
              </p>
            )}
          </>
        ) : null}

        {!loading && report.items.length === 0 ? (
          <p className="muted">
            No approval items found yet. Generate proposed fixes, content drafts, conversion insights, optimization insights, or section rewrites first.
          </p>
        ) : null}
      </section>
    </main>
  );
}
