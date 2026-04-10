import * as cheerio from "cheerio";

import { SITE_URL } from "@/lib/config";
import {
  readApplyResults,
  readApprovalStates,
  readOptimizationInsightReport
} from "@/lib/storage";
import type {
  ApplyResult,
  OptimizationInsight,
  RewriteSectionName,
  SectionRewriteDraft,
  SectionRewriteReport
} from "@/types/health";

const rewriteDebugEnabled = process.env.KENNEL_HEALTH_DEBUG === "true";

function buildDraft(
  sectionName: RewriteSectionName,
  sourceInsightTitle: string,
  currentWording: string | undefined,
  improvedRewrite: string,
  reasonForRewrite: string,
  alternateVersion?: string
): SectionRewriteDraft {
  return {
    id: `${sectionName}-${sourceInsightTitle}`
      .replace(/[^a-zA-Z0-9-_:/.]/g, "-")
      .toLowerCase(),
    sectionName,
    sourceInsightTitle,
    currentWording,
    improvedRewrite,
    reasonForRewrite,
    alternateVersion
  };
}

async function fetchHomepageHtml(): Promise<string | null> {
  try {
    const response = await fetch(SITE_URL, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml"
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

function mapInsightToSection(insight: OptimizationInsight): RewriteSectionName | null {
  const title = `${insight.issueTitle} ${insight.recommendedImprovement}`.toLowerCase();

  if (title.includes("title")) {
    return "seo_title";
  }

  if (title.includes("meta description")) {
    return "meta_description";
  }

  if (title.includes("headline") || title.includes("h1")) {
    return "hero_headline";
  }

  if (title.includes("cta")) {
    return "primary_cta_text";
  }

  if (title.includes("faq")) {
    return "hero_supporting_paragraph";
  }

  if (title.includes("trust") || title.includes("flow") || title.includes("application")) {
    return "hero_supporting_paragraph";
  }

  return insight.category === "Content" ? "hero_headline" : null;
}

function isAppliedOrApprovedOptimizationInsight(
  insightId: string,
  approvedInsightIds: Set<string>,
  _applyResults: ApplyResult[]
): boolean {
  // Optimization insights currently move through approval state rather than the apply-results file.
  return approvedInsightIds.has(insightId);
}

function getMatchedInsight(
  sectionName: RewriteSectionName,
  insights: OptimizationInsight[]
): OptimizationInsight | undefined {
  return insights.find((insight) => mapInsightToSection(insight) === sectionName);
}

export async function runSectionRewriteAgent(): Promise<SectionRewriteReport> {
  // This agent converts applied approval decisions on optimization insights into concrete rewrite drafts.
  // If insight coverage is partial, it still generates a baseline rewrite set from the live homepage.
  const [optimizationReport, approvals, applyResults, html] = await Promise.all([
    readOptimizationInsightReport(),
    readApprovalStates(),
    readApplyResults(),
    fetchHomepageHtml()
  ]);

  const approvedInsightIds = new Set(
    approvals
      .filter(
        (state) =>
          state.sourceType === "optimization_insight" && state.status === "approved"
      )
      .map((state) => state.itemId)
  );

  const approvedInsights = optimizationReport.insights.filter((insight) =>
    isAppliedOrApprovedOptimizationInsight(insight.id, approvedInsightIds, applyResults)
  );

  if (rewriteDebugEnabled) {
    console.log("[SectionRewriteAgent]", {
      approvedInsightCount: approvedInsights.length,
      approvedInsightTitles: approvedInsights.map((insight) => insight.issueTitle)
    });
  }

  if (!html && optimizationReport.insights.length === 0) {
    return {
      generatedAt: new Date().toISOString(),
      pageUrl: SITE_URL,
      drafts: []
    };
  }

  const $ = cheerio.load(html ?? "");
  const currentTitle = $("title").first().text().trim();
  const currentMetaDescription =
    $('meta[name="description" i]').first().attr("content")?.trim() ?? "";
  const currentHeroHeadline = $("h1").first().text().replace(/\s+/g, " ").trim();
  const currentHeroSupportingParagraph = $("h1")
    .first()
    .parent()
    .find("p")
    .first()
    .text()
    .replace(/\s+/g, " ")
    .trim();
  const currentPrimaryCta = $("a, button")
    .map((_, element) => $(element).text().replace(/\s+/g, " ").trim())
    .get()
    .find((text) => /apply|start|contact|request|inquire/i.test(text));

  const sectionsToGenerate: RewriteSectionName[] = [
    "seo_title",
    "meta_description",
    "hero_headline",
    "hero_supporting_paragraph",
    "primary_cta_text"
  ];

  const drafts = sectionsToGenerate.map((sectionName) => {
    const matchedInsight = getMatchedInsight(sectionName, approvedInsights);

    switch (sectionName) {
      case "seo_title":
        return buildDraft(
          "seo_title",
          matchedInsight?.issueTitle ?? "Baseline homepage title rewrite",
          currentTitle || undefined,
          "Patriot K9 Kennel | German Shepherd Puppies and Structured Training",
          matchedInsight?.whyItMatters ??
            "A stronger homepage title can improve ranking clarity and click-through for breed and training searches.",
          "Patriot K9 Kennel | Puppy Applications and Training Support"
        );
      case "meta_description":
        return buildDraft(
          "meta_description",
          matchedInsight?.issueTitle ?? "Baseline meta description rewrite",
          currentMetaDescription || undefined,
          "Explore purpose-bred German Shepherd puppies, structured placement, and training support from Patriot K9 Kennel.",
          matchedInsight?.whyItMatters ??
            "A clearer description can improve click-through and set better expectations before visitors land on the homepage.",
          "Patriot K9 Kennel offers German Shepherd puppies, guided placement, and training support for serious homes."
        );
      case "hero_headline":
        return buildDraft(
          "hero_headline",
          matchedInsight?.issueTitle ?? "Baseline hero headline rewrite",
          currentHeroHeadline || undefined,
          "Purpose-Bred German Shepherd Puppies with Structured Placement and Training Support",
          matchedInsight?.whyItMatters ??
            "A stronger hero headline helps visitors understand the offer immediately and improves first-impression clarity.",
          "Confident German Shepherd Puppies Matched to the Right Home"
        );
      case "hero_supporting_paragraph":
        return buildDraft(
          "hero_supporting_paragraph",
          matchedInsight?.issueTitle ?? "Baseline hero support rewrite",
          currentHeroSupportingParagraph || undefined,
          "Patriot K9 Kennel helps serious homes find the right German Shepherd through structured placement, clear standards, and training support that continues after pickup day.",
          matchedInsight?.whyItMatters ??
            "Supporting copy should build trust quickly and explain why the visitor should keep reading or apply.",
          "We focus on matching each German Shepherd puppy to the right home with guidance, accountability, and long-term support."
        );
      case "primary_cta_text":
        return buildDraft(
          "primary_cta_text",
          matchedInsight?.issueTitle ?? "Baseline primary CTA rewrite",
          currentPrimaryCta || undefined,
          "Apply for the Right Puppy Match",
          matchedInsight?.whyItMatters ??
            "A clearer CTA can reduce hesitation and make the next step feel more relevant to the visitor’s goal.",
          "Start Your Puppy Application"
        );
    }
  });

  if (rewriteDebugEnabled) {
    console.log("[SectionRewriteAgent]", {
      generatedSections: drafts.map((draft) => draft.sectionName)
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    pageUrl: SITE_URL,
    drafts
  };
}
