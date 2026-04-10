"use client";

import Link from "next/link";

import { AdminNav } from "@/components/admin-nav";

export default function PuppyPlacementPage() {
  return (
    <main className="shell">
      <section className="dashboard-header">
        <div>
          <p className="eyebrow">Admin Dashboard</p>
          <h1>Puppy Placement</h1>
          <p className="muted">
            This legacy placement step is no longer used for puppy listings.
          </p>
        </div>
      </section>

      <AdminNav currentPath="/admin/puppy-listings" />

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Puppy listings are now API-driven</h2>
            <p className="muted">
              Approved puppy listings are returned from /api/public/puppy-listings
              and rendered by the public site directly. You no longer need to
              apply listings into the homepage or publish a site file change for
              inventory updates.
            </p>
          </div>
          <Link className="button" href="/admin/puppy-listings">
            Manage Puppy Listings
          </Link>
        </div>
      </section>
    </main>
  );
}
