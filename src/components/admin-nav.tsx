import Link from "next/link";

export function AdminNav({ currentPath }: { currentPath: string }) {
  return (
    <nav className="admin-nav">
      <Link
        className={`admin-nav-link ${currentPath === "/admin" ? "admin-nav-link-active" : ""}`}
        href="/admin"
      >
        Health findings
      </Link>
      <Link
        className={`admin-nav-link ${currentPath === "/admin/proposed-fixes" ? "admin-nav-link-active" : ""}`}
        href="/admin/proposed-fixes"
      >
        Proposed fixes
      </Link>
      <Link
        className={`admin-nav-link ${currentPath === "/admin/content-drafts" ? "admin-nav-link-active" : ""}`}
        href="/admin/content-drafts"
      >
        Content drafts
      </Link>
      <Link
        className={`admin-nav-link ${currentPath === "/admin/conversion-insights" ? "admin-nav-link-active" : ""}`}
        href="/admin/conversion-insights"
      >
        Conversion insights
      </Link>
      <Link
        className={`admin-nav-link ${currentPath === "/admin/approvals" ? "admin-nav-link-active" : ""}`}
        href="/admin/approvals"
      >
        Approvals
      </Link>
    </nav>
  );
}
