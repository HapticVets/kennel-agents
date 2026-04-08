import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell">
      <div className="card">
        <p className="eyebrow">Patriot K9 Kennel</p>
        <h1>Kennel Agent System</h1>
        <p className="muted">
          Phase 1 includes a small admin dashboard and a read-only health agent.
        </p>
        <Link className="button" href="/admin">
          Open admin dashboard
        </Link>
      </div>
    </main>
  );
}
