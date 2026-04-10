import * as cheerio from "cheerio";
import { chromium } from "playwright";

import { MAX_LINK_CHECKS, MAX_PAGES, SITE_URL } from "@/lib/config";
import type {
  HealthFinding,
  FindingCategory,
  HealthReport,
  PageScanResult,
  Severity
} from "@/types/health";

const seoDebugEnabled = process.env.KENNEL_HEALTH_DEBUG === "true";
const browserUserAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36";
const browserAcceptHeader = "text/html,application/xhtml+xml";
const homepageRetryAttempts = 3;

function getCategory(type: HealthFinding["type"]): FindingCategory {
  switch (type) {
    case "homepage_availability":
    case "key_page_availability":
      return "availability";
    case "broken_internal_link":
      return "links";
    case "missing_seo_metadata":
      return "seo";
    case "missing_image":
      return "images";
    default:
      return "system";
  }
}

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
    category: getCategory(type),
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
  finalUrl?: string;
  contentType?: string;
  provider?: "playwright" | "fetch";
  error?: string;
}> {
  const playwrightResult = await fetchPageWithPlaywright(url);

  if (playwrightResult) {
    return playwrightResult;
  }

  return fetchPageWithFetch(url);
}

async function fetchPageWithPlaywright(url: string): Promise<{
  status: number | null;
  html: string | null;
  finalUrl?: string;
  contentType?: string;
  provider: "playwright";
  error?: string;
} | null> {
  try {
    const browser = await chromium.launch({
      headless: true
    });
    const context = await browser.newContext({
      userAgent: browserUserAgent
    });
    const page = await context.newPage();
    const response = await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 30000
    });

    const html = await page.content();
    const finalUrl = page.url();
    const status = response?.status() ?? 200;
    const contentType = response?.headers()["content-type"] ?? "text/html";

    if (seoDebugEnabled) {
      const $ = cheerio.load(html);
      const seoFields = extractSeoFields(html, $);

      console.log("[KennelHealthAgent][Fetch]", {
        provider: "playwright",
        requestedUrl: url,
        finalUrl,
        status,
        contentType,
        bodyPreview: html.slice(0, 500) ?? ""
      });

      console.log("[KennelHealthAgent][SEOProvider]", {
        provider: "playwright",
        finalUrl,
        detectedTitle: seoFields.title ?? "",
        detectedMetaDescription: seoFields.metaDescription ?? ""
      });
    }

    await page.close();
    await context.close();
    await browser.close();

    return {
      status,
      html,
      finalUrl,
      contentType,
      provider: "playwright"
    };
  } catch (error) {
    if (seoDebugEnabled) {
      console.log("[KennelHealthAgent][PlaywrightFallback]", {
        requestedUrl: url,
        error: error instanceof Error ? error.message : "Unknown Playwright error."
      });
    }

    return null;
  }
}

async function fetchPageWithFetch(url: string): Promise<{
  status: number | null;
  html: string | null;
  finalUrl?: string;
  contentType?: string;
  provider: "fetch";
  error?: string;
}> {
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": browserUserAgent,
        accept: browserAcceptHeader
      },
      cache: "no-store"
    });

    const contentType = response.headers.get("content-type") ?? "";
    let html = contentType.includes("text/html") ? await response.text() : null;
    let finalUrl = response.url;
    let finalStatus = response.status;
    let finalContentType = contentType;

    const redirectTarget = html ? detectJavaScriptRedirect(html, finalUrl) : null;

    if (redirectTarget) {
      if (seoDebugEnabled) {
        console.log("[KennelHealthAgent][Redirect]", {
          requestedUrl: url,
          detectedRedirectTarget: redirectTarget
        });
      }

      const redirectedResponse = await fetch(redirectTarget, {
        headers: {
          "user-agent": browserUserAgent,
          accept: browserAcceptHeader
        },
        cache: "no-store"
      });

      finalContentType = redirectedResponse.headers.get("content-type") ?? "";
      html = finalContentType.includes("text/html")
        ? await redirectedResponse.text()
        : null;
      finalUrl = redirectedResponse.url;
      finalStatus = redirectedResponse.status;

      if (seoDebugEnabled) {
        console.log("[KennelHealthAgent][RedirectFetch]", {
          redirectedFetchUrl: finalUrl,
          redirectedFetchStatus: finalStatus
        });
      }
    }

    if (seoDebugEnabled) {
      const $ = html ? cheerio.load(html) : cheerio.load("");
      const seoFields = html ? extractSeoFields(html, $) : {};

      console.log("[KennelHealthAgent][Fetch]", {
        provider: "fetch",
        requestedUrl: url,
        finalUrl,
        status: finalStatus,
        contentType: finalContentType,
        bodyPreview: html?.slice(0, 500) ?? ""
      });

      console.log("[KennelHealthAgent][SEOProvider]", {
        provider: "fetch",
        finalUrl,
        detectedTitle: seoFields.title ?? "",
        detectedMetaDescription: seoFields.metaDescription ?? ""
      });
    }

    return {
      status: finalStatus,
      html,
      finalUrl,
      contentType: finalContentType,
      provider: "fetch"
    };
  } catch (error) {
    return {
      status: null,
      html: null,
      provider: "fetch",
      error: error instanceof Error ? error.message : "Unknown request error."
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
  const seoFields = extractSeoFields(html, $);

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
    title: seoFields.title,
    metaDescription: seoFields.metaDescription,
    internalLinks: Array.from(new Set(internalLinks)),
    imageUrls
  };
}

