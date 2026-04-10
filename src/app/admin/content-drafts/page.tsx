"use client";

import { useEffect, useState } from "react";

import { ApprovalControls } from "@/components/approval-controls";
import { AdminNav } from "@/components/admin-nav";
import type {
  ApprovalQueueReport,
  ApprovalStatus,
  ContentDraft,
  ContentDraftReport,
  ContentDraftStatus,
  ContentDraftType
} from "@/types/health";

const contentTypeLabels: Record<ContentDraftType, string> = {
  homepage_hero: "Homepage hero section",
  cta_section: "CTA section",
  faq_items: "FAQ items",
  service_training_copy: "Service and training copy",
  puppy_listing_template: "Puppy listing template",
  announcement_post: "Announcement post"
};

const contentStatusLabels: Record<ContentDraftStatus, string> = {
  draft: "Draft",
  approved: "Approved",
  placed: "Placed",
  published: "Published",
  consumed: "Consumed",
  archived: "Archived"
};

const emptyReport: ContentDraftReport = {
  generatedAt: "",
  activeBatchId: "",
  drafts: [],
  publishedDrafts: [],
  consumedDrafts: [],
  archivedDrafts: []
};

function dedupeDraftsById(drafts: ContentDraft[], bucketName: string): ContentDraft[] {
  const draftMap = new Map<string, ContentDraft>();
  const duplicateDraftIds = new Set<string>();

  for (const draft of drafts) {
    const existing = draftMap.get(draft.id);

    if (!existing) {
      draftMap.set(draft.id, draft);
      continue;
    }

    duplicateDraftIds.add(draft.id);

    const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
    const nextTime = new Date(draft.updatedAt || draft.createdAt || 0).getTime();

    draftMap.set(draft.id, nextTime >= existingTime ? draft : existing);
  }

  if (process.env.NEXT_PUBLIC_KENNEL_HEALTH_DEBUG === "true" && duplicateDraftIds.size > 0) {
    console.log("[ContentDraftPageDedup]", {
      bucketName,
      duplicateDraftIds: [...duplicateDraftIds]
    });
  }

  return [...draftMap.values()];
}

