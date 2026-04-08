import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell">
      <div className="card">
        <p className="eyebrow">Patriot K9 Kennel</p>
        <h1>Kennel Agent System</h1>
        <p className="muted">
          Phase 2 includes the health agent plus a read-only proposed fixes workflow.
        </p>
        <Link className="button" href="/admin">
          Open admin dashboard
        </Link>
      </div>
    </main>
  );
}
