export type Severity = "low" | "medium" | "high";

export type HealthCheckType =
  | "homepage_availability"
  | "key_page_availability"
  | "broken_internal_link"
  | "missing_seo_metadata"
  | "missing_image";

export interface HealthFinding {
  id: string;
  severity: Severity;
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
