import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell">
      <div className="card">
        <p className="eyebrow">Patriot K9 Kennel</p>
        <h1>Kennel Agent System</h1>
        <p className="muted">
          Phase 3 includes health findings, proposed fixes, and draft content generation.
        </p>
        <Link className="button" href="/admin">
          Open admin dashboard
        </Link>
      </div>
    </main>
  );
}
