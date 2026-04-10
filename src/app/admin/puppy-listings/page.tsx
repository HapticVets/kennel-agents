"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { AdminNav } from "@/components/admin-nav";
import type {
  PuppyListingAvailability,
  PuppyListingDraft,
  PuppyListingDraftStatus,
  PuppyListingImage,
  PuppyListingReport
} from "@/types/health";

const emptyReport: PuppyListingReport = {
  generatedAt: "",
  activeBatchId: "",
  drafts: [],
  consumedDrafts: [],
  archivedDrafts: []
};

const availabilityLabels: Record<PuppyListingAvailability, string> = {
  available: "Available",
  reserved: "Reserved",
  sold: "Sold"
};

const statusLabels: Record<PuppyListingDraftStatus, string> = {
  draft: "Draft",
  approved: "Approved",
  ready_for_placement: "Approved",
  applied: "Approved",
  deployed: "Approved",
  live_on_site: "Live on site",
  active_on_site: "Live on site",
  sold_or_reserved: "Live on site",
  archived: "Archived"
};

type PuppyManageAction =
  | "archive"
  | "restore"
  | "delete"
  | "publish"
  | "mark_sold_or_reserved";

type PuppyFormState = {
  puppyName: string;
  sex: string;
  age: string;
  litter: string;
  availability: PuppyListingAvailability;
  temperamentNotes: string;
  breederNotes: string;
  priceOrDeposit: string;
};

const emptyFormState: PuppyFormState = {
  puppyName: "",
  sex: "",
  age: "",
  litter: "",
  availability: "available",
  temperamentNotes: "",
  breederNotes: "",
  priceOrDeposit: ""
};

function listingToFormState(draft: PuppyListingDraft): PuppyFormState {
  return {
    puppyName: draft.puppyName,
    sex: draft.sex,
    age: draft.age,
    litter: draft.litter,
    availability: draft.availability,
    temperamentNotes: draft.temperamentNotes,
    breederNotes: draft.breederNotes,
    priceOrDeposit: draft.priceOrDeposit ?? ""
  };
}

