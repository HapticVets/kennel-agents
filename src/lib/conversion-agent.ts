import * as cheerio from "cheerio";

import { MAX_PAGES, SITE_URL } from "@/lib/config";
import type {
  ConversionInsight,
  ConversionInsightCategory,
  ConversionInsightReport,
  Severity
} from "@/types/health";

interface PageSnapshot {
  url: string;
  title: string;
  text: string;
  headings: string[];
  hasPrimaryCta: boolean;
  ctaTexts: string[];
  hasTestimonials: boolean;
  hasTrustTerms: boolean;
  hasServiceTerms: boolean;
}

function buildInsight(
  category: ConversionInsightCategory,
  issueOrObservation: string,
  severity: Severity,
  pageUrl: string,
  recommendation: string,
  improvementExample: string
): ConversionInsight {
  return {
    id: `${category}-${pageUrl}-${issueOrObservation}`
      .replace(/[^a-zA-Z0-9-_:/.]/g, "-")
      .toLowerCase(),
    category,
    issueOrObservation,
    severity,
    pageUrl,
    recommendation,
    improvementExample
  };
}

function normalizeInternalUrl(href: string, baseUrl: string): string | null {
  try {
    const url = new URL(href, baseUrl);

    if (url.origin !== new URL(SITE_URL).origin) {
      return null;
    }

    url.hash = "";
    if (url.pathname.endsWith("/") && url.pathname !== "/") {
      url.pathname = url.pathname.slice(0, -1);
    }

    return url.toString();
  } catch {
    return null;
  }
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "KennelConversionAgent/0.1"
      },
      cache: "no-store"
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return null;
    }

    return await response.text();
  } catch {
    return null;
  }
}

async function collectPages(): Promise<PageSnapshot[]> {
  const homepageHtml = await fetchHtml(SITE_URL);
  if (!homepageHtml) {
    return [];
  }

  const $home = cheerio.load(homepageHtml);
  const internalLinks = Array.from(
    new Set(
      $home("a[href]")
        .map((_, element) =>
          normalizeInternalUrl($home(element).attr("href") ?? "", SITE_URL)
        )
        .get()
        .filter((value): value is string => Boolean(value))
    )
  )
    .filter((url) => url !== SITE_URL && url !== `${SITE_URL}/`)
    .slice(0, Math.max(MAX_PAGES - 1, 0));

  const urls = [SITE_URL, ...internalLinks];
  const snapshots: PageSnapshot[] = [];

  // The conversion agent is structure-based, so it only needs a small sample of internal pages.
  for (const url of urls) {
    const html = await fetchHtml(url);
    if (!html) {
      continue;
    }

    const $ = cheerio.load(html);
    const text = $("body").text().replace(/\s+/g, " ").trim();
    const headings = $("h1, h2, h3")
      .map((_, element) => $(element).text().trim())
      .get()
      .filter(Boolean);
    const ctaTexts = $("a, button")
      .map((_, element) => $(element).text().trim())
      .get()
      .filter(Boolean)
      .filter((label) =>
        /contact|book|learn more|view|start|get started|inquire|call|request/i.test(label)
      );

    const lowerText = text.toLowerCase();

    snapshots.push({
      url,
      title: $("title").first().text().trim(),
      text,
      headings,
      hasPrimaryCta: ctaTexts.length > 0,
      ctaTexts,
      hasTestimonials: /testimonial|review|client|success story/i.test(text),
      hasTrustTerms: /years|experience|trusted|professional|certified|proven/i.test(text),
      hasServiceTerms: /training|puppy|puppies|obedience|board and train|services/i.test(text)
    });
  }

  return snapshots;
}