function detectJavaScriptRedirect(html: string, baseUrl: string): string | null {
  const redirectPatterns = [
    /window\.location\.href\s*=\s*["']([^"']+)["']/i,
    /window\.location\s*=\s*["']([^"']+)["']/i,
    /location\.href\s*=\s*["']([^"']+)["']/i
  ];

  for (const pattern of redirectPatterns) {
    const match = html.match(pattern);

    if (!match?.[1]) {
      continue;
    }

    try {
      return new URL(match[1], baseUrl).toString();
    } catch {
      return null;
    }
  }

  return null;
}

function extractSeoFields(
  html: string,
  $: cheerio.CheerioAPI
): { title?: string; metaDescription?: string } {
  // First try DOM-based extraction, then fall back to raw HTML parsing when selectors miss.
  const domTitle = $("title").first().text().trim();
  const domMetaDescription = $('meta[name="description" i]')
    .first()
    .attr("content")
    ?.trim();

  const title = domTitle || extractTitleFromHtml(html);
  const metaDescription = domMetaDescription || extractMetaDescriptionFromHtml(html);

  if (seoDebugEnabled) {
    console.log("[KennelHealthAgent][SEO]", {
      titleFound: Boolean(title),
      metaDescriptionFound: Boolean(metaDescription),
      title,
      metaDescription
    });
  }

  return {
    title: title || undefined,
    metaDescription: metaDescription || undefined
  };
}

function extractTitleFromHtml(html: string): string {
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return titleMatch?.[1]?.replace(/\s+/g, " ").trim() ?? "";
}

function extractMetaDescriptionFromHtml(html: string): string {
  const metaTagPattern = /<meta\b[^>]*>/gi;
  const metaTags = html.match(metaTagPattern) ?? [];

  for (const tag of metaTags) {
    const nameMatch =
      tag.match(/\bname\s*=\s*"([^"]*)"/i) ??
      tag.match(/\bname\s*=\s*'([^']*)'/i) ??
      tag.match(/\bname\s*=\s*([^\s"'=/>]+)/i);

    if (!nameMatch || nameMatch[1].trim().toLowerCase() !== "description") {
      continue;
    }

    const contentMatch =
      tag.match(/\bcontent\s*=\s*"([^"]*)"/i) ??
      tag.match(/\bcontent\s*=\s*'([^']*)'/i) ??
      tag.match(/\bcontent\s*=\s*([^\s"'=/>]+)/i);

    if (contentMatch?.[1]) {
      return contentMatch[1].replace(/\s+/g, " ").trim();
    }
  }

  return "";
}

async function checkImageAvailability(
  imageUrl: string
): Promise<{ ok: boolean; status: number | null; error?: string }> {
  try {
    const response = await fetch(imageUrl, {
      method: "HEAD",
      headers: {
        "user-agent": browserUserAgent
      },
      cache: "no-store"
    });

    return {
      ok: response.ok,
      status: response.status
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      error: error instanceof Error ? error.message : "Unknown image request error."
    };
  }
}

export async function runKennelHealthAgent(): Promise<HealthReport> {
  const checkedAt = new Date().toISOString();
  const findings: HealthFinding[] = [];

  // Phase 1 starts from the homepage and fans out to a very small internal sample.
  // That keeps scans quick and predictable while we prove the structure.
  const homepage = await scanHomepageWithRetries();

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
    .slice(0, Math.max(MAX_PAGES - 1, 0));

  const pagesToScan = [SITE_URL, ...keyPages];
  const scannedPages: PageScanResult[] = [];

  // Individual page failures should surface as findings instead of ending the scan.
  for (const url of pagesToScan) {
    try {
      scannedPages.push(await scanPage(url));
    } catch (error) {
      findings.push(
        buildFinding(
          url === SITE_URL ? "homepage_availability" : "key_page_availability",
          "high",
          url,
          "Page scan failed unexpectedly.",
          checkedAt,
          error instanceof Error ? error.message : "Unknown scan error."
        )
      );
    }
  }

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
            : link.result.error ?? "Request failed."
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
          image.result.status
            ? `${image.imageUrl} returned ${image.result.status}.`
            : `${image.imageUrl} failed: ${image.result.error ?? "no response"}.`
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

async function scanHomepageWithRetries(): Promise<PageScanResult> {
  let lastResult: PageScanResult | null = null;
  let lastFailureReason = "Unknown homepage failure.";

  for (let attempt = 1; attempt <= homepageRetryAttempts; attempt += 1) {
    if (seoDebugEnabled) {
      console.log("[KennelHealthAgent][HomepageRetry]", {
        attempt,
        maxAttempts: homepageRetryAttempts,
        url: SITE_URL
      });
    }

    try {
      const result = await scanPage(SITE_URL);
      lastResult = result;

      if (result.available) {
        return result;
      }

      lastFailureReason = result.status
        ? `Received HTTP ${result.status}.`
        : "Request failed.";

      const shouldRetry =
        attempt < homepageRetryAttempts &&
        (!result.status || result.status >= 500 || result.status === 403);

      if (!shouldRetry) {
        break;
      }
    } catch (error) {
      lastFailureReason =
        error instanceof Error ? error.message : "Unknown homepage scan error.";

      if (attempt === homepageRetryAttempts) {
        break;
      }
    }
  }

  if (seoDebugEnabled) {
    console.log("[KennelHealthAgent][HomepageFailure]", {
      url: SITE_URL,
      attempts: homepageRetryAttempts,
      finalFailureReason: lastFailureReason
    });
  }

  return (
    lastResult ?? {
      url: SITE_URL,
      status: null,
      available: false,
      internalLinks: [],
      imageUrls: []
    }
  );
}