export default function PuppyListingsPage() {
  const [report, setReport] = useState<PuppyListingReport>(emptyReport);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pendingActionKey, setPendingActionKey] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [editingId, setEditingId] = useState("");
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);
  const [formState, setFormState] = useState<PuppyFormState>(emptyFormState);

  useEffect(() => {
    void loadPageData();
  }, []);

  useEffect(() => {
    const urls = selectedImages.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [selectedImages]);

  async function loadPageData() {
    try {
      const response = await fetch("/api/puppy-listings", { cache: "no-store" });
      const reportData = (await response.json()) as PuppyListingReport | { error: string };

      if ("error" in reportData) {
        setErrorMessage(reportData.error);
        return;
      }

      setReport(reportData);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEditingId("");
    setFormState(emptyFormState);
    setRemovedImageIds([]);
    setSelectedImages([]);
  }

  function startEditing(draft: PuppyListingDraft) {
    setEditingId(draft.id);
    setFormState(listingToFormState(draft));
    setRemovedImageIds([]);
    setSelectedImages([]);
    setErrorMessage("");
    setStatusMessage("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage("");
    setStatusMessage("");

    try {
      const formData = new FormData();
      formData.set("puppyName", formState.puppyName);
      formData.set("sex", formState.sex);
      formData.set("age", formState.age);
      formData.set("litter", formState.litter);
      formData.set("availability", formState.availability);
      formData.set("temperamentNotes", formState.temperamentNotes);
      formData.set("breederNotes", formState.breederNotes);
      formData.set("priceOrDeposit", formState.priceOrDeposit);

      if (editingId) {
        formData.set("listingId", editingId);
        removedImageIds.forEach((imageId) => formData.append("removedImageIds", imageId));
      }

      selectedImages.forEach((file) => {
        formData.append("images", file);
      });

      const response = await fetch("/api/puppy-listings", {
        method: editingId ? "PUT" : "POST",
        body: formData
      });
      const data = (await response.json()) as PuppyListingReport | { error: string };

      if ("error" in data) {
        setErrorMessage(data.error);
        return;
      }

      setReport(data);
      setStatusMessage(
        editingId
          ? "Puppy listing updated."
          : "Puppy listing draft generated."
      );
      resetForm();
    } finally {
      setSubmitting(false);
    }
  }

  async function updateApproval(itemId: string, status: "approved" | "rejected") {
    const key = `${itemId}-${status}`;
    setPendingActionKey(key);
    setErrorMessage("");
    setStatusMessage("");

    try {
      const response = await fetch("/api/puppy-listings/approve", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          itemId,
          status
        })
      });
      const data = (await response.json()) as PuppyListingReport | { error: string };

      if ("error" in data) {
        setErrorMessage(data.error);
        return;
      }

      setReport(data);
      setStatusMessage(
        status === "approved"
          ? "Puppy listing approved. Publish it from the listing card when you are ready for it to appear on the site."
          : "Puppy listing rejected and moved out of the active queue."
      );
    } finally {
      setPendingActionKey("");
    }
  }

  async function manageListing(itemId: string, action: PuppyManageAction) {
    if (action === "delete") {
      const confirmed = window.confirm(
        "Delete this puppy listing permanently from storage? Uploaded image files will be kept."
      );

      if (!confirmed) {
        return;
      }
    }

    const key = `${itemId}-${action}`;
    setPendingActionKey(key);
    setErrorMessage("");
    setStatusMessage("");

    try {
      const response = await fetch("/api/puppy-listings/manage", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          itemId,
          action
        })
      });
      const data = (await response.json()) as PuppyListingReport | { error: string };

      if ("error" in data) {
        setErrorMessage(data.error);
        return;
      }

      setReport(data);

      const actionMessages: Record<PuppyManageAction, string> = {
        archive: "Puppy listing archived and removed from the public feed.",
        restore: "Puppy listing restored to approved status.",
        delete: "Puppy listing deleted from storage.",
        publish: "Puppy listing published and now available through the public feed.",
        mark_sold_or_reserved:
          "Puppy listing availability updated in the public feed."
      };

      setStatusMessage(actionMessages[action]);

      if (editingId === itemId && action === "delete") {
        resetForm();
      }
    } finally {
      setPendingActionKey("");
    }
  }

  const currentEditingListing = useMemo(
    () =>
      [...report.drafts, ...report.archivedDrafts].find((draft) => draft.id === editingId),
    [editingId, report.archivedDrafts, report.drafts]
  );

  const visibleExistingImages = useMemo(
    () =>
      (currentEditingListing?.images ?? []).filter(
        (image) => !removedImageIds.includes(image.id)
      ),
    [currentEditingListing, removedImageIds]
  );

  const intakeListings = useMemo(
    () => report.drafts.filter((draft) => draft.status === "draft"),
    [report.drafts]
  );
  const approvedListings = useMemo(
    () =>
      report.drafts.filter(
        (draft) =>
          draft.status === "approved" ||
          draft.status === "ready_for_placement" ||
          draft.status === "applied" ||
          draft.status === "deployed"
      ),
    [report.drafts]
  );
  const liveListings = useMemo(
    () =>
      report.drafts.filter(
        (draft) =>
          draft.status === "live_on_site" ||
          draft.status === "active_on_site" ||
          draft.status === "sold_or_reserved"
      ),
    [report.drafts]
  );

  function toggleRemovedImage(imageId: string) {
    setRemovedImageIds((current) =>
      current.includes(imageId)
        ? current.filter((id) => id !== imageId)
        : [...current, imageId]
    );
  }

  function renderActionBar(draft: PuppyListingDraft) {
    const editButton = (
      <button
        className="button approval-button approval-button-secondary"
        onClick={() => startEditing(draft)}
        type="button"
      >
        Edit
      </button>
    );

    if (draft.status === "draft") {
      return (
        <div className="approval-actions">
          {editButton}
          <button
            className="button approval-button approval-button-secondary"
            disabled={pendingActionKey === `${draft.id}-delete`}
            onClick={() => manageListing(draft.id, "delete")}
            type="button"
          >
            {pendingActionKey === `${draft.id}-delete` ? "Deleting..." : "Delete"}
          </button>
          <button
            className="button approval-button"
            disabled={pendingActionKey === `${draft.id}-approved`}
            onClick={() => updateApproval(draft.id, "approved")}
            type="button"
          >
            {pendingActionKey === `${draft.id}-approved` ? "Approving..." : "Approve"}
          </button>
        </div>
      );
    }

    if (
      draft.status === "approved" ||
      draft.status === "ready_for_placement" ||
      draft.status === "applied" ||
      draft.status === "deployed"
    ) {
      return (
        <div className="approval-actions">
          {editButton}
          <button
            className="button approval-button approval-button-secondary"
            disabled={pendingActionKey === `${draft.id}-delete`}
            onClick={() => manageListing(draft.id, "delete")}
            type="button"
          >
            {pendingActionKey === `${draft.id}-delete` ? "Deleting..." : "Delete"}
          </button>
          <button
            className="button approval-button"
            disabled={pendingActionKey === `${draft.id}-publish`}
            onClick={() => manageListing(draft.id, "publish")}
            type="button"
          >
            {pendingActionKey === `${draft.id}-publish` ? "Publishing..." : "Publish"}
          </button>
        </div>
      );
    }

    if (
      draft.status === "live_on_site" ||
      draft.status === "active_on_site" ||
      draft.status === "sold_or_reserved"
    ) {
      return (
        <div className="approval-actions">
          {editButton}
          <button
            className="button approval-button approval-button-secondary"
            disabled={pendingActionKey === `${draft.id}-archive`}
            onClick={() => manageListing(draft.id, "archive")}
            type="button"
          >
            {pendingActionKey === `${draft.id}-archive` ? "Archiving..." : "Archive"}
          </button>
          <button
            className="button approval-button approval-button-secondary"
            disabled={pendingActionKey === `${draft.id}-delete`}
            onClick={() => manageListing(draft.id, "delete")}
            type="button"
          >
            {pendingActionKey === `${draft.id}-delete` ? "Deleting..." : "Delete"}
          </button>
          <button
            className="button approval-button"
            disabled={pendingActionKey === `${draft.id}-mark_sold_or_reserved`}
            onClick={() => manageListing(draft.id, "mark_sold_or_reserved")}
            type="button"
          >
            {pendingActionKey === `${draft.id}-mark_sold_or_reserved`
              ? "Updating..."
              : "Mark Sold / Reserved"}
          </button>
        </div>
      );
    }

    if (draft.status === "archived") {
      return (
        <div className="approval-actions">
          {editButton}
          <button
            className="button approval-button"
            disabled={pendingActionKey === `${draft.id}-restore`}
            onClick={() => manageListing(draft.id, "restore")}
            type="button"
          >
            {pendingActionKey === `${draft.id}-restore` ? "Restoring..." : "Restore"}
          </button>
          <button
            className="button approval-button approval-button-secondary"
            disabled={pendingActionKey === `${draft.id}-delete`}
            onClick={() => manageListing(draft.id, "delete")}
            type="button"
          >
            {pendingActionKey === `${draft.id}-delete` ? "Deleting..." : "Delete"}
          </button>
        </div>
      );
    }

    return null;
  }

  function renderListingCard(draft: PuppyListingDraft) {
    return (
      <article className="finding-card" key={draft.id}>
        <div className="finding-topline">
          <span className={`badge badge-${draft.status}`}>{statusLabels[draft.status]}</span>
          <span className="badge badge-info">{availabilityLabels[draft.availability]}</span>
          <span className="finding-type">{draft.suggestedSlug}</span>
        </div>

        {renderActionBar(draft)}

        <h3>{draft.listingTitle}</h3>

        <div className="puppy-listing-grid">
          <div className="fix-content">
            <div>
              <strong>Structured puppy info</strong>
              <p className="muted">
                {draft.puppyName} • {draft.sex} • {draft.age} • {draft.litter} •{" "}
                {availabilityLabels[draft.availability]}
              </p>
              {draft.priceOrDeposit ? (
                <p className="muted">Price or deposit: {draft.priceOrDeposit}</p>
              ) : null}
            </div>
            <div>
              <strong>Short summary</strong>
              <p className="muted">{draft.shortSummary}</p>
            </div>
            <div>
              <strong>Full description</strong>
              <p className="muted draft-text">{draft.fullDescription}</p>
            </div>
            <div>
              <strong>Homepage card copy</strong>
              <p className="muted">{draft.homepageCardCopy}</p>
            </div>
            <div>
              <strong>Temperament notes</strong>
              <p className="muted">{draft.temperamentNotes}</p>
            </div>
            <div>
              <strong>Breeder notes</strong>
              <p className="muted">{draft.breederNotes}</p>
            </div>
          </div>

          <div className="fix-content">
            <div>
              <strong>Uploaded images</strong>
              <div className="image-preview-grid">
                {draft.images.map((image) => (
                  <div className="image-preview-card" key={image.id}>
                    <Image
                      alt={image.altText}
                      className="image-preview"
                      height={220}
                      src={image.publicUrl}
                      unoptimized
                      width={220}
                    />
                    <p className="muted image-caption">{image.altText}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <main className="shell">
      <section className="dashboard-header">
        <div>
          <p className="eyebrow">Admin Dashboard</p>
          <h1>Puppy Listings</h1>
          <p className="muted">
            Intake puppy details and photos, generate polished listing copy, and manage public puppy inventory directly from the puppy store.
          </p>
        </div>
      </section>

      <AdminNav currentPath="/admin/puppy-listings" />

      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
      {statusMessage ? <p className="muted">{statusMessage}</p> : null}

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>{editingId ? "Edit puppy listing" : "New puppy listing intake"}</h2>
            <p className="muted">
              The generator polishes only the notes you provide. It does not invent unsupported claims about temperament, working ability, or service suitability.
            </p>
          </div>
          {editingId ? (
            <button
              className="button approval-button approval-button-secondary"
              onClick={resetForm}
              type="button"
            >
              Cancel edit
            </button>
          ) : null}
        </div>

        <form className="intake-form" onSubmit={handleSubmit}>
          <div className="intake-grid">
            <label className="approval-filter">
              Puppy name or ID
              <input
                className="text-input"
                onChange={(event) =>
                  setFormState((current) => ({ ...current, puppyName: event.target.value }))
                }
                required
                type="text"
                value={formState.puppyName}
              />
            </label>
            <label className="approval-filter">
              Sex
              <input
                className="text-input"
                onChange={(event) =>
                  setFormState((current) => ({ ...current, sex: event.target.value }))
                }
                required
                type="text"
                value={formState.sex}
              />
            </label>
            <label className="approval-filter">
              Age
              <input
                className="text-input"
                onChange={(event) =>
                  setFormState((current) => ({ ...current, age: event.target.value }))
                }
                required
                type="text"
                value={formState.age}
              />
            </label>
            <label className="approval-filter">
              Litter
              <input
                className="text-input"
                onChange={(event) =>
                  setFormState((current) => ({ ...current, litter: event.target.value }))
                }
                required
                type="text"
                value={formState.litter}
              />
            </label>
            <label className="approval-filter">
              Status
              <select
                className="text-input"
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    availability: event.target.value as PuppyListingAvailability
                  }))
                }
                value={formState.availability}
              >
                <option value="available">Available</option>
                <option value="reserved">Reserved</option>
                <option value="sold">Sold</option>
              </select>
            </label>
            <label className="approval-filter">
              Optional price or deposit
              <input
                className="text-input"
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    priceOrDeposit: event.target.value
                  }))
                }
                type="text"
                value={formState.priceOrDeposit}
              />
            </label>
          </div>

          <label className="approval-filter">
            Temperament notes
            <textarea
              className="text-area"
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  temperamentNotes: event.target.value
                }))
              }
              required
              rows={4}
              value={formState.temperamentNotes}
            />
          </label>

          <label className="approval-filter">
            Breeder notes
            <textarea
              className="text-area"
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  breederNotes: event.target.value
                }))
              }
              required
              rows={4}
              value={formState.breederNotes}
            />
          </label>

          {editingId ? (
            <div className="fix-content">
              <div>
                <strong>Existing images</strong>
                <p className="muted">
                  Remove any image you do not want to keep. New uploads will be appended.
                </p>
              </div>
              <div className="image-preview-grid">
                {visibleExistingImages.map((image: PuppyListingImage) => (
                  <div className="image-preview-card" key={image.id}>
                    <Image
                      alt={image.altText}
                      className="image-preview"
                      height={180}
                      src={image.publicUrl}
                      unoptimized
                      width={180}
                    />
                    <p className="muted image-caption">{image.altText}</p>
                    <button
                      className="button approval-button approval-button-secondary"
                      onClick={() => toggleRemovedImage(image.id)}
                      type="button"
                    >
                      Remove image
                    </button>
                  </div>
                ))}
              </div>
              {removedImageIds.length > 0 ? (
                <p className="muted">
                  {removedImageIds.length} image{removedImageIds.length === 1 ? "" : "s"} marked for removal.
                </p>
              ) : null}
            </div>
          ) : null}

          <label className="approval-filter">
            {editingId ? "Add more puppy images" : "Puppy images"}
            <input
              accept="image/*"
              className="text-input"
              multiple
              onChange={(event) => setSelectedImages(Array.from(event.target.files ?? []))}
              required={!editingId}
              type="file"
            />
          </label>

          {previewUrls.length > 0 ? (
            <div className="image-preview-grid">
              {previewUrls.map((url) => (
                <div className="image-preview-card" key={url}>
                  <img alt="Selected puppy upload preview" className="image-preview" src={url} />
                </div>
              ))}
            </div>
          ) : null}

          <button className="button" disabled={submitting} type="submit">
            {submitting
              ? editingId
                ? "Saving changes..."
                : "Generating listing..."
              : editingId
                ? "Save listing changes"
                : "Generate puppy listing"}
          </button>
        </form>
      </section>

      <section className="card" style={{ marginTop: 24 }}>
        <div className="section-heading">
          <div>
            <h2>Puppy workflow</h2>
            <p className="muted">
              Approve a draft after review, then publish it from the listing card when it should appear on the public site.
            </p>
          </div>
        </div>

        {loading ? <p className="muted">Loading puppy listings...</p> : null}

        {!loading &&
        intakeListings.length === 0 &&
        approvedListings.length === 0 &&
        liveListings.length === 0 &&
        report.archivedDrafts.length === 0 ? (
          <p className="muted">
            No puppy listings exist yet. Submit the intake form to create the first listing.
          </p>
        ) : null}

        {!loading && intakeListings.length > 0 ? (
          <section className="finding-group">
            <div className="group-heading">
              <h3>Draft intake</h3>
              <span className="group-count">{intakeListings.length}</span>
            </div>
            <div className="finding-list">{intakeListings.map(renderListingCard)}</div>
          </section>
        ) : null}

        {!loading && approvedListings.length > 0 ? (
          <section className="finding-group" style={{ marginTop: 24 }}>
            <div className="group-heading">
              <h3>Approved</h3>
              <span className="group-count">{approvedListings.length}</span>
            </div>
            <div className="finding-list">{approvedListings.map(renderListingCard)}</div>
          </section>
        ) : null}

        {!loading && liveListings.length > 0 ? (
          <section className="finding-group" style={{ marginTop: 24 }}>
            <div className="group-heading">
              <h3>Live on site</h3>
              <span className="group-count">{liveListings.length}</span>
            </div>
            <div className="finding-list">{liveListings.map(renderListingCard)}</div>
          </section>
        ) : null}

        {!loading && report.archivedDrafts.length > 0 ? (
          <section className="finding-group" style={{ marginTop: 24 }}>
            <div className="group-heading">
              <h3>Archived</h3>
              <span className="group-count">{report.archivedDrafts.length}</span>
            </div>
            <div className="finding-list">{report.archivedDrafts.map(renderListingCard)}</div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