export default function ContentDraftsPage() {
  const [report, setReport] = useState<ContentDraftReport>(emptyReport);
  const [approvalStatuses, setApprovalStatuses] = useState<Record<string, ApprovalStatus>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [updatingKey, setUpdatingKey] = useState("");

  useEffect(() => {
    async function loadPageData() {
      try {
        const [reportResponse, approvalsResponse] = await Promise.all([
          fetch("/api/content-drafts", { cache: "no-store" }),
          fetch("/api/approvals", { cache: "no-store" })
        ]);
        const data = (await reportResponse.json()) as ContentDraftReport;
        const approvalData = (await approvalsResponse.json()) as ApprovalQueueReport;

        setReport(data);
        setApprovalStatuses(
          Object.fromEntries(
            approvalData.items
              .filter((item) => item.sourceType === "content_draft")
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
      // This route creates a fresh set of editable draft content ideas and saves them locally.
      const response = await fetch("/api/content-drafts", {
        method: "POST"
      });
      const data = (await response.json()) as ContentDraftReport;
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
          sourceType: "content_draft",
          status
        })
      });
      const data = (await response.json()) as ApprovalQueueReport;

      setApprovalStatuses(
        Object.fromEntries(
          data.items
            .filter((item) => item.sourceType === "content_draft")
            .map((item) => [item.itemId, item.status])
        )
      );
    } finally {
      setUpdatingKey("");
    }
  }

  // Content drafts only stay in the active queue while they are still true
  // draft suggestions. Approved, placed, and published items move elsewhere.
  const dedupedActiveDrafts = dedupeDraftsById(report.drafts, "drafts");
  const dedupedPublishedDrafts = dedupeDraftsById(report.publishedDrafts, "publishedDrafts");
  const dedupedConsumedDrafts = dedupeDraftsById(report.consumedDrafts, "consumedDrafts");
  const dedupedArchivedDrafts = dedupeDraftsById(report.archivedDrafts, "archivedDrafts");

  const activeDrafts = dedupedActiveDrafts.filter(
    (draft) =>
      draft.status === "draft" &&
      approvalStatuses[draft.id] !== "rejected" &&
      approvalStatuses[draft.id] !== "published" &&
      approvalStatuses[draft.id] !== "consumed"
  );

  const draftsByType = activeDrafts.reduce<Record<ContentDraftType, ContentDraft[]>>(
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

  const publishedByType = dedupedPublishedDrafts.reduce<Record<ContentDraftType, ContentDraft[]>>(
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

  const archivedByType = dedupedArchivedDrafts.reduce<Record<ContentDraftType, ContentDraft[]>>(
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
  const consumedByType = dedupedConsumedDrafts.reduce<Record<ContentDraftType, ContentDraft[]>>(
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
            <h2>Content lifecycle</h2>
            <p className="muted">
              {report.generatedAt
                ? `Latest batch: ${report.activeBatchId || "n/a"} generated ${new Date(report.generatedAt).toLocaleString()}`
                : "No content drafts have been generated yet."}
            </p>
          </div>
        </div>

        {loading ? <p className="muted">Loading content drafts...</p> : null}

        {!loading && activeDrafts.length === 0 ? (
          <p className="muted">
            No active drafts are available right now. Generate content to create a fresh batch of suggestions.
          </p>
        ) : null}

        {!loading && activeDrafts.length > 0 ? (
          <div className="group-list">
            <section className="finding-group">
              <div className="group-heading">
                <h3>Active Drafts</h3>
                <span className="group-count">{activeDrafts.length}</span>
              </div>
            {(Object.entries(draftsByType) as [ContentDraftType, ContentDraft[]][])
              .filter(([, drafts]) => drafts.length > 0)
              .map(([contentType, drafts]) => (
                <section className="finding-group" key={`active-${contentType}`}>
                  <div className="group-heading">
                    <h3>{contentTypeLabels[contentType]}</h3>
                    <span className="group-count">{drafts.length}</span>
                  </div>
                  <div className="finding-list">
                    {drafts.map((draft) => (
                      <article className="finding-card" key={draft.id}>
                        <div className="finding-topline">
                          <span className="badge badge-info">{contentTypeLabels[draft.contentType]}</span>
                          <span className={`badge badge-${draft.status}`}>{contentStatusLabels[draft.status]}</span>
                        </div>
                        <ApprovalControls
                          busy={updatingKey === `${draft.id}-approved` || updatingKey === `${draft.id}-rejected`}
                          onApprove={() => updateApproval(draft.id, "approved")}
                          onReject={() => updateApproval(draft.id, "rejected")}
                          status={approvalStatuses[draft.id] ?? "pending"}
                        />
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
                          <div>
                            <strong>Batch</strong>
                            <p className="muted">{draft.batchId}</p>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </section>
          </div>
        ) : null}

        {!loading && dedupedConsumedDrafts.length > 0 ? (
          <div className="group-list" style={{ marginTop: 24 }}>
            <section className="finding-group">
              <div className="group-heading">
                <h3>Consumed</h3>
                <span className="group-count">{dedupedConsumedDrafts.length}</span>
              </div>
              {(Object.entries(consumedByType) as [ContentDraftType, ContentDraft[]][])
                .filter(([, drafts]) => drafts.length > 0)
                .map(([contentType, drafts]) => (
                  <section className="finding-group" key={`consumed-${contentType}`}>
                    <div className="group-heading">
                      <h3>{contentTypeLabels[contentType]}</h3>
                      <span className="group-count">{drafts.length}</span>
                    </div>
                    <div className="finding-list">
                      {drafts.map((draft) => (
                        <article className="finding-card" key={draft.id}>
                          <div className="finding-topline">
                            <span className="badge badge-info">{contentTypeLabels[draft.contentType]}</span>
                            <span className={`badge badge-${draft.status}`}>{contentStatusLabels[draft.status]}</span>
                          </div>
                          <h3>{draft.title}</h3>
                          <p className="muted">{draft.notes}</p>
                          <p className="muted">Batch: {draft.batchId}</p>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
            </section>
          </div>
        ) : null}

        {!loading && dedupedPublishedDrafts.length > 0 ? (
          <div className="group-list" style={{ marginTop: 24 }}>
            <section className="finding-group">
              <div className="group-heading">
                <h3>Published</h3>
                <span className="group-count">{dedupedPublishedDrafts.length}</span>
              </div>
              {(Object.entries(publishedByType) as [ContentDraftType, ContentDraft[]][])
                .filter(([, drafts]) => drafts.length > 0)
                .map(([contentType, drafts]) => (
                  <section className="finding-group" key={`published-${contentType}`}>
                    <div className="group-heading">
                      <h3>{contentTypeLabels[contentType]}</h3>
                      <span className="group-count">{drafts.length}</span>
                    </div>
                    <div className="finding-list">
                      {drafts.map((draft) => (
                        <article className="finding-card" key={draft.id}>
                          <div className="finding-topline">
                            <span className="badge badge-info">{contentTypeLabels[draft.contentType]}</span>
                            <span className={`badge badge-${draft.status}`}>{contentStatusLabels[draft.status]}</span>
                          </div>
                          <h3>{draft.title}</h3>
                          <p className="muted">{draft.notes}</p>
                          <p className="muted">Batch: {draft.batchId}</p>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
            </section>
          </div>
        ) : null}

        {!loading && dedupedArchivedDrafts.length > 0 ? (
          <div className="group-list" style={{ marginTop: 24 }}>
            <section className="finding-group">
              <div className="group-heading">
                <h3>Archived</h3>
                <span className="group-count">{dedupedArchivedDrafts.length}</span>
              </div>
              {(Object.entries(archivedByType) as [ContentDraftType, ContentDraft[]][])
                .filter(([, drafts]) => drafts.length > 0)
                .map(([contentType, drafts]) => (
                  <section className="finding-group" key={`archived-${contentType}`}>
                    <div className="group-heading">
                      <h3>{contentTypeLabels[contentType]}</h3>
                      <span className="group-count">{drafts.length}</span>
                    </div>
                    <div className="finding-list">
                      {drafts.map((draft) => (
                        <article className="finding-card" key={draft.id}>
                          <div className="finding-topline">
                            <span className="badge badge-info">{contentTypeLabels[draft.contentType]}</span>
                            <span className={`badge badge-${draft.status}`}>{contentStatusLabels[draft.status]}</span>
                          </div>
                          <h3>{draft.title}</h3>
                          <p className="muted">{draft.notes}</p>
                          <p className="muted">Batch: {draft.batchId}</p>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}