export async function runConversionAgent(): Promise<ConversionInsightReport> {
  const pages = await collectPages();
  const insights: ConversionInsight[] = [];
  const homepage = pages.find((page) => page.url === SITE_URL);

  if (!homepage) {
    return {
      generatedAt: new Date().toISOString(),
      insights: [
        buildInsight(
          "flow",
          "Homepage could not be analyzed for conversion structure.",
          "high",
          SITE_URL,
          "Confirm the homepage loads successfully before relying on conversion insights.",
          "Example improvement: restore a working homepage response, then rerun the conversion agent."
        )
      ]
    };
  }

  if (homepage.headings.length < 2 || homepage.text.length < 250) {
    insights.push(
      buildInsight(
        "messaging",
        "Homepage messaging appears thin or lacks a clear structure at the top of the page.",
        "high",
        homepage.url,
        "Lead with a stronger headline and supporting copy that quickly explains what the kennel offers.",
        "Example improvement: 'Patriot K9 Kennel offers practical dog training, puppy guidance, and structured support for owners who want confident, reliable dogs.'"
      )
    );
  } else {
    insights.push(
      buildInsight(
        "messaging",
        "Homepage has enough visible copy to support a clear first impression, but it should still prioritize a single core value proposition.",
        "low",
        homepage.url,
        "Keep the top section tightly focused on what you do, who it helps, and what action the visitor should take next.",
        "Example improvement: shorten the first section into one headline, one support paragraph, and one clear CTA."
      )
    );
  }

  if (!homepage.hasPrimaryCta) {
    insights.push(
      buildInsight(
        "cta",
        "Homepage does not appear to present a strong visible call to action.",
        "high",
        homepage.url,
        "Add a primary button near the top of the homepage that points visitors toward inquiry or services.",
        "Example improvement: add a top-of-page CTA such as 'Request Training Info' or 'Ask About Puppies'."
      )
    );
  } else {
    insights.push(
      buildInsight(
        "cta",
        `Homepage shows CTA language such as: ${homepage.ctaTexts.slice(0, 3).join(", ")}.`,
        "low",
        homepage.url,
        "Keep CTA wording specific and repeat it after major content sections.",
        "Example improvement: reuse the strongest CTA label in the hero and again after the services section."
      )
    );
  }

  if (homepage.headings.length < 3) {
    insights.push(
      buildInsight(
        "flow",
        "Homepage structure may be too shallow to guide visitors from introduction to action.",
        "medium",
        homepage.url,
        "Use a clearer content flow: hero, services, trust signals, FAQ, then CTA.",
        "Example improvement: add a services section and a testimonial block before the main contact CTA."
      )
    );
  }

  if (!pages.some((page) => page.hasTestimonials || page.hasTrustTerms)) {
    insights.push(
      buildInsight(
        "trust",
        "The sampled pages show weak visible trust signals such as testimonials, credentials, or experience markers.",
        "high",
        homepage.url,
        "Add social proof and credibility cues to reassure first-time visitors.",
        "Example improvement: include a testimonials block, years of experience statement, or a short credibility summary."
      )
    );
  } else {
    insights.push(
      buildInsight(
        "trust",
        "Some credibility language is present, but it may need stronger placement near decision points.",
        "medium",
        homepage.url,
        "Move the strongest trust signals closer to the hero, services, or inquiry sections.",
        "Example improvement: add a testimonial or credibility bar directly below the hero."
      )
    );
  }

  if (!pages.some((page) => page.hasServiceTerms)) {
    insights.push(
      buildInsight(
        "services",
        "Service categories are not clearly reinforced across the sampled pages.",
        "high",
        homepage.url,
        "Name the main service lines clearly so visitors can immediately see whether you offer training, puppies, or related support.",
        "Example improvement: add homepage sections titled 'Dog Training', 'Available Puppies', and 'How to Get Started'."
      )
    );
  } else {
    insights.push(
      buildInsight(
        "services",
        "Service-related language exists, but visitors may still benefit from clearer segmentation between training, puppies, and inquiry paths.",
        "medium",
        homepage.url,
        "Separate major service categories with distinct headings and CTA paths.",
        "Example improvement: use separate cards for training programs and puppy inquiries, each with its own CTA."
      )
    );
  }

  const pagesWithoutCtas = pages.filter((page) => !page.hasPrimaryCta);
  if (pagesWithoutCtas.length > 0) {
    insights.push(
      buildInsight(
        "drop_off",
        "Some internal pages may create drop-off risk because they lack visible next-step prompts.",
        "medium",
        pagesWithoutCtas[0].url,
        "Add a relevant CTA at the end of informational sections so visitors are not left without direction.",
        "Example improvement: end service or FAQ sections with a prompt like 'Contact us to discuss the right fit for your dog.'"
      )
    );
  } else {
    insights.push(
      buildInsight(
        "drop_off",
        "The sampled pages show at least some CTA presence, which helps reduce obvious drop-off risk.",
        "low",
        homepage.url,
        "Review whether CTA wording is repeated at the right moments instead of only appearing once.",
        "Example improvement: add a second CTA after the FAQ or testimonial section to catch users who scroll deeper."
      )
    );
  }

  return {
    generatedAt: new Date().toISOString(),
    insights
  };
}
