"use client";

import { useEffect, useState } from "react";

import { AdminNav } from "@/components/admin-nav";
import type { ContentDraft, ContentDraftReport, ContentDraftType } from "@/types/health";

const contentTypeLabels: Record<ContentDraftType, string> = {
  homepage_hero: "Homepage hero section",
  cta_section: "CTA section",
  faq_items: "FAQ items",
  service_training_copy: "Service and training copy",
  puppy_listing_template: "Puppy listing template",
  announcement_post: "Announcement post"
};

const emptyReport: ContentDraftReport = {
  generatedAt: "",
  drafts: []
};

export default function ContentDraftsPage() {
  const [report, setReport] = useState<ContentDraftReport>(emptyReport);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    async function loadReport() {
      try {
        const response = await fetch("/api/content-drafts", { cache: "no-store" });
        const data = (await response.json()) as ContentDraftReport;
        setReport(data);
      } finally {
        setLoading(false);
      }
    }

    void loadReport();
  }, []);

  async function generateDrafts() {
    setGenerating(true);

    try {
      // This route creates a fresh set of editable draft content ideas and saves them locally.
      const response = await fetch("/api/content-drafts", {
        method: "POST"
      });
      const data = (await response.json()) as ContentDraftReport;
      setReport(data);
    } finally {
      setGenerating(false);
    }
  }

  const draftsByType = report.drafts.reduce<Record<ContentDraftType, ContentDraft[]>>(
    (groups, draft) => {
      groups[draft.contentType].push(draft);
      return groups;
    },
    {
      homepage_hero: [],
      cta_section: [],
      faq_items: [],
      service_training_copy: [],
      puppy_listing_template: [],
      announcement_post: []
    }
  );

  return (
    <main className="shell">
      <section className="dashboard-header">
        <div>
          <p className="eyebrow">Admin Dashboard</p>
          <h1>Content Drafts</h1>
          <p className="muted">
            Read-only starter copy for key website sections and announcements.
          </p>
        </div>
        <button className="button" onClick={generateDrafts} disabled={generating}>
          {generating ? "Generating drafts..." : "Generate content drafts"}
        </button>
      </section>

      <AdminNav currentPath="/admin/content-drafts" />

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Latest content draft set</h2>
            <p className="muted">
              {report.generatedAt
                ? `Generated: ${new Date(report.generatedAt).toLocaleString()}`
                : "No content drafts have been generated yet."}
            </p>
          </div>
        </div>

        {loading ? <p className="muted">Loading content drafts...</p> : null}

        {!loading && report.drafts.length === 0 ? (
          <p className="muted">
            No content drafts stored yet. Generate a draft set to review section copy ideas.
          </p>
        ) : null}

        {!loading && report.drafts.length > 0 ? (
          <div className="group-list">
            {(Object.entries(draftsByType) as [ContentDraftType, ContentDraft[]][])
              .filter(([, drafts]) => drafts.length > 0)
              .map(([contentType, drafts]) => (
                <section className="finding-group" key={contentType}>
                  <div className="group-heading">
                    <h3>{contentTypeLabels[contentType]}</h3>
                    <span className="group-count">{drafts.length}</span>
                  </div>
                  <div className="finding-list">
                    {drafts.map((draft) => (
                      <article className="finding-card" key={draft.id}>
                        <div className="finding-topline">
                          <span className="badge badge-info">{contentTypeLabels[draft.contentType]}</span>
                        </div>
                        <h3>{draft.title}</h3>
                        <div className="fix-content">
                          <div>
                            <strong>Purpose</strong>
                            <p className="muted">{draft.purpose}</p>
                          </div>
                          <div>
                            <strong>Target audience</strong>
                            <p className="muted">{draft.targetAudience}</p>
                          </div>
                          <div>
                            <strong>Draft text</strong>
                            <p className="muted draft-text">{draft.draftText}</p>
                          </div>
                          {draft.ctaSuggestion ? (
                            <div>
                              <strong>CTA suggestion</strong>
                              <p className="muted">{draft.ctaSuggestion}</p>
                            </div>
                          ) : null}
                          <div>
                            <strong>Notes</strong>
                            <p className="muted">{draft.notes}</p>
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
