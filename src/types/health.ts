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

export type ContentDraftStatus =
  | "draft"
  | "approved"
  | "placed"
  | "published"
  | "consumed"
  | "archived";

export interface ContentDraft {
  id: string;
  batchId: string;
  status: ContentDraftStatus;
  createdAt: string;
  updatedAt: string;
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
  activeBatchId: string;
  drafts: ContentDraft[];
  publishedDrafts: ContentDraft[];
  consumedDrafts: ContentDraft[];
  archivedDrafts: ContentDraft[];
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
  | "puppy_listing"
  | "conversion_insight"
  | "optimization_insight"
  | "section_rewrite";

export type ApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "published"
  | "consumed";

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
  updatedAt?: string;
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

export type OptimizationInsightCategory =
  | "SEO"
  | "CTA"
  | "Trust"
  | "UX"
  | "Content";

export interface OptimizationInsight {
  id: string;
  issueTitle: string;
  category: OptimizationInsightCategory;
  severity: Severity;
  whyItMatters: string;
  recommendedImprovement: string;
  improvementExample: string;
}

export interface OptimizationInsightReport {
  generatedAt: string;
  pageUrl: string;
  insights: OptimizationInsight[];
}

export type RewriteSectionName =
  | "seo_title"
  | "meta_description"
  | "hero_headline"
  | "hero_supporting_paragraph"
  | "primary_cta_text";

export interface SectionRewriteDraft {
  id: string;
  sectionName: RewriteSectionName;
  sourceInsightTitle: string;
  currentWording?: string;
  improvedRewrite: string;
  reasonForRewrite: string;
  alternateVersion?: string;
}

export interface SectionRewriteReport {
  generatedAt: string;
  pageUrl: string;
  drafts: SectionRewriteDraft[];
}

export type OptimizationMergeStatus =
  | "ready"
  | "applied"
  | "skipped"
  | "unmatched"
  | "failed";

export interface OptimizationMergeItem {
  itemId: string;
  sourceType: "section_rewrite";
  title: string;
  sectionName: RewriteSectionName;
  targetFile: string;
  targetField: string;
  currentValue: string;
  proposedReplacement: string;
  diffPreview: string;
  status: OptimizationMergeStatus;
  message?: string;
}

export interface OptimizationMergeResult {
  itemId: string;
  sourceType: "section_rewrite";
  targetFile: string;
  targetField: string;
  status: OptimizationMergeStatus;
  diffPreview: string;
  updatedAt: string;
  message?: string;
}

export interface OptimizationMergeReport {
  generatedAt: string;
  items: OptimizationMergeItem[];
}

export interface DeployChangedFile {
  path: string;
  statusCode: string;
  summary: string;
}

export type DeployActionStatus = "idle" | "success" | "failed";

export interface DeployActionState {
  status: DeployActionStatus;
  message: string;
  updatedAt: string;
}

export interface DeployStatusReport {
  generatedAt: string;
  repoPath: string;
  currentBranch: string;
  gitStatusSummary: string;
  isClean: boolean;
  isAheadOfRemote: boolean;
  changedFiles: DeployChangedFile[];
  suggestedCommitMessage: string;
  commitStatus: DeployActionState;
  pushStatus: DeployActionState;
  publishStatus: DeployActionState;
  readyForVerification: boolean;
  lastPublishResult: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export type FaqPlacementStatus = "ready" | "applied" | "skipped" | "failed";

export interface FaqPlacementItem {
  itemId: string;
  sourceType: "content_draft";
  title: string;
  targetFile: string;
  currentFaqState: string;
  proposedFaqItems: FaqItem[];
  diffPreview: string;
  status: FaqPlacementStatus;
  message?: string;
}

export interface FaqPlacementReport {
  generatedAt: string;
  items: FaqPlacementItem[];
}

export type OperatorSuggestionSource =
  | "optimization_insight"
  | "section_rewrite"
  | "content_draft";

export interface OperatorHealthSummary {
  lastRunAt: string;
  issues: number;
  opportunities: number;
  verificationSummary: string;
  issueHighlights: string[];
  opportunityHighlights: string[];
}

export interface OperatorSuggestionItem {
  itemId: string;
  sourceType: OperatorSuggestionSource;
  status: ApprovalStatus;
  title: string;
  shortExplanation: string;
  preview?: string;
}

export interface OperatorApplyItem {
  itemId: string;
  sourceType: OperatorSuggestionSource;
  title: string;
  readiness: string;
}

export interface OperatorReleaseSummary {
  approvedItems: OperatorApplyItem[];
  changedFiles: DeployChangedFile[];
  status: "idle" | "success" | "failed";
  message: string;
}

export interface OperatorDashboardReport {
  generatedAt: string;
  health: OperatorHealthSummary;
  suggestions: {
    items: OperatorSuggestionItem[];
  };
  release: OperatorReleaseSummary;
}

export type PuppyListingAvailability = "available" | "reserved" | "sold";

export type PuppyListingDraftStatus =
  | "draft"
  | "approved"
  | "ready_for_placement"
  | "applied"
  | "deployed"
  | "live_on_site"
  | "active_on_site"
  | "sold_or_reserved"
  | "archived";

export interface PuppyListingImage {
  id: string;
  fileName: string;
  publicUrl: string;
  altText: string;
}

export interface PuppyListingDraft {
  id: string;
  batchId: string;
  status: PuppyListingDraftStatus;
  createdAt: string;
  updatedAt: string;
  puppyName: string;
  sex: string;
  age: string;
  litter: string;
  availability: PuppyListingAvailability;
  temperamentNotes: string;
  breederNotes: string;
  priceOrDeposit?: string;
  listingTitle: string;
  shortSummary: string;
  fullDescription: string;
  homepageCardCopy: string;
  suggestedSlug: string;
  images: PuppyListingImage[];
}

export interface PuppyListingReport {
  generatedAt: string;
  activeBatchId: string;
  drafts: PuppyListingDraft[];
  consumedDrafts: PuppyListingDraft[];
  archivedDrafts: PuppyListingDraft[];
}

export type PuppyPlacementStatus = "ready" | "applied" | "skipped" | "failed";

export interface PuppyPlacementItem {
  itemId: string;
  sourceType: "puppy_listing";
  title: string;
  targetFile: string;
  currentSectionState: string;
  listingPreview: string;
  diffPreview: string;
  status: PuppyPlacementStatus;
  updatedAt?: string;
  message?: string;
}

export interface PuppyPlacementReport {
  generatedAt: string;
  items: PuppyPlacementItem[];
}
