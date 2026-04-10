import type {
  ContentDraft,
  ContentDraftReport,
  ContentDraftType
} from "@/types/health";

const siteName = "Patriot K9 Kennel";

function buildDraft(
  batchId: string,
  generatedAt: string,
  contentType: ContentDraftType,
  title: string,
  purpose: string,
  targetAudience: string,
  draftText: string,
  notes: string,
  ctaSuggestion?: string
): ContentDraft {
  return {
    id: `${contentType}-${title}`.replace(/[^a-zA-Z0-9-_:/.]/g, "-").toLowerCase(),
    batchId,
    status: "draft",
    createdAt: generatedAt,
    updatedAt: generatedAt,
    title,
    contentType,
    purpose,
    targetAudience,
    draftText,
    ctaSuggestion,
    notes
  };
}

export async function runContentAgent(batchId: string): Promise<ContentDraftReport> {
  // Phase 3 generates reusable copy ideas only. It does not write to any live site content.
  const generatedAt = new Date().toISOString();
  const drafts: ContentDraft[] = [
    buildDraft(
      batchId,
      generatedAt,
      "homepage_hero",
      "Homepage Hero: Trusted K9 Training and Quality Puppies",
      "Give the homepage a strong opening message that explains the kennel clearly.",
      "Families, dog owners, and prospective working-dog clients in the research stage.",
      `${siteName} helps owners build confident, reliable dogs through practical training, structured care, and quality puppy programs. Whether you need obedience foundations, advanced training support, or information about available puppies, our goal is to guide you with clarity, experience, and dogs raised with purpose.`,
      "Use this as top-of-page headline and supporting paragraph copy. Pair it with a strong kennel or training image.",
      "View training options"
    ),
    buildDraft(
      batchId,
      generatedAt,
      "cta_section",
      "CTA Section: Start Your Dog's Next Step",
      "Encourage visitors to take a clear next action after reading key sections.",
      "Visitors who already understand the service and need a prompt to contact or inquire.",
      `Ready to take the next step with your dog? Talk with ${siteName} about training goals, puppy availability, or the right program for your situation. We can help you choose a path that fits your dog, your household, and your long-term expectations.`,
      "Place this after services or testimonials so it reinforces intent after the visitor has more context.",
      "Request information"
    ),
    buildDraft(
      batchId,
      generatedAt,
      "faq_items",
      "FAQ Draft Set: Common Questions for New Clients",
      "Answer common questions before visitors need to contact the kennel.",
      "First-time visitors comparing options or trying to understand services.",
      `1. What types of dogs do you work with?\nWe work with dogs needing strong obedience foundations, behavior structure, and goal-based training support.\n\n2. How do I ask about available puppies?\nUse the contact or inquiry form to ask about current and upcoming litters, timing, and fit.\n\n3. How do I know which training option is right for my dog?\nWe recommend starting with your dog’s age, behavior, and goals so we can point you toward the best next step.\n\n4. Do you work with family dogs as well as higher-drive dogs?\nYes. Training recommendations should match the dog’s temperament, home, and intended role.`,
      "This can be split into individual FAQ cards or accordion items later.",
      "Ask a question"
    ),
    buildDraft(
      batchId,
      generatedAt,
      "service_training_copy",
      "Service Section: Structured Training with Clear Goals",
      "Explain the kennel's training value in a focused service section.",
      "Dog owners looking for a trustworthy program with practical outcomes.",
      `${siteName} offers structured training built around clarity, consistency, and long-term results. Our approach focuses on useful obedience, better engagement, and a dog that can function more confidently at home and in public. Each dog has different strengths and needs, so training recommendations should reflect the dog in front of us rather than a one-size-fits-all plan.`,
      "Good fit for a services page or homepage section with cards for specific program options.",
      "Explore training services"
    ),
    buildDraft(
      batchId,
      generatedAt,
      "puppy_listing_template",
      "Puppy Listing Template: Available Puppy Overview",
      "Provide a reusable draft template for individual puppy listings.",
      "Prospective puppy buyers evaluating temperament, readiness, and next steps.",
      `Meet [Puppy Name], a [age]-old [breed/type] from ${siteName}. This puppy shows [temperament traits] and is being raised with attention to structure, care, and early development. Ideal for [home type or goals], [Puppy Name] may be a strong fit for owners looking for [companionship, training potential, working ability, or family placement]. Contact us for availability, pricing, and next-step details.`,
      "Keep bracketed placeholders so future listings can be produced quickly without editing live site files directly.",
      "Ask about this puppy"
    ),
    buildDraft(
      batchId,
      generatedAt,
      "announcement_post",
      "Announcement Post: New Update from Patriot K9 Kennel",
      "Share timely news in a simple post format that can be edited for different updates.",
      "Returning visitors, social followers, and prospective clients watching for kennel updates.",
      `${siteName} has a new update to share. We’re continuing to expand helpful information for clients looking for training guidance, puppy availability, and upcoming kennel announcements. Check back for new service details, future litter updates, and added resources designed to make the next step easier for dog owners and families.`,
      "Use this as a starter for news posts, litter announcements, seasonal reminders, or training program updates.",
      "Contact the kennel"
    )
  ];

  return {
    generatedAt,
    activeBatchId: batchId,
    drafts,
    publishedDrafts: [],
    consumedDrafts: [],
    archivedDrafts: []
  };
}
