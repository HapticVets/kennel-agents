import { readHealthReportStore } from "@/lib/storage";
import type {
  HealthFinding,
  ProposedFix,
  ProposedFixReport
} from "@/types/health";

function buildFixFromFinding(finding: HealthFinding): ProposedFix {
  const baseFix: Omit<
    ProposedFix,
    | "recommendedFix"
    | "beforePreview"
    | "afterPreview"
    | "implementationNotes"
  > = {
    id: `${finding.id}-draft-fix`,
    issueTitle: finding.message,
    severity: finding.severity,
    pageUrl: finding.pageUrl,
    category: finding.category,
    sourceFindingId: finding.id
  };

  switch (finding.type) {
    case "homepage_availability":
    case "key_page_availability":
      return {
        ...baseFix,
        recommendedFix:
          "Review the route, hosting response, and upstream dependencies so the page returns a successful HTML response.",
        beforePreview:
          "Current state: the page request fails or returns a non-success status.",
        afterPreview:
          "Expected state: the page loads successfully with an HTTP 200-level response and visible content.",
        implementationNotes:
          "Check the route or page file, verify any redirects, and confirm the page can render without runtime errors."
      };
    case "broken_internal_link":
      return {
        ...baseFix,
        recommendedFix:
          "Update the internal link target so it points to a valid existing page or add the missing destination page.",
        beforePreview:
          "Current state: an internal link points to a URL that returns an error or cannot be reached.",
        afterPreview:
          "Expected state: the internal link resolves to a valid destination and loads successfully.",
        implementationNotes:
          "Search for anchor tags or navigation data that reference this URL, then either correct the href or implement the missing route."
      };
    case "missing_seo_metadata":
      if (finding.message.toLowerCase().includes("title")) {
        return {
          ...baseFix,
          recommendedFix:
            "Add a descriptive page title that clearly reflects the page purpose and kennel offering.",
          beforePreview:
            "Before: the page renders without a meaningful <title> tag.",
          afterPreview:
            "After: the page includes a clear, unique title in the document metadata.",
          implementationNotes:
            "Update the page metadata export or head configuration in the matching Next.js route."
        };
      }

      return {
        ...baseFix,
        recommendedFix:
          "Add a concise meta description that explains the page content and encourages clicks from search results.",
        beforePreview:
          "Before: the page has no meta description content for search engines or social previews.",
        afterPreview:
          "After: the page includes a concise, unique meta description.",
        implementationNotes:
          "Update the Next.js metadata export for the page and keep the description aligned with the visible content."
      };
    case "missing_image":
      return {
        ...baseFix,
        recommendedFix:
          "Replace the missing or broken image reference with a valid asset path and confirm the file is available.",
        beforePreview:
          "Current state: the image source is empty or the image URL fails to load.",
        afterPreview:
          "Expected state: the page references a valid image asset that loads successfully.",
        implementationNotes:
          "Check the image src in the component or content source, verify the asset path, and confirm the file exists in the expected location."
      };
    default:
      return {
        ...baseFix,
        recommendedFix:
          "Review the issue details and update the page implementation to resolve the reported problem.",
        beforePreview: "Current state: the page contains a reported issue.",
        afterPreview: "Expected state: the issue is resolved and the page passes the related health check.",
        implementationNotes:
          "Use the finding details as the starting point and update the relevant page or component carefully."
      };
  }
}

export async function runFixDraftAgent(): Promise<ProposedFixReport> {
  // Phase 2 stays read-only: we transform the latest findings into human-reviewable draft fixes.
  const healthStore = await readHealthReportStore();
  const latestReport = healthStore.latest;

  const fixes = latestReport.findings.map((finding) => buildFixFromFinding(finding));

  return {
    generatedAt: new Date().toISOString(),
    sourceCheckedAt: latestReport.checkedAt,
    fixes
  };
}
