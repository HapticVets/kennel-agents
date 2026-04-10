"use client";

import { useEffect, useState } from "react";

import { ApprovalControls } from "@/components/approval-controls";
import { AdminNav } from "@/components/admin-nav";
import type {
  ApprovalQueueReport,
  ApprovalStatus,
  OptimizationInsight,
  OptimizationInsightCategory,
  OptimizationInsightReport
} from "@/types/health";

const categoryLabels: Record<OptimizationInsightCategory, string> = {
  SEO: "SEO",
  CTA: "CTA",
  Trust: "Trust",
  UX: "UX",
  Content: "Content"
};

const emptyReport: OptimizationInsightReport = {
  generatedAt: "",
  pageUrl: "",
  insights: []
};

export default function OptimizationInsightsPage() {
  const [report, setReport] = useState<OptimizationInsightReport>(emptyReport);
  const [approvalStatuses, setApprovalStatuses] = useState<Record<string, ApprovalStatus>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [updatingKey, setUpdatingKey] = useState("");

  useEffect(() => {
    async function loadPageData() {
      try {
        const [reportResponse, approvalsResponse] = await Promise.all([
          fetch("/api/optimization-insights", {
            cache: "no-store"
          }),
          fetch("/api/approvals", { cache: "no-store" })
        ]);
        const data = (await reportResponse.json()) as OptimizationInsightReport;
        const approvalData = (await approvalsResponse.json()) as ApprovalQueueReport;

        setReport(data);
        setApprovalStatuses(
          Object.fromEntries(
            approvalData.items
              .filter((item) => item.sourceType === "optimization_insight")
              .map((item) => [item.itemId, item.status])
          )
        );
      } finally {
        setLoading(false);
      }
    }

    void loadPageData();
  }, []);

  async function generateInsights() {
    setGenerating(true);

    try {
      const response = await fetch("/api/optimization-insights", {
        method: "POST"
      });
      const data = (await response.json()) as OptimizationInsightReport;
      setReport(data);
      setApprovalStatuses((current) => {
        const next = { ...current };

        data.insights.forEach((insight) => {
          if (!next[insight.id]) {
            next[insight.id] = "pending";
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
          sourceType: "optimization_insight",
          status
        })
      });
      const data = (await response.json()) as ApprovalQueueReport;

      setApprovalStatuses(
        Object.fromEntries(
          data.items
            .filter((item) => item.sourceType === "optimization_insight")
            .map((item) => [item.itemId, item.status])
        )
      );
    } finally {
      setUpdatingKey("");
    }
  }

  // Rejected insights remain in approval history, but this page defaults to the
  // insights that are still actionable for the operator.
  const activeInsights = report.insights.filter(
    (insight) =>
      approvalStatuses[insight.id] !== "rejected" &&
      approvalStatuses[insight.id] !== "published"
  );

  const insightsByCategory = activeInsights.reduce<
    Record<OptimizationInsightCategory, OptimizationInsight[]>
  >(
    (groups, insight) => {
      groups[insight.category].push(insight);
      return groups;
    },
    {
      SEO: [],
      CTA: [],
      Trust: [],
      UX: [],
      Content: []
    }
  );

  return (
    <main className="shell">
      <section className="dashboard-header">
        <div>
          <p className="eyebrow">Admin Dashboard</p>
          <h1>Optimization Insights</h1>
          <p className="muted">
            Read-only homepage recommendations for ranking, clarity, trust, and conversions.
          </p>
        </div>
        <button className="button" onClick={generateInsights} disabled={generating}>
          {generating ? "Generating insights..." : "Generate optimization insights"}
        </button>
      </section>

      <AdminNav currentPath="/admin/optimization-insights" />

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Latest optimization report</h2>
            <p className="muted">
              {report.generatedAt
                ? `Generated: ${new Date(report.generatedAt).toLocaleString()}`
                : "No optimization insights have been generated yet."}
            </p>
            {report.pageUrl ? <p className="muted">{report.pageUrl}</p> : null}
          </div>
        </div>

        {loading ? <p className="muted">Loading optimization insights...</p> : null}

        {!loading && activeInsights.length === 0 ? (
          <p className="muted">
            No optimization insights stored yet. Generate a homepage optimization review to see opportunities.
          </p>
        ) : null}

        {!loading && activeInsights.length > 0 ? (
          <div className="group-list">
            {(
              Object.entries(insightsByCategory) as [
                OptimizationInsightCategory,
                OptimizationInsight[]
              ][]
            )
              .filter(([, items]) => items.length > 0)
              .map(([category, items]) => (
                <section className="finding-group" key={category}>
                  <div className="group-heading">
                    <h3>{categoryLabels[category]}</h3>
                    <span className="group-count">{items.length}</span>
                  </div>
                  <div className="finding-list">
                    {items.map((insight) => (
                      <article className="finding-card" key={insight.id}>
                        <div className="finding-topline">
                          <span className={`badge badge-${insight.severity}`}>{insight.severity}</span>
                          <span className="finding-type">{insight.category}</span>
                        </div>
                        <ApprovalControls
                          busy={updatingKey === `${insight.id}-approved` || updatingKey === `${insight.id}-rejected`}
                          onApprove={() => updateApproval(insight.id, "approved")}
                          onReject={() => updateApproval(insight.id, "rejected")}
                          status={approvalStatuses[insight.id] ?? "pending"}
                        />
                        <h3>{insight.issueTitle}</h3>
                        <div className="fix-content">
                          <div>
                            <strong>Why it matters</strong>
                            <p className="muted">{insight.whyItMatters}</p>
                          </div>
                          <div>
                            <strong>Recommended improvement</strong>
                            <p className="muted">{insight.recommendedImprovement}</p>
                          </div>
                          <div>
                            <strong>Suggested rewrite or improvement example</strong>
                            <p className="muted">{insight.improvementExample}</p>
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
