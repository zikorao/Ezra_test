#!/usr/bin/env node
/**
 * Populates realistic reviewer feedback (with threaded replies) on published artifacts.
 *
 * Usage:
 *   npm run seed:feedback
 *   API_URL=https://ezra-test-web.vercel.app npm run seed:feedback
 *   FORCE=1 npm run seed:feedback   # re-seed even if comments exist
 */

const API_URL = process.env.API_URL ?? "http://localhost:3000";
const FORCE = process.env.FORCE === "1" || process.env.FORCE === "true";
const SKIP_IF_COMMENTS = Number(process.env.SKIP_IF_COMMENTS ?? "3");

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
          {
            author: "Morgan Patel",
            body: "Perfect — that addresses the stakeholder note from last week's review.",
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
  pricing: {
    comments: [
      {
        author: "Priya Shah",
        body: "Tier naming is clear. The annual/monthly toggle should default to annual — that's what sales wants highlighted in demos.",
        replies: [
          {
            author: "Marketing",
            body: "Updated default in the next Claude pass. Added 'Save 20%' badge on annual.",
          },
        ],
      },
      {
        author: "Finance",
        body: "Enterprise tier 'Contact us' CTA is correct. Please add footnote that volume pricing starts at 50 seats.",
      },
      {
        author: "Jordan Lee",
        body: "Feature comparison table scans well. Mobile stacking order looks good in responsive preview.",
      },
    ],
  },
  mobile: {
    comments: [
      {
        author: "A11y Review",
        body: "Bottom tab bar hit targets meet 44px minimum. Slide-over menu needs focus trap — noted in HTML comments but please verify in implementation.",
        replies: [
          {
            author: "Devon Walsh",
            body: "Will add focus-trap spec to the handoff doc. Good catch.",
          },
        ],
      },
      {
        author: "Product",
        body: "Tab labels match current IA. Consider badge on Inbox tab for unread share-link feedback.",
      },
    ],
  },
  support: {
    comments: [
      {
        author: "CS Lead",
        body: "Suggested prompts cover the top three ticket categories. Agent handoff state is realistic — CSAT thumbs need labels for screen readers.",
        replies: [
          {
            author: "Design",
            body: "Added aria-label on thumbs in v2. Pushing update today.",
          },
        ],
      },
      {
        author: "Ops",
        body: "Widget z-index might conflict with our cookie banner — test on staging before rollout.",
      },
    ],
  },
  pitch: {
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
  offsite: {
    comments: [
      {
        author: "Eng Manager",
        body: "Day 1 demo block timing is tight — 45 min for 8 teams won't work. Suggest 60 min or fewer demos.",
        replies: [
          {
            author: "Zikora O.",
            body: "Extended demo slot to 60 min and cut one breakout. Updated agenda attached.",
          },
        ],
      },
      {
        author: "HR",
        body: "Retro format looks good. Please add dietary preference survey link for catering.",
      },
    ],
  },
  api: {
    comments: [
      {
        author: "Platform Eng",
        body: "Publish endpoint examples match production. Missing rate-limit headers in the reference — add 429 response schema.",
        replies: [
          {
            author: "Docs",
            body: "Added rate-limit section and example 429 payload in draft v2.",
          },
        ],
      },
      {
        author: "Contractor",
        body: "Feedback POST shape is clear. auth section could mention MCP uses the same API key.",
      },
    ],
  },
  security: {
    comments: [
      {
        author: "Security Team",
        body: "Credential rotation playbook is actionable. Share-link abuse section should reference token entropy requirements.",
        replies: [
          {
            author: "Infra",
            body: "Added note on 32-byte tokens and expiry audit query.",
          },
        ],
      },
      {
        author: "Compliance",
        body: "RLS misconfiguration runbook approved for internal wiki. No blockers.",
      },
    ],
  },
  research: {
    comments: [
      {
        author: "UX Research",
        body: "Themes map cleanly to interview quotes. Pain point #2 (expiring Slack links) should be the hero insight on slide 1.",
        replies: [
          {
            author: "PM",
            body: "Aligned — reordering executive summary to lead with link expiry.",
          },
        ],
      },
      {
        author: "Design",
        body: "Twelve interviews is solid n. Consider adding one direct quote callout per theme in the appendix.",
      },
    ],
  },
  brand: {
    comments: [
      {
        author: "Nina Kowalski",
        body: "Teal gradient aligns with brand guidelines. Tagline hierarchy works — headline could go 10% larger for poster format.",
      },
      {
        author: "Brand",
        body: "Approved for internal campaign. Need CMYK-safe export notes before print vendor handoff.",
        replies: [
          {
            author: "Design Bot",
            body: "Print spec doc queued — will attach Pantone equivalents.",
          },
        ],
      },
    ],
  },
  icons: {
    comments: [
      {
        author: "Mobile PM",
        body: "Concept 3 reads best at 29px — clearest at small sizes. Concepts 1 and 5 feel too detailed for notification tray.",
        replies: [
          {
            author: "Brand",
            body: "Shortlisting #3 and #4 for user testing next week.",
          },
        ],
      },
      {
        author: "iOS Eng",
        body: "Please export SVG masters for the winner — HTML grid is great for review but we need vectors.",
      },
    ],
  },
  gamma: {
    comments: [
      {
        author: "Priya Nair",
        body: "Deck flow is strong for a 10-minute slot. Traction slide could use one customer logo row.",
        replies: [
          {
            author: "Rathna U.",
            body: "Logo row added with anonymized pilot customers — check slide 4.",
          },
        ],
      },
      {
        author: "Chris Okafor",
        body: "Presenter notes on GTM slide are dense — trimming for exec audience.",
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
        body: "Thanks for publishing — overall direction looks good. Share link worked without login.",
        replies: [
          {
            author: "Publisher",
            body: "Appreciate the quick review — addressing polish items in the next version.",
          },
        ],
      },
      {
        author: "Reviewer Two",
        body: "Feedback flow is much better than Slack threads. This should be our default review path.",
      },
    ],
  },
};

function templateForArtifact(artifact) {
  const haystack = `${artifact.title} ${artifact.description} ${(artifact.tags ?? []).join(" ")}`.toLowerCase();

  if (haystack.includes("checkout")) return FEEDBACK_BY_KEYWORD.checkout;
  if (haystack.includes("pricing")) return FEEDBACK_BY_KEYWORD.pricing;
  if (haystack.includes("navigation") || haystack.includes("mobile nav")) {
    return FEEDBACK_BY_KEYWORD.mobile;
  }
  if (haystack.includes("chat") || haystack.includes("support") || haystack.includes("widget")) {
    return FEEDBACK_BY_KEYWORD.support;
  }
  if (haystack.includes("pitch") || haystack.includes("series a") || haystack.includes("investor")) {
    return FEEDBACK_BY_KEYWORD.pitch;
  }
  if (haystack.includes("offsite")) return FEEDBACK_BY_KEYWORD.offsite;
  if (haystack.includes("api") && haystack.includes("documentation")) return FEEDBACK_BY_KEYWORD.api;
  if (haystack.includes("runbook") || haystack.includes("security")) return FEEDBACK_BY_KEYWORD.security;
  if (haystack.includes("research") || haystack.includes("synthesis")) return FEEDBACK_BY_KEYWORD.research;
  if (haystack.includes("poster") || haystack.includes("campaign")) return FEEDBACK_BY_KEYWORD.brand;
  if (haystack.includes("icon")) return FEEDBACK_BY_KEYWORD.icons;
  if (haystack.includes("gamma") || haystack.includes("deck")) return FEEDBACK_BY_KEYWORD.gamma;
  if (haystack.includes("onboarding") || haystack.includes("engineering hub")) {
    return FEEDBACK_BY_KEYWORD.onboarding;
  }
  if (haystack.includes("midjourney") || haystack.includes("dashboard")) {
    return FEEDBACK_BY_KEYWORD.midjourney;
  }
  if (haystack.includes("metrics") || haystack.includes("report") || haystack.includes("adoption")) {
    return FEEDBACK_BY_KEYWORD.metrics;
  }
  if (haystack.includes("claude")) return FEEDBACK_BY_KEYWORD.checkout;

  return FEEDBACK_BY_KEYWORD.default;
}

async function listExistingFeedback(artifactId) {
  const res = await fetch(`${API_URL}/api/artifacts/${artifactId}/feedback`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.feedback ?? [];
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
  console.log(`Seeding feedback → ${API_URL}${FORCE ? " (force)" : ""}\n`);

  const listRes = await fetch(`${API_URL}/api/artifacts`);
  if (!listRes.ok) {
    console.error("Cannot reach API. Run: npm run dev");
    console.error(`  or: API_URL=https://ezra-test-web.vercel.app npm run seed:feedback`);
    process.exit(1);
  }

  const { artifacts } = await listRes.json();
  if (!artifacts?.length) {
    console.error("No artifacts found. Run: npm run seed:all");
    process.exit(1);
  }

  let total = 0;
  let skipped = 0;

  for (const artifact of artifacts) {
    const label = artifact.title.slice(0, 48);
    process.stdout.write(`  ${label}… `);

    if (!FORCE) {
      const existing = await listExistingFeedback(artifact.id);
      if (existing.length >= SKIP_IF_COMMENTS) {
        console.log(`skip (${existing.length} existing)`);
        skipped += 1;
        continue;
      }
      if (existing.length > 0) {
        process.stdout.write(`+${existing.length} existing, adding… `);
      }
    }

    const template = templateForArtifact(artifact);
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

  console.log(
    `\nPosted ${total} feedback entries across ${artifacts.length} artifacts` +
      (skipped ? ` (${skipped} skipped — already had comments)` : "") +
      ".",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
