import * as cheerio from "cheerio";

import { MAX_KEY_PAGES, MAX_LINK_CHECKS, SITE_URL } from "@/lib/config";
import type {
  HealthFinding,
  HealthReport,
  PageScanResult,
  Severity
} from "@/types/health";

function buildFinding(
  type: HealthFinding["type"],
  severity: Severity,
  pageUrl: string,
  message: string,
  checkedAt: string,
  details?: string
): HealthFinding {
  return {
    id: `${type}-${pageUrl}-${message}`.replace(/[^a-zA-Z0-9-_:/.]/g, "-"),
    severity,
    type,
    pageUrl,
    message,
    details,
    checkedAt
  };
}

function isInternalUrl(url: URL): boolean {
  return url.origin === new URL(SITE_URL).origin;
}

function normalizeUrl(href: string, baseUrl: string): string | null {
  try {
    const url = new URL(href, baseUrl);

    if (!isInternalUrl(url)) {
      return null;
    }

    url.hash = "";

    const normalizedPath = url.pathname.endsWith("/") && url.pathname !== "/"
      ? url.pathname.slice(0, -1)
      : url.pathname;

    url.pathname = normalizedPath || "/";
    return url.toString();
  } catch {
    return null;
  }
}

async function fetchPage(url: string): Promise<{
  status: number | null;
  html: string | null;
}> {
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "KennelHealthAgent/0.1"
      },
      cache: "no-store"
    });

    const contentType = response.headers.get("content-type") ?? "";
    const html = contentType.includes("text/html") ? await response.text() : null;

    return {
      status: response.status,
      html
    };
  } catch {
    return {
      status: null,
      html: null
    };
  }
}

async function scanPage(url: string): Promise<PageScanResult> {
  const { status, html } = await fetchPage(url);

  if (!html || !status || status >= 400) {
    return {
      url,
      status,
      available: Boolean(status && status < 400),
      internalLinks: [],
      imageUrls: []
    };
  }

  const $ = cheerio.load(html);

  const internalLinks = $("a[href]")
    .map((_, element) => normalizeUrl($(element).attr("href") ?? "", url))
    .get()
    .filter((value): value is string => Boolean(value));

  // We preserve empty src values so the agent can explicitly flag them later.
  const imageUrls = $("img")
    .map((_, element) => {
      const src = $(element).attr("src");
      return src ? normalizeUrl(src, url) ?? src : "";
    })
    .get();

  return {
    url,
    status,
    available: true,
    title: $("title").first().text().trim(),
    metaDescription: $('meta[name="description"]').attr("content")?.trim(),
    internalLinks: Array.from(new Set(internalLinks)),
    imageUrls
  };
}

async function checkImageAvailability(
  imageUrl: string
): Promise<{ ok: boolean; status: number | null }> {
  try {
    const response = await fetch(imageUrl, {
      method: "HEAD",
      headers: {
        "user-agent": "KennelHealthAgent/0.1"
      },
      cache: "no-store"
    });

    return {
      ok: response.ok,
      status: response.status
    };
  } catch {
    return {
      ok: false,
      status: null
    };
  }
}

export async function runKennelHealthAgent(): Promise<HealthReport> {
  const checkedAt = new Date().toISOString();
  const findings: HealthFinding[] = [];

  // Phase 1 starts from the homepage and fans out to a very small internal sample.
  // That keeps scans quick and predictable while we prove the structure.
  const homepage = await scanPage(SITE_URL);

  if (!homepage.available) {
    findings.push(
      buildFinding(
        "homepage_availability",
        "high",
        SITE_URL,
        "Homepage is unavailable.",
        checkedAt,
        homepage.status ? `Received HTTP ${homepage.status}.` : "Request failed."
      )
    );

    return {
      checkedAt,
      baseUrl: SITE_URL,
      findings
    };
  }

  const keyPages = homepage.internalLinks
    .filter((url) => url !== SITE_URL && url !== `${SITE_URL}/`)
    .slice(0, MAX_KEY_PAGES);

  const pagesToScan = [SITE_URL, ...keyPages];
  const scannedPages = await Promise.all(pagesToScan.map((url) => scanPage(url)));

  for (const page of scannedPages) {
    if (!page.available) {
      findings.push(
        buildFinding(
          page.url === SITE_URL ? "homepage_availability" : "key_page_availability",
          "high",
          page.url,
          "Page is unavailable.",
          checkedAt,
          page.status ? `Received HTTP ${page.status}.` : "Request failed."
        )
      );
      continue;
    }

    if (!page.title) {
      findings.push(
        buildFinding(
          "missing_seo_metadata",
          "medium",
          page.url,
          "Page title is missing.",
          checkedAt
        )
      );
    }

    if (!page.metaDescription) {
      findings.push(
        buildFinding(
          "missing_seo_metadata",
          "low",
          page.url,
          "Meta description is missing.",
          checkedAt
        )
      );
    }
  }

  // Internal link validation is capped so the dashboard remains responsive.
  const linksToCheck = Array.from(
    new Set(scannedPages.flatMap((page) => page.internalLinks))
  ).slice(0, MAX_LINK_CHECKS);

  const linkResults = await Promise.all(
    linksToCheck.map(async (url) => ({
      url,
      result: await fetchPage(url)
    }))
  );

  for (const link of linkResults) {
    if (!link.result.status || link.result.status >= 400) {
      findings.push(
        buildFinding(
          "broken_internal_link",
          "high",
          link.url,
          "Internal link appears broken.",
          checkedAt,
          link.result.status
            ? `Received HTTP ${link.result.status}.`
            : "Request failed."
        )
      );
    }
  }

  for (const page of scannedPages) {
    const emptyImageSources = page.imageUrls.filter((imageUrl) => !imageUrl.trim());

    for (const _ of emptyImageSources) {
      findings.push(
        buildFinding(
          "missing_image",
          "medium",
          page.url,
          "Image tag is missing a usable source.",
          checkedAt
        )
      );
    }

    const internalImages = page.imageUrls
      .filter((imageUrl) => imageUrl.startsWith(SITE_URL))
      .slice(0, 10);

    const imageResults = await Promise.all(
      internalImages.map(async (imageUrl) => ({
        imageUrl,
        result: await checkImageAvailability(imageUrl)
      }))
    );

    for (const image of imageResults) {
      if (!image.result.ok) {
        findings.push(
          buildFinding(
            "missing_image",
            "medium",
            page.url,
            "Image appears to be missing or unavailable.",
            checkedAt,
            `${image.imageUrl} returned ${image.result.status ?? "no response"}.`
          )
        );
      }
    }
  }

  return {
    checkedAt,
    baseUrl: SITE_URL,
    findings
  };
}
