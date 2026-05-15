import Link from "next/link";

export function AdminNav({ currentPath }: { currentPath: string }) {
  const isActive = currentPath === "/admin";

  return (
    <nav className="admin-nav admin-nav-simple">
      <Link
        className={`admin-nav-link ${isActive ? "admin-nav-link-active" : ""}`}
        href="/admin"
      >
        Puppy Listings Admin
      </Link>
    </nav>
  );
}
