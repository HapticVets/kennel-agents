"use client";

import { useEffect, useState } from "react";

import { AdminNav } from "@/components/admin-nav";
import type { DeployStatusReport } from "@/types/health";

const emptyReport: DeployStatusReport = {
  generatedAt: "",
  repoPath: "",
  currentBranch: "",
  gitStatusSummary: "",
  isClean: true,
  isAheadOfRemote: false,
  changedFiles: [],
  suggestedCommitMessage: "",
  commitStatus: {
    status: "idle",
    message: "",
    updatedAt: ""
  },
  pushStatus: {
    status: "idle",
    message: "",
    updatedAt: ""
  },
  publishStatus: {
    status: "idle",
    message: "",
    updatedAt: ""
  },
  readyForVerification: false,
  lastPublishResult: ""
};

export default function DeployPage() {
  const [report, setReport] = useState<DeployStatusReport>(emptyReport);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [publishing, setPublishing] = useState(false);
  const changedFileCount = report.changedFiles.length;

  useEffect(() => {
    async function loadStatus() {
      try {
        const response = await fetch("/api/deploy/status", {
          cache: "no-store"
        });
        const data = (await response.json()) as DeployStatusReport | { error: string };

        if ("error" in data) {
          setErrorMessage(data.error);
          return;
        }

        setReport(data);
      } finally {
        setLoading(false);
      }
    }

    void loadStatus();
  }, []);

  async function runPublish() {
    setPublishing(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/deploy/publish", {
        method: "POST"
      });

      const data = (await response.json()) as DeployStatusReport | { error: string };

      if ("error" in data) {
        setErrorMessage(data.error);

        const statusResponse = await fetch("/api/deploy/status", {
          cache: "no-store"
        });
        const refreshed = (await statusResponse.json()) as DeployStatusReport | { error: string };

        if (!("error" in refreshed)) {
          setReport(refreshed);
        }

        return;
      }

      setReport(data);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <main className="shell">
      <section className="dashboard-header">
        <div>
          <p className="eyebrow">Admin Dashboard</p>
          <h1>Release</h1>
          <p className="muted">
            Publish SEO/content website code changes from one action. Puppy inventory updates are dynamic and do not require this release step.
          </p>
        </div>
        <button
          className="button"
          disabled={loading || publishing || changedFileCount === 0}
          onClick={runPublish}
          type="button"
          title={
            changedFileCount === 0
              ? "No SEO/content website file changes are waiting. Puppy listings update through dynamic data."
              : "Publish current website code changes."
          }
        >
          {publishing ? "Publishing..." : "Publish SEO/Content Changes"}
        </button>
      </section>

      <AdminNav currentPath="/admin/deploy" />

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Publish status</h2>
            <p className="muted">
              {report.generatedAt
                ? `Loaded: ${new Date(report.generatedAt).toLocaleString()}`
                : "No deploy status loaded yet."}
            </p>
          </div>
        </div>

        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
        {loading ? <p className="muted">Loading deploy status...</p> : null}

        {!loading ? (
          <div className="fix-content">
            <div>
              <strong>Puppy listing workflow</strong>
              <p className="muted">
                Approved puppy listings are served by /api/public/puppy-listings from the puppy data source. Create, edit, archive, delete, and sold/reserved changes do not need Apply, Merge, or Publish.
              </p>
            </div>
            <div>
              <strong>Repo path</strong>
              <p className="muted">{report.repoPath}</p>
            </div>
            <div>
              <strong>Changed file count</strong>
              <p className="muted">{report.changedFiles.length}</p>
            </div>
            <div>
              <strong>Suggested commit message</strong>
              <p className="muted">
                {report.suggestedCommitMessage || "No local changes to publish."}
              </p>
            </div>
            <div>
              <strong>Publish status</strong>
              <p className="muted">
                {report.publishStatus.message || "No publish action run yet."}
              </p>
            </div>
            <div>
              <strong>Last publish result</strong>
              <p className="muted">{report.lastPublishResult || "No publish result stored yet."}</p>
            </div>
            <div>
              <strong>Ready for verification</strong>
              <p className="muted">{report.readyForVerification ? "Yes" : "No"}</p>
            </div>
          </div>
        ) : null}

        {!loading && report.changedFiles.length === 0 ? (
          <p className="muted">
            No SEO/content website file changes were found, so there is nothing to publish right now. Puppy listing inventory may still update live through the dynamic API-backed workflow.
          </p>
        ) : null}

        {!loading && report.changedFiles.length > 0 ? (
          <div className="finding-list">
            {report.changedFiles.map((file) => (
              <article className="finding-card" key={`${file.statusCode}-${file.path}`}>
                <div className="finding-topline">
                  <span className="badge badge-info">{file.statusCode.trim() || "??"}</span>
                  <span className="finding-type">{file.summary}</span>
                </div>
                <h3>{file.path}</h3>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
