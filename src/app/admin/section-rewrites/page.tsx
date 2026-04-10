"use client";

import { useEffect, useState } from "react";

import { ApprovalControls } from "@/components/approval-controls";
import { AdminNav } from "@/components/admin-nav";
import type {
  ApprovalQueueReport,
  ApprovalStatus,
  RewriteSectionName,
  SectionRewriteDraft,
  SectionRewriteReport
} from "@/types/health";

const sectionLabels: Record<RewriteSectionName, string> = {
  seo_title: "SEO title",
  meta_description: "Meta description",
  hero_headline: "Hero headline",
  hero_supporting_paragraph: "Hero supporting paragraph",
  primary_cta_text: "Primary CTA text"
};

const emptyReport: SectionRewriteReport = {
  generatedAt: "",
  pageUrl: "",
  drafts: []
};

export default function SectionRewritesPage() {
  const [report, setReport] = useState<SectionRewriteReport>(emptyReport);
  const [approvalStatuses, setApprovalStatuses] = useState<Record<string, ApprovalStatus>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [updatingKey, setUpdatingKey] = useState("");

  useEffect(() => {
    async function loadPageData() {
      try {
        const [reportResponse, approvalsResponse] = await Promise.all([
          fetch("/api/section-rewrites", {
            cache: "no-store"
          }),
          fetch("/api/approvals", { cache: "no-store" })
        ]);
        const data = (await reportResponse.json()) as SectionRewriteReport;
        const approvalData = (await approvalsResponse.json()) as ApprovalQueueReport;

        setReport(data);
        setApprovalStatuses(
          Object.fromEntries(
            approvalData.items
              .filter((item) => item.sourceType === "section_rewrite")
              .map((item) => [item.itemId, item.status])
          )
        );
      } finally {
        setLoading(false);
      }
    }

    void loadPageData();
  }, []);

  async function generateRewrites() {
    setGenerating(true);

    try {
      const response = await fetch("/api/section-rewrites", {
        method: "POST"
      });
      const data = (await response.json()) as SectionRewriteReport;
      setReport(data);
      setApprovalStatuses((current) => {
        const next = { ...current };

        data.drafts.forEach((draft) => {
          if (!next[draft.id]) {
            next[draft.id] = "pending";
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
          sourceType: "section_rewrite",
          status
        })
      });
      const data = (await response.json()) as ApprovalQueueReport;

      setApprovalStatuses(
        Object.fromEntries(
          data.items
            .filter((item) => item.sourceType === "section_rewrite")
            .map((item) => [item.itemId, item.status])
        )
      );
    } finally {
      setUpdatingKey("");
    }
  }

  // Rejected rewrite drafts remain part of the shared history, but they are not
  // counted as active rewrite work in the default operational view.
  const activeDrafts = report.drafts.filter(
    (draft) =>
      approvalStatuses[draft.id] !== "rejected" &&
      approvalStatuses[draft.id] !== "published"
  );

  const draftsBySection = activeDrafts.reduce<Record<RewriteSectionName, SectionRewriteDraft[]>>(
    (groups, draft) => {
      groups[draft.sectionName].push(draft);
      return groups;
    },
    {
      seo_title: [],
      meta_description: [],
      hero_headline: [],
      hero_supporting_paragraph: [],
      primary_cta_text: []
    }
  );

  return (
    <main className="shell">
      <section className="dashboard-header">
        <div>
          <p className="eyebrow">Admin Dashboard</p>
          <h1>Section Rewrites</h1>
          <p className="muted">
            Draft replacement copy generated from approved optimization insights for key homepage sections.
          </p>
        </div>
        <button className="button" onClick={generateRewrites} disabled={generating}>
          {generating ? "Generating rewrites..." : "Generate section rewrites"}
        </button>
      </section>

      <AdminNav currentPath="/admin/section-rewrites" />

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Latest rewrite set</h2>
            <p className="muted">
              {report.generatedAt
                ? `Generated: ${new Date(report.generatedAt).toLocaleString()}`
                : "No section rewrites have been generated yet."}
            </p>
            {report.pageUrl ? <p className="muted">{report.pageUrl}</p> : null}
          </div>
        </div>

        {loading ? <p className="muted">Loading section rewrites...</p> : null}

        {!loading && activeDrafts.length === 0 ? (
          <p className="muted">
            No section rewrites stored yet. Approve optimization insights first, then generate rewrite drafts.
          </p>
        ) : null}

        {!loading && activeDrafts.length > 0 ? (
          <div className="group-list">
            {(Object.entries(draftsBySection) as [RewriteSectionName, SectionRewriteDraft[]][])
              .filter(([, items]) => items.length > 0)
              .map(([sectionName, drafts]) => (
                <section className="finding-group" key={sectionName}>
                  <div className="group-heading">
                    <h3>{sectionLabels[sectionName]}</h3>
                    <span className="group-count">{drafts.length}</span>
                  </div>
                  <div className="finding-list">
                    {drafts.map((draft) => (
                      <article className="finding-card" key={draft.id}>
                        <div className="finding-topline">
                          <span className="badge badge-info">{sectionLabels[draft.sectionName]}</span>
                        </div>
                        <ApprovalControls
                          busy={updatingKey === `${draft.id}-approved` || updatingKey === `${draft.id}-rejected`}
                          onApprove={() => updateApproval(draft.id, "approved")}
                          onReject={() => updateApproval(draft.id, "rejected")}
                          status={approvalStatuses[draft.id] ?? "pending"}
                        />
                        <h3>{draft.sourceInsightTitle}</h3>
                        <div className="fix-content">
                          <div>
                            <strong>Current wording</strong>
                            <p className="muted">{draft.currentWording || "Not available"}</p>
                          </div>
                          <div>
                            <strong>Improved rewrite</strong>
                            <p className="muted">{draft.improvedRewrite}</p>
                          </div>
                          <div>
                            <strong>Reason for the rewrite</strong>
                            <p className="muted">{draft.reasonForRewrite}</p>
                          </div>
                          {draft.alternateVersion ? (
                            <div>
                              <strong>Alternate version</strong>
                              <p className="muted">{draft.alternateVersion}</p>
                            </div>
                          ) : null}
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
