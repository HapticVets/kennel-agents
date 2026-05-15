/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";

import { AdminNav } from "@/components/admin-nav";
import type {
  PuppyListingRecord,
  PuppyListingsStore,
  PuppyListingStatus
} from "@/types/health";

const emptyStore: PuppyListingsStore = {
  updatedAt: "",
  listings: []
};

type PuppyFormState = {
  puppyName: string;
  litterName: string;
  sex: string;
  color: string;
  birthDate: string;
  readyDate: string;
  price: string;
  status: PuppyListingStatus;
  shortDescription: string;
  imagePath: string;
  goodDogLink: string;
};

const emptyFormState: PuppyFormState = {
  puppyName: "",
  litterName: "",
  sex: "",
  color: "",
  birthDate: "",
  readyDate: "",
  price: "",
  status: "available",
  shortDescription: "",
  imagePath: "",
  goodDogLink: ""
};

const statusLabels: Record<PuppyListingStatus, string> = {
  available: "Available",
  reserved: "Reserved",
  sold: "Sold"
};

function isPuppyListingsStore(
  value: PuppyListingsStore | { error?: string }
): value is PuppyListingsStore {
  return "listings" in value && Array.isArray(value.listings);
}

export default function AdminDashboardPage() {
  const [store, setStore] = useState<PuppyListingsStore>(emptyStore);
  const [formState, setFormState] = useState<PuppyFormState>(emptyFormState);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);

  useEffect(() => {
    void loadListings();
  }, []);

  async function loadListings() {
    setLoading(true);

    try {
      const response = await fetch("/api/puppy-listings", { cache: "no-store" });
      const data = (await response.json()) as PuppyListingsStore | { error?: string };

      if (!isPuppyListingsStore(data)) {
        setErrorMessage(data.error || "Unable to load puppy listings.");
        return;
      }

      setStore(data);
    } finally {
      setLoading(false);
    }
  }

  function updateField<Key extends keyof PuppyFormState>(key: Key, value: PuppyFormState[Key]) {
    setFormState((current) => ({
      ...current,
      [key]: value
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage("");
    setStatusMessage("");

    try {
      const payload = new FormData();
      payload.set("puppyName", formState.puppyName);
      payload.set("litterName", formState.litterName);
      payload.set("sex", formState.sex);
      payload.set("color", formState.color);
      payload.set("birthDate", formState.birthDate);
      payload.set("readyDate", formState.readyDate);
      payload.set("price", formState.price);
      payload.set("status", formState.status);
      payload.set("shortDescription", formState.shortDescription);
      payload.set("imagePath", formState.imagePath);
      payload.set("goodDogLink", formState.goodDogLink);

      if (selectedImageFile) {
        payload.set("imageFile", selectedImageFile);
      }

      const response = await fetch("/api/puppy-listings", {
        method: "POST",
        body: payload
      });
      const data = (await response.json()) as PuppyListingsStore | { error?: string };

      if (!response.ok || !isPuppyListingsStore(data)) {
        setErrorMessage(
          (!isPuppyListingsStore(data) && data.error) || "Unable to save the puppy listing."
        );
        return;
      }

      setStore(data);
      setFormState(emptyFormState);
      setSelectedImageFile(null);
      setStatusMessage("Puppy listing saved.");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteListing(itemId: string) {
    const confirmed = window.confirm(
      "Delete this puppy listing permanently from the local JSON file?"
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(itemId);
    setErrorMessage("");
    setStatusMessage("");

    try {
      const response = await fetch(`/api/puppy-listings?itemId=${encodeURIComponent(itemId)}`, {
        method: "DELETE"
      });
      const data = (await response.json()) as PuppyListingsStore | { error?: string };

      if (!response.ok || !isPuppyListingsStore(data)) {
        setErrorMessage(
          (!isPuppyListingsStore(data) && data.error) || "Unable to delete the puppy listing."
        );
        return;
      }

      setStore(data);
      setStatusMessage("Puppy listing deleted.");
    } finally {
      setDeletingId("");
    }
  }

  function renderListingCard(listing: PuppyListingRecord) {
    return (
      <article className="finding-card" key={listing.id}>
        <div className="finding-topline">
          <span className={`badge badge-${listing.status}`}>{statusLabels[listing.status]}</span>
          <span className="finding-type">{listing.litterName}</span>
        </div>
        <div className="card-actions">
          <button
            className="button approval-button approval-button-secondary"
            disabled={deletingId === listing.id}
            onClick={() => deleteListing(listing.id)}
            type="button"
          >
            {deletingId === listing.id ? "Deleting..." : "Delete"}
          </button>
        </div>
        <h3>{listing.puppyName}</h3>
        <div className="fix-content">
          <p className="muted">
            {listing.sex || "Sex not set"} • {listing.color || "Color not set"} •{" "}
            {listing.price || "Price not set"}
          </p>
          <p className="muted">
            Birth date: {listing.birthDate || "Not set"} • Ready date:{" "}
            {listing.readyDate || "Not set"}
          </p>
          <p className="muted">{listing.shortDescription}</p>
          {listing.imagePath ? (
            <img
              alt={listing.puppyName}
              className="image-preview"
              src={listing.imagePath}
            />
          ) : null}
          {listing.goodDogLink ? (
            <p>
              <a href={listing.goodDogLink} rel="noreferrer" target="_blank">
                View GoodDog listing
              </a>
            </p>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <main className="shell">
      <section className="dashboard-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Puppy Listings Admin</h1>
          <p className="muted">
            Add and manage local puppy listings from one simple page.
          </p>
        </div>
      </section>

      <AdminNav currentPath="/admin" />

      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
      {statusMessage ? <p className="muted">{statusMessage}</p> : null}

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Add puppy listing</h2>
            <p className="muted">
              This form writes directly to the local JSON file used by the admin.
            </p>
          </div>
        </div>

        <form className="intake-form" onSubmit={handleSubmit}>
          <div className="intake-grid">
            <label className="approval-filter">
              Puppy name
              <input
                className="text-input"
                onChange={(event) => updateField("puppyName", event.target.value)}
                required
                type="text"
                value={formState.puppyName}
              />
            </label>
            <label className="approval-filter">
              Litter name
              <input
                className="text-input"
                onChange={(event) => updateField("litterName", event.target.value)}
                required
                type="text"
                value={formState.litterName}
              />
            </label>
            <label className="approval-filter">
              Sex
              <input
                className="text-input"
                onChange={(event) => updateField("sex", event.target.value)}
                required
                type="text"
                value={formState.sex}
              />
            </label>
            <label className="approval-filter">
              Color
              <input
                className="text-input"
                onChange={(event) => updateField("color", event.target.value)}
                type="text"
                value={formState.color}
              />
            </label>
            <label className="approval-filter">
              Birth date
              <input
                className="text-input"
                onChange={(event) => updateField("birthDate", event.target.value)}
                type="date"
                value={formState.birthDate}
              />
            </label>
            <label className="approval-filter">
              Ready date
              <input
                className="text-input"
                onChange={(event) => updateField("readyDate", event.target.value)}
                type="date"
                value={formState.readyDate}
              />
            </label>
            <label className="approval-filter">
              Price
              <input
                className="text-input"
                onChange={(event) => updateField("price", event.target.value)}
                type="text"
                value={formState.price}
              />
            </label>
            <label className="approval-filter">
              Status
              <select
                className="text-input"
                onChange={(event) =>
                  updateField("status", event.target.value as PuppyListingStatus)
                }
                value={formState.status}
              >
                <option value="available">Available</option>
                <option value="reserved">Reserved</option>
                <option value="sold">Sold</option>
              </select>
            </label>
            <label className="approval-filter">
              Upload puppy image
              <input
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                className="text-input"
                onChange={(event) => setSelectedImageFile(event.target.files?.[0] ?? null)}
                type="file"
              />
            </label>
            <label className="approval-filter">
              Optional image URL or path
              <input
                className="text-input"
                onChange={(event) => updateField("imagePath", event.target.value)}
                type="text"
                value={formState.imagePath}
              />
            </label>
            <label className="approval-filter">
              Optional GoodDog link
              <input
                className="text-input"
                onChange={(event) => updateField("goodDogLink", event.target.value)}
                type="url"
                value={formState.goodDogLink}
              />
            </label>
          </div>

          <label className="approval-filter">
            Short description
            <textarea
              className="text-area"
              onChange={(event) => updateField("shortDescription", event.target.value)}
              required
              rows={4}
              value={formState.shortDescription}
            />
          </label>

          {selectedImageFile ? (
            <p className="muted">
              Selected image: {selectedImageFile.name}
            </p>
          ) : null}

          <button className="button" disabled={submitting} type="submit">
            {submitting ? "Saving..." : "Add puppy listing"}
          </button>
        </form>
      </section>

      <section className="card" style={{ marginTop: 24 }}>
        <div className="section-heading">
          <div>
            <h2>Current puppy listings</h2>
            <p className="muted">
              {store.updatedAt
                ? `Last updated: ${new Date(store.updatedAt).toLocaleString()}`
                : "No puppy listings have been saved yet."}
            </p>
          </div>
        </div>

        {loading ? <p className="muted">Loading puppy listings...</p> : null}

        {!loading && store.listings.length === 0 ? (
          <p className="muted">
            No puppy listings exist yet. Add one with the form above.
          </p>
        ) : null}

        {!loading && store.listings.length > 0 ? (
          <div className="finding-list">{store.listings.map(renderListingCard)}</div>
        ) : null}
      </section>
    </main>
  );
}
