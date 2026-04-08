"use client";

import { useEffect, useState } from "react";

import { AdminNav } from "@/components/admin-nav";
import type {
  ConversionInsight,
  ConversionInsightCategory,
  ConversionInsightReport
} from "@/types/health";

const categoryLabels: Record<ConversionInsightCategory, string> = {
  messaging: "Homepage clarity and messaging",
  cta: "CTA visibility and strength",
  flow: "Page structure and flow",
  trust: "Trust signals",
  services: "Service clarity",
  drop_off: "Potential drop-off points"
};

const emptyReport: ConversionInsightReport = {
  generatedAt: "",
  insights: []
};

export default function ConversionInsightsPage() {
  const [report, setReport] = useState<ConversionInsightReport>(emptyReport);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    async function loadReport() {
      try {
        const response = await fetch("/api/conversion-insights", {
          cache: "no-store"
        });
        const data = (await response.json()) as ConversionInsightReport;
        setReport(data);
      } finally {
        setLoading(false);
      }
    }

    void loadReport();
  }, []);

  async function generateInsights() {
    setGenerating(true);

    try {
      // This route runs a lightweight heuristic review of the current site structure.
      const response = await fetch("/api/conversion-insights", {
        method: "POST"
      });
      const data = (await response.json()) as ConversionInsightReport;
      setReport(data);
    } finally {
      setGenerating(false);
    }
  }

  const insightsByCategory = report.insights.reduce<
    Record<ConversionInsightCategory, ConversionInsight[]>
  >(
    (groups, insight) => {
      groups[insight.category].push(insight);
      return groups;
    },
    {
      messaging: [],
      cta: [],
      flow: [],
      trust: [],
      services: [],
      drop_off: []
    }
  );

  return (
    <main className="shell">
      <section className="dashboard-header">
        <div>
          <p className="eyebrow">Admin Dashboard</p>
          <h1>Conversion Insights</h1>
          <p className="muted">
            Structure-based observations for lead flow, clarity, and conversion readiness.
          </p>
        </div>
        <button className="button" onClick={generateInsights} disabled={generating}>
          {generating ? "Generating insights..." : "Generate conversion insights"}
        </button>
      </section>

      <AdminNav currentPath="/admin/conversion-insights" />

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Latest conversion report</h2>
            <p className="muted">
              {report.generatedAt
                ? `Generated: ${new Date(report.generatedAt).toLocaleString()}`
                : "No conversion insights have been generated yet."}
            </p>
          </div>
        </div>

        {loading ? <p className="muted">Loading conversion insights...</p> : null}

        {!loading && report.insights.length === 0 ? (
          <p className="muted">
            No conversion insights stored yet. Generate a report to review lead and messaging observations.
          </p>
        ) : null}

        {!loading && report.insights.length > 0 ? (
          <div className="group-list">
            {(
              Object.entries(insightsByCategory) as [
                ConversionInsightCategory,
                ConversionInsight[]
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
                          <span className="finding-type">{categoryLabels[insight.category]}</span>
                        </div>
                        <h3>{insight.issueOrObservation}</h3>
                        <p className="finding-url">{insight.pageUrl}</p>
                        <div className="fix-content">
                          <div>
                            <strong>Recommendation</strong>
                            <p className="muted">{insight.recommendation}</p>
                          </div>
                          <div>
                            <strong>Suggested improvement example</strong>
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
