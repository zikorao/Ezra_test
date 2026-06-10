#!/usr/bin/env node
/**
 * Populates realistic reviewer feedback on published artifacts.
 *
 * Usage:
 *   node scripts/seed-feedback.mjs
 *   API_URL=http://localhost:3000 node scripts/seed-feedback.mjs
 */

const API_URL = process.env.API_URL ?? "http://localhost:3000";

/** @type {Record<string, { comments: { author: string; body: string; replies?: { author: string; body: string }[] }[] }>} */
const FEEDBACK_BY_KEYWORD = {
  checkout: {
    comments: [
      {
        author: "Morgan Patel",
        body: "The step indicator is clear — love that shipping shows as complete before payment. One concern: the promo code field might get missed on mobile. Could we stack it above the CTA?",
        replies: [
          {
            author: "Alex Kim (Design)",
            body: "Agreed. I'll mock a mobile variant with the promo above the button in the next iteration.",
          },
        ],
      },
      {
        author: "Jordan Lee",
        body: "Order summary sidebar works well on desktop. For the share link review, stakeholders asked if we can show estimated delivery date here too.",
      },
      {
        author: "Sam Rivera",
        body: "Approved from eng — HTML structure is clean. No blockers for handoff to implementation.",
      },
    ],
  },
  gamma: {
    comments: [
      {
        author: "Priya Nair",
        body: "Slide 2 metrics are compelling. Can we add a footnote on where the 60% Slack link reduction number came from?",
        replies: [
          {
            author: "Rathna U.",
            body: "Pulled from the Artifact Hub pilot doc — I'll add source citation on slide 2.",
          },
        ],
      },
      {
        author: "Chris Okafor",
        body: "H2 roadmap slide reads well for leadership. Suggest shortening bullet 2 to one line for presenter notes.",
      },
      {
        author: "Taylor Brooks",
        body: "Typography and spacing feel presentation-ready. Export to PDF for the board packet?",
      },
    ],
  },
  onboarding: {
    comments: [
      {
        author: "Devon Walsh",
        body: "Section 2 (Supabase) is accurate. Please add a warning box: never commit service_role keys — we had a near-miss last sprint.",
        replies: [
          {
            author: "Zikora O.",
            body: "Good call — adding a highlighted security note in the next revision.",
          },
        ],
      },
      {
        author: "Jamie Chen",
        body: "Ollama setup steps are clear for M-series Macs. Windows/Linux paths would help for contractors.",
      },
      {
        author: "Riley Santos",
        body: "Publish workflow section matches what we demoed in standup. This is good enough to onboard the next two hires.",
      },
    ],
  },
  midjourney: {
    comments: [
      {
        author: "Nina Kowalski",
        body: "Teal accent aligns with brand. KPI card hierarchy is strong — dark mode feels modern without being trendy.",
      },
      {
        author: "Omar Hassan",
        body: "Would like to see a version with real chart placeholders (bar + line) before we brief engineering.",
        replies: [
          {
            author: "Design Bot",
            body: "Queued a follow-up Midjourney pass with chart wireframes in the layout.",
          },
        ],
      },
    ],
  },
  metrics: {
    comments: [
      {
        author: "VP Product",
        body: "Executive summary hits the right themes. Need one paragraph on risks if we don't centralize artifact publishing.",
      },
      {
        author: "Data Team",
        body: "Please link raw usage CSV in appendix — reviewers will ask for methodology.",
        replies: [
          {
            author: "Analytics",
            body: "Appendix B will include export from Supabase + manual Slack audit sample.",
          },
        ],
      },
      {
        author: "Legal (review)",
        body: "No PII in the sample report — cleared for internal distribution via share links.",
      },
    ],
  },
  default: {
    comments: [
      {
        author: "Reviewer One",
        body: "Thanks for publishing — overall direction looks good. A few polish items noted above.",
      },
      {
        author: "Reviewer Two",
        body: "Share link worked without login. Feedback flow is much better than Slack threads.",
      },
    ],
  },
};

function templateForArtifact(artifact) {
  const haystack = `${artifact.title} ${artifact.description} ${artifact.tags.join(" ")}`.toLowerCase();
  if (haystack.includes("checkout") || haystack.includes("claude")) return FEEDBACK_BY_KEYWORD.checkout;
  if (haystack.includes("gamma") || haystack.includes("deck")) return FEEDBACK_BY_KEYWORD.gamma;
  if (haystack.includes("onboarding") || haystack.includes("engineering")) return FEEDBACK_BY_KEYWORD.onboarding;
  if (haystack.includes("midjourney") || haystack.includes("dashboard")) return FEEDBACK_BY_KEYWORD.midjourney;
  if (haystack.includes("metrics") || haystack.includes("report") || haystack.includes("pdf")) {
    return FEEDBACK_BY_KEYWORD.metrics;
  }
  return FEEDBACK_BY_KEYWORD.default;
}

async function postComment(artifactId, author, body, parentId = null) {
  const res = await fetch(`${API_URL}/api/artifacts/${artifactId}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ author_name: author, body, parent_id: parentId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data.feedback;
}

async function main() {
  console.log(`Seeding feedback → ${API_URL}\n`);

  const listRes = await fetch(`${API_URL}/api/artifacts`);
  if (!listRes.ok) {
    console.error("Cannot reach API. Run: npm run dev");
    process.exit(1);
  }

  const { artifacts } = await listRes.json();
  if (!artifacts?.length) {
    console.error("No artifacts found. Run: npm run seed");
    process.exit(1);
  }

  let total = 0;
  for (const artifact of artifacts) {
    const template = templateForArtifact(artifact);
    process.stdout.write(`  ${artifact.title.slice(0, 48)}… `);

    let count = 0;
    try {
      for (const thread of template.comments) {
        const parent = await postComment(artifact.id, thread.author, thread.body);
        count += 1;
        for (const reply of thread.replies ?? []) {
          await postComment(artifact.id, reply.author, reply.body, parent.id);
          count += 1;
        }
      }
      console.log(`✓ ${count} comment(s)`);
      total += count;
    } catch (e) {
      console.log(`✗ ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(`\nPosted ${total} feedback entries across ${artifacts.length} artifacts.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
