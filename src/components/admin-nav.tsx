import Link from "next/link";

export function AdminNav({ currentPath }: { currentPath: string }) {
  // The nav stays grouped around the operator's workflow instead of exposing
  // every tool as a top-level destination.
  const groups = [
    {
      label: "Workflow",
      href: "/admin/operator",
      paths: ["/admin", "/admin/operator", "/admin/workflow"],
      links: [{ href: "/admin/workflow", label: "Detailed workflow" }]
    },
    {
      label: "Health",
      href: "/admin/health",
      paths: ["/admin/health", "/admin/proposed-fixes", "/admin/verification"],
      links: [
        { href: "/admin/health", label: "Health findings" },
        { href: "/admin/proposed-fixes", label: "Proposed fixes" },
        { href: "/admin/verification", label: "Verification" }
      ]
    },
    {
      label: "Optimization",
      href: "/admin/optimization-insights",
      paths: [
        "/admin/optimization-insights",
        "/admin/section-rewrites",
        "/admin/optimization-merge",
        "/admin/conversion-insights"
      ],
      links: [
        { href: "/admin/optimization-insights", label: "Insights" },
        { href: "/admin/section-rewrites", label: "Rewrites" },
        { href: "/admin/optimization-merge", label: "Merge" },
        { href: "/admin/conversion-insights", label: "Conversion" }
      ]
    },
    {
      label: "Content",
      href: "/admin/content-drafts",
      paths: ["/admin/content-drafts", "/admin/faq-placement", "/admin/puppy-listings"],
      links: [
        { href: "/admin/content-drafts", label: "Drafts" },
        { href: "/admin/puppy-listings", label: "Puppy listings" },
        { href: "/admin/faq-placement", label: "FAQ placement" }
      ]
    },
    {
      label: "Release",
      href: "/admin/deploy",
      paths: ["/admin/apply-changes", "/admin/merge-changes", "/admin/deploy"],
      links: [
        { href: "/admin/apply-changes", label: "Apply SEO/content" },
        { href: "/admin/merge-changes", label: "Merge SEO/content" },
        { href: "/admin/deploy", label: "Publish SEO/content" }
      ]
    },
    {
      label: "History",
      href: "/admin/approvals",
      paths: ["/admin/approvals"],
      links: [{ href: "/admin/approvals", label: "Approvals" }]
    }
  ];

  return (
    <nav className="admin-nav">
      {groups.map((group) => {
        const isActive = group.paths.includes(currentPath);

        return (
          <div className={`admin-nav-group ${isActive ? "admin-nav-group-active" : ""}`} key={group.label}>
            <Link className={`admin-nav-link ${isActive ? "admin-nav-link-active" : ""}`} href={group.href}>
              {group.label}
            </Link>
            {group.links.length > 0 ? (
              <details className="admin-nav-details" open={isActive}>
                <summary>{isActive ? "Open tools" : "View tools"}</summary>
                <div className="admin-nav-subnav">
                  {group.links.map((link) => (
                    <Link
                      className={`admin-nav-sublink ${currentPath === link.href ? "admin-nav-sublink-active" : ""}`}
                      href={link.href}
                      key={link.href}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
