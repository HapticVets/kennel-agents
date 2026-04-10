import Link from "next/link";

import { AdminNav } from "@/components/admin-nav";
import { buildWorkflowDashboard } from "@/lib/workflow-dashboard";

export default async function WorkflowPage() {
  const workflow = await buildWorkflowDashboard();
  const focusGroups = [
    {
      title: "Health",
      description: "Scan site health, review fixes, and confirm verification from one lane.",
      href: "/admin/health",
      label: "Open Health",
      links: [
        { href: "/admin/proposed-fixes", label: "Proposed fixes" },
        { href: "/admin/verification", label: "Verification" }
      ]
    },
    {
      title: "Optimization",
      description: "Generate insights, turn them into rewrites, then prepare conservative merges.",
      href: "/admin/optimization-insights",
      label: "Open Optimization",
      links: [
        { href: "/admin/section-rewrites", label: "Section rewrites" },
        { href: "/admin/optimization-merge", label: "Optimization merge" }
      ]
    },
    {
      title: "Content",
      description: "Draft homepage and FAQ content, and manage puppy listings as dynamic inventory.",
      href: "/admin/content-drafts",
      label: "Open Content",
      links: [
        { href: "/admin/puppy-listings", label: "Puppy listings" },
        { href: "/admin/faq-placement", label: "FAQ placement" }
      ]
    },
    {
      title: "Release",
      description: "Only publish SEO/content code changes when local files are ready. Puppy inventory updates are already dynamic.",
      href: "/admin/deploy",
      label: "Open Release",
      links: [
        { href: "/admin/apply-changes", label: "Apply changes" },
        { href: "/admin/merge-changes", label: "Merge changes" }
      ]
    },
    {
      title: "History",
      description: "Review approvals and prior decisions without crowding the day-to-day queue.",
      href: "/admin/approvals",
      label: "Open History",
      links: []
    }
  ] as const;

  return (
    <main className="shell">
      <section className="dashboard-header">
        <div>
          <p className="eyebrow">Admin Dashboard</p>
          <h1>Workflow</h1>
          <p className="muted">
            A single view of the optimization pipeline so the next operator step is clear.
          </p>
        </div>
      </section>

      <AdminNav currentPath="/admin/workflow" />

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Next best action</h2>
            <p className="muted">
              This card is derived from the current state of scans, approvals, rewrites, merges, and verification.
            </p>
          </div>
        </div>

        <article className="finding-card">
          <div className="finding-topline">
            <span className="badge badge-info">Next step</span>
          </div>
          <h3>{workflow.nextBestAction.title}</h3>
          <p className="muted">{workflow.nextBestAction.description}</p>
          <div className="approval-actions">
            <Link className="button" href={workflow.nextBestAction.href}>
              {workflow.nextBestAction.label}
            </Link>
          </div>
        </article>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Focused work areas</h2>
            <p className="muted">
              The dashboard stays grouped around the daily workflow so the operator can stay in one lane until the next handoff.
            </p>
          </div>
        </div>

        <div className="workflow-groups">
          {focusGroups.map((group) => (
            <article className="finding-card" key={group.title}>
              <h3>{group.title}</h3>
              <p className="muted">{group.description}</p>
              <div className="approval-actions">
                <Link className="button" href={group.href}>
                  {group.label}
                </Link>
              </div>
              {group.links.length > 0 ? (
                <details className="secondary-action-details">
                  <summary>View related tools</summary>
                  <div className="workflow-support-links">
                    {group.links.map((link) => (
                      <Link href={link.href} key={link.href}>
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </details>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Pipeline stages</h2>
            <p className="muted">
              Each stage explains what exists now, what is blocked, and what should happen next.
            </p>
          </div>
        </div>

        <div className="finding-list">
          {workflow.stages.map((stage) => (
            <article className="finding-card" key={stage.id}>
              <div className="finding-topline">
                <span className={`badge ${stage.blocked ? "badge-high" : "badge-info"}`}>
                  {stage.blocked ? "blocked" : "active"}
                </span>
                <span className="finding-type">{stage.itemCount} items</span>
              </div>
              <h3>{stage.title}</h3>
              <div className="fix-content">
                <div>
                  <strong>Current status</strong>
                  <p className="muted">{stage.currentStatus}</p>
                </div>
                <div>
                  <strong>Blocked</strong>
                  <p className="muted">{stage.blocked ? "Yes" : "No"}</p>
                </div>
                <div>
                  <strong>Why</strong>
                  <p className="muted">
                    {stage.blockedReason ?? "This stage has what it needs to move forward."}
                  </p>
                </div>
                <div>
                  <strong>Recommended next action</strong>
                  <p className="muted">{stage.recommendedNextAction}</p>
                </div>
              </div>
              <div className="approval-actions">
                <Link className="button" href={stage.actionHref}>
                  {stage.actionLabel}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
