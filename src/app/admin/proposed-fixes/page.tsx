"use client";

import { useEffect, useState } from "react";

import { ApprovalControls } from "@/components/approval-controls";
import { AdminNav } from "@/components/admin-nav";
import type {
  ApprovalQueueReport,
  ApprovalStatus,
  FindingCategory,
  ProposedFix,
  ProposedFixReport
} from "@/types/health";

const categoryLabels: Record<FindingCategory, string> = {
  availability: "Availability",
  links: "Links",
  seo: "SEO",
  images: "Images",
  system: "System"
};

const emptyReport: ProposedFixReport = {
  generatedAt: "",
  sourceCheckedAt: "",
  fixes: []
};

export default function ProposedFixesPage() {
  const [report, setReport] = useState<ProposedFixReport>(emptyReport);
  const [approvalStatuses, setApprovalStatuses] = useState<Record<string, ApprovalStatus>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [updatingKey, setUpdatingKey] = useState("");

  useEffect(() => {
    async function loadPageData() {
      try {
        const [reportResponse, approvalsResponse] = await Promise.all([
          fetch("/api/proposed-fixes", { cache: "no-store" }),
          fetch("/api/approvals", { cache: "no-store" })
        ]);
        const data = (await reportResponse.json()) as ProposedFixReport;
        const approvalData = (await approvalsResponse.json()) as ApprovalQueueReport;

        setReport(data);
        setApprovalStatuses(
          Object.fromEntries(
            approvalData.items
              .filter((item) => item.sourceType === "proposed_fix")
              .map((item) => [item.itemId, item.status])
          )
        );
      } finally {
        setLoading(false);
      }
    }

    void loadPageData();
  }, []);

  async function generateDrafts() {
    setGenerating(true);

    try {
      // This route reads the latest health findings and writes a new set of draft fixes.
      const response = await fetch("/api/proposed-fixes", {
        method: "POST"
      });
      const data = (await response.json()) as ProposedFixReport;
      setReport(data);
      setApprovalStatuses((current) => {
        const next = { ...current };

        data.fixes.forEach((fix) => {
          if (!next[fix.id]) {
            next[fix.id] = "pending";
          }
        });

        return next;
      });
    } finally {
      setGenerating(false);
    }
  }

  async function updateApproval(itemId: string, status: ApprovalStatus) {
    const key = `${itemId}-${status}`;
    setUpdatingKey(key);

    try {
      const response = await fetch("/api/approvals", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          itemId,
          sourceType: "proposed_fix",
          status
        })
      });
      const data = (await response.json()) as ApprovalQueueReport;

      setApprovalStatuses(
        Object.fromEntries(
          data.items
            .filter((item) => item.sourceType === "proposed_fix")
            .map((item) => [item.itemId, item.status])
        )
      );
    } finally {
      setUpdatingKey("");
    }
  }

  // Rejected fix drafts stay in storage and approval history, but the default
  // fix queue hides them so the operator sees only active suggestions.
  const activeFixes = report.fixes.filter(
    (fix) =>
      approvalStatuses[fix.id] !== "rejected" &&
      approvalStatuses[fix.id] !== "published"
  );

  const fixesByCategory = activeFixes.reduce<Record<FindingCategory, ProposedFix[]>>(
    (groups, fix) => {
      groups[fix.category].push(fix);
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
          <h1>Proposed Fixes</h1>
          <p className="muted">
            Read-only draft recommendations based on the latest health findings.
          </p>
        </div>
        <button className="button" onClick={generateDrafts} disabled={generating}>
          {generating ? "Generating drafts..." : "Generate proposed fixes"}
        </button>
      </section>

      <AdminNav currentPath="/admin/proposed-fixes" />

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Latest draft set</h2>
            <p className="muted">
              {report.generatedAt
                ? `Generated: ${new Date(report.generatedAt).toLocaleString()} from findings scanned ${new Date(report.sourceCheckedAt).toLocaleString()}`
                : "No proposed fixes have been generated yet."}
            </p>
          </div>
        </div>

        {loading ? <p className="muted">Loading proposed fixes...</p> : null}

        {!loading && activeFixes.length === 0 ? (
          <p className="muted">
            No proposed fixes stored yet. Generate draft fixes from the latest health findings.
          </p>
        ) : null}

        {!loading && activeFixes.length > 0 ? (
          <div className="group-list">
            {(Object.entries(fixesByCategory) as [FindingCategory, ProposedFix[]][])
              .filter(([, fixes]) => fixes.length > 0)
              .map(([category, fixes]) => (
                <section className="finding-group" key={category}>
                  <div className="group-heading">
                    <h3>{categoryLabels[category]}</h3>
                    <span className="group-count">{fixes.length}</span>
                  </div>
                  <div className="finding-list">
                    {fixes.map((fix) => (
                      <article className="finding-card" key={fix.id}>
                        <div className="finding-topline">
                          <span className={`badge badge-${fix.severity}`}>{fix.severity}</span>
                          <span className="finding-type">{fix.category}</span>
                        </div>
                        <ApprovalControls
                          busy={updatingKey === `${fix.id}-approved` || updatingKey === `${fix.id}-rejected`}
                          onApprove={() => updateApproval(fix.id, "approved")}
                          onReject={() => updateApproval(fix.id, "rejected")}
                          status={approvalStatuses[fix.id] ?? "pending"}
                        />
                        <h3>{fix.issueTitle}</h3>
                        <p className="finding-url">{fix.pageUrl}</p>
                        <div className="fix-content">
                          <div>
                            <strong>Recommended fix</strong>
                            <p className="muted">{fix.recommendedFix}</p>
                          </div>
                          <div>
                            <strong>Before preview</strong>
                            <p className="muted">{fix.beforePreview}</p>
                          </div>
                          <div>
                            <strong>After preview</strong>
                            <p className="muted">{fix.afterPreview}</p>
                          </div>
                          <div>
                            <strong>Implementation notes</strong>
                            <p className="muted">{fix.implementationNotes}</p>
                          </div>
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
