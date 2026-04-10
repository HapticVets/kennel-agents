// Central place for Phase 1 configuration so the agent is easy to evolve later.
// Use www domain for stability (avoids apex SSL + bot detection issues)
export const SITE_URL = "https://www.patriotk9kennel.com";
export const TARGET_SITE_PATH =
  process.env.TARGET_SITE_PATH || "C:\\Users\\jrees\\das-muller-website";
// Hosted mode disables local-only release tooling that depends on a desktop repo path.
export const IS_HOSTED_MODE =
  process.env.VERCEL === "1" || process.env.KENNEL_HOSTED_MODE === "true";

// We keep the crawl intentionally small for a high-confidence first phase.
export const MAX_PAGES = 6;
export const MAX_KEY_PAGES = 5;
export const MAX_LINK_CHECKS = 20;
export const MAX_SCAN_HISTORY = 10;
