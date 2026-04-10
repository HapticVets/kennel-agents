"use client";

import type { ApprovalStatus } from "@/types/health";

const statusLabels: Record<ApprovalStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  published: "Published",
  consumed: "Consumed"
};

export function ApprovalControls({
  status,
  onApprove,
  onReject,
  busy
}: {
  status: ApprovalStatus;
  onApprove: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  return (
    <>
      <div className="finding-topline">
        {/* These controls write into the shared approval queue, so local page actions and the main Approvals page stay in sync. */}
        <span className={`badge badge-${status}`}>{statusLabels[status]}</span>
      </div>
      <div className="approval-actions">
        <button
          className={`button approval-button ${status === "approved" ? "approval-button-active" : "approval-button-secondary"}`}
          disabled={busy || status === "published" || status === "consumed"}
          onClick={onApprove}
          type="button"
        >
          {busy && status !== "approved" ? "Saving..." : "Approve"}
        </button>
        <details className="secondary-action-details">
          <summary>More</summary>
          <button
            className={`button approval-button ${status === "rejected" ? "approval-button-active" : "approval-button-secondary"}`}
            disabled={busy || status === "published" || status === "consumed"}
            onClick={onReject}
            type="button"
          >
            {busy && status !== "rejected" ? "Saving..." : "Reject"}
          </button>
        </details>
      </div>
    </>
  );
}
