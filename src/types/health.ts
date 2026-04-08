export type Severity = "low" | "medium" | "high";
export type FindingCategory =
  | "availability"
  | "links"
  | "seo"
  | "images"
  | "system";

export type HealthCheckType =
  | "homepage_availability"
  | "key_page_availability"
  | "broken_internal_link"
  | "missing_seo_metadata"
  | "missing_image";

export interface HealthFinding {
  id: string;
  severity: Severity;
  category: FindingCategory;
  type: HealthCheckType;
  pageUrl: string;
  message: string;
  details?: string;
  checkedAt: string;
}

export interface PageScanResult {
  url: string;
  status: number | null;
  available: boolean;
  title?: string;
  metaDescription?: string;
  internalLinks: string[];
  imageUrls: string[];
}

export interface HealthReport {
  checkedAt: string;
  baseUrl: string;
  findings: HealthFinding[];
}

export interface HealthReportStore {
  latest: HealthReport;
  history: HealthReport[];
}

export interface ProposedFix {
  id: string;
  issueTitle: string;
  severity: Severity;
  pageUrl: string;
  category: FindingCategory;
  recommendedFix: string;
  beforePreview: string;
  afterPreview: string;
  implementationNotes: string;
  sourceFindingId: string;
}

export interface ProposedFixReport {
  generatedAt: string;
  sourceCheckedAt: string;
  fixes: ProposedFix[];
}

export type ContentDraftType =
  | "homepage_hero"
  | "cta_section"
  | "faq_items"
  | "service_training_copy"
  | "puppy_listing_template"
  | "announcement_post";

export interface ContentDraft {
  id: string;
  title: string;
  contentType: ContentDraftType;
  purpose: string;
  targetAudience: string;
  draftText: string;
  ctaSuggestion?: string;
  notes: string;
}

export interface ContentDraftReport {
  generatedAt: string;
  drafts: ContentDraft[];
}

export type ConversionInsightCategory =
  | "messaging"
  | "cta"
  | "flow"
  | "trust"
  | "services"
  | "drop_off";

export interface ConversionInsight {
  id: string;
  category: ConversionInsightCategory;
  issueOrObservation: string;
  severity: Severity;
  pageUrl: string;
  recommendation: string;
  improvementExample: string;
}

export interface ConversionInsightReport {
  generatedAt: string;
  insights: ConversionInsight[];
}

export type ApprovalSourceType =
  | "proposed_fix"
  | "content_draft"
  | "conversion_insight";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface ApprovalState {
  itemId: string;
  sourceType: ApprovalSourceType;
  status: ApprovalStatus;
  updatedAt: string;
}

export interface ApprovalQueueItem {
  itemId: string;
  sourceType: ApprovalSourceType;
  status: ApprovalStatus;
  title: string;
  pageUrl?: string;
  severity?: Severity;
  categoryOrType: string;
  summary: string;
}

export interface ApprovalQueueReport {
  generatedAt: string;
  items: ApprovalQueueItem[];
}

export type ApplyStatus = "ready" | "applied" | "failed";

export interface ApplyResult {
  itemId: string;
  sourceType: "proposed_fix" | "content_draft";
  targetFile: string;
  changeSummary: string;
  patchPreview: string;
  status: ApplyStatus;
  updatedAt: string;
  message?: string;
}

export interface ApplyQueueItem {
  itemId: string;
  sourceType: "proposed_fix" | "content_draft";
  title: string;
  pageUrl?: string;
  suggestedTargetFile: string;
  changeSummary: string;
  patchPreview: string;
  status: ApplyStatus;
  message?: string;
}

export interface ApplyQueueReport {
  generatedAt: string;
  items: ApplyQueueItem[];
}

export type MergeStatus = "ready" | "applied" | "skipped" | "failed";

export interface MergeQueueItem {
  itemId: string;
  sourceType: "proposed_fix" | "content_draft";
  title: string;
  stagedFile: string;
  targetFile: string;
  changeSummary: string;
  diffPreview: string;
  status: MergeStatus;
  message?: string;
}

export interface MergeResult {
  itemId: string;
  sourceType: "proposed_fix" | "content_draft";
  targetFile: string;
  status: MergeStatus;
  diffPreview: string;
  updatedAt: string;
  message?: string;
}

export interface MergeQueueReport {
  generatedAt: string;
  items: MergeQueueItem[];
}

export type VerificationStatus =
  | "open"
  | "approved"
  | "applied"
  | "merged"
  | "verified_resolved"
  | "still_failing";

export interface VerificationHistoryEntry {
  status: VerificationStatus;
  checkedAt: string;
  notes: string;
}

export interface VerificationRecord {
  findingId: string;
  findingTitle: string;
  pageUrl: string;
  severity: Severity;
  status: VerificationStatus;
  lastCheckedAt: string;
  notes: string;
  history: VerificationHistoryEntry[];
}

export interface VerificationReport {
  generatedAt: string;
  records: VerificationRecord[];
}
