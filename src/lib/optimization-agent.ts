import * as cheerio from "cheerio";

import { SITE_URL } from "@/lib/config";
import type {
  OptimizationInsight,
  OptimizationInsightCategory,
  OptimizationInsightReport,
  Severity
} from "@/types/health";

function buildInsight(
  issueTitle: string,
  category: OptimizationInsightCategory,
  severity: Severity,
  whyItMatters: string,
  recommendedImprovement: string,
  improvementExample: string
): OptimizationInsight {
  return {
    id: `${category}-${issueTitle}`.replace(/[^a-zA-Z0-9-_:/.]/g, "-").toLowerCase(),
    issueTitle,
    category,
    severity,
    whyItMatters,
    recommendedImprovement,
    improvementExample
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

export async function runOptimizationAgent(): Promise<OptimizationInsightReport> {
  // This agent focuses on a single live homepage audit and produces read-only improvement ideas.
  const html = await fetchHomepageHtml();

  if (!html) {
    return {
      generatedAt: new Date().toISOString(),
      pageUrl: SITE_URL,
      insights: [
        buildInsight(
          "Homepage could not be loaded for optimization review",
          "UX",
          "high",
          "Without a readable homepage response, the optimization agent cannot judge ranking or conversion opportunities accurately.",
          "Confirm the live homepage is reachable to the agent before relying on optimization insights.",
          "Example improvement: restore a successful HTML response and rerun the optimization audit."
        )
      ]
    };
  }

  const $ = cheerio.load(html);
  const title = $("title").first().text().trim();
  const metaDescription = $('meta[name="description" i]').first().attr("content")?.trim() ?? "";
  const h1 = $("h1").first().text().replace(/\s+/g, " ").trim();
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const ctaTexts = $("a, button")
    .map((_, element) => $(element).text().replace(/\s+/g, " ").trim())
    .get()
    .filter(Boolean)
    .filter((text) =>
      /apply|start|contact|request|learn more|view|training|puppy|inquire/i.test(text)
    );

  const insights: OptimizationInsight[] = [];

  if (!title || title.length < 25 || title.length > 65) {
    insights.push(
      buildInsight(
        "Homepage title may be weak for search visibility",
        "SEO",
        "high",
        "A title that is missing, too short, or too long can reduce relevance and click-through performance in search results.",
        "Use a title that clearly combines brand, offering, and buyer intent in a concise format.",
        "Example improvement: Das Muller German Shepherds | Puppies, Training, and Structured Placement"
      )
    );
  } else {
    insights.push(
      buildInsight(
        "Homepage title exists but could be sharpened for higher-intent search terms",
        "SEO",
        "low",
        "Even a valid title can underperform if it does not align closely with what prospective buyers and training clients search for.",
        "Keep the title specific to puppies, training, and the strongest location or value signals.",
        "Example improvement: Das Muller German Shepherds | Puppy Applications and Training Support"
      )
    );
  }

  if (!metaDescription || metaDescription.length < 120 || metaDescription.length > 160) {
    insights.push(
      buildInsight(
        "Meta description may not be optimized for click-through",
        "SEO",
        "medium",
        "Search users often rely on the description to decide whether to click, so weak length or clarity can lower engagement.",
        "Write a concise description that explains the homepage offer and why a visitor should act.",
        "Example improvement: Purpose-bred German Shepherd puppies, structured placement, and training support for serious homes ready to apply."
      )
    );
  }

  if (!h1 || h1.length < 20) {
    insights.push(
      buildInsight(
        "Main homepage headline may be too vague or too short",
        "Content",
        "high",
        "The H1 is often the clearest statement of what the site offers, so weak language can hurt both clarity and conversions.",
        "Strengthen the headline so a first-time visitor immediately understands the offer and audience fit.",
        "Example improvement: Purpose-Bred German Shepherd Puppies with Structured Placement and Training Support"
      )
    );
  }

  if (!/german shepherd|puppy|training/i.test(`${title} ${metaDescription} ${h1}`)) {
    insights.push(
      buildInsight(
        "Homepage keyword relevance may be too weak in core SEO fields",
        "SEO",
        "high",
        "If the page title, description, and H1 do not reinforce target keywords, the homepage may underperform for relevant searches.",
        "Align the title, meta description, and H1 around the strongest service and breed terms.",
        "Example improvement: repeat core terms such as German Shepherd puppies, training, and placement naturally across the hero."
      )
    );
  }

  if (ctaTexts.length < 2) {
    insights.push(
      buildInsight(
        "Homepage CTAs may not be visible enough or varied enough",
        "CTA",
        "medium",
        "Visitors often need a clear next step quickly, and weak CTA density can reduce inquiry or application rates.",
        "Use a stronger primary CTA near the hero and repeat a supporting CTA deeper on the page.",
        "Example improvement: pair 'Apply for a Puppy' with 'Start Training' and repeat one of them after the programs section."
      )
    );
  } else {
    insights.push(
      buildInsight(
        "CTA language is present but can be made more outcome-focused",
        "CTA",
        "low",
        "Clear CTA wording helps visitors understand the value of clicking rather than just the action itself.",
        "Refine CTA labels to connect the action with the visitor’s goal.",
        "Example improvement: change a generic CTA to 'Apply for the Right Puppy Match' or 'Start Structured Training'."
      )
    );
  }

  if (!/testimonial|review|trusted|experience|veteran|mission/i.test(bodyText)) {
    insights.push(
      buildInsight(
        "Trust signals may be too light for high-consideration visitors",
        "Trust",
        "high",
        "Puppy buyers and training clients usually need reassurance before applying, so weak trust signals can reduce conversions.",
        "Add stronger credibility elements near the hero or application path.",
        "Example improvement: include a short trust strip with placement standards, experience, or client feedback."
      )
    );
  }

  if (!/programs|mission|application/i.test(bodyText)) {
    insights.push(
      buildInsight(
        "Section order and user flow may not guide visitors from interest to action",
        "UX",
        "medium",
        "A homepage should move users through clarity, trust, and next-step action without forcing them to interpret the structure.",
        "Use a predictable flow from hero to services, trust, FAQs, and application CTA.",
        "Example improvement: reorder sections as Hero, Available Litters, Programs, Trust/Mission, FAQ, Application."
      )
    );
  }

  if (/application/i.test(bodyText) && bodyText.length > 2500) {
    insights.push(
      buildInsight(
        "Application flow may feel heavy before enough reassurance is established",
        "UX",
        "medium",
        "If visitors hit a long application flow too early, they may drop off before building confidence in the brand and offer.",
        "Add stronger trust and expectation-setting copy before the application section or break the form into a softer pre-qualification path.",
        "Example improvement: add a short 'What to expect before applying' section above the form."
      )
    );
  }

  return {
    generatedAt: new Date().toISOString(),
    pageUrl: SITE_URL,
    insights
  };
}
