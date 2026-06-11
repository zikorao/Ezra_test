import { listFeedback } from "./index";
import { formatFeedbackThreads } from "./format";
import { getArtifact } from "../artifacts";
import { summarizeFeedbackDigest, isLlmAvailable } from "../llm";
import { logEvent } from "../observability/log";
import { tracePipelineCall } from "../observability/phoenix";
import type { FeedbackDigest } from "../llm/types";

export async function generateFeedbackDigest(
  artifactId: string,
): Promise<
  | { ok: true; digest: FeedbackDigest; commentCount: number }
  | { ok: false; error: string; status: number }
> {
  const artifact = await getArtifact(artifactId);
  if (!artifact) {
    return { ok: false, error: "Artifact not found.", status: 404 };
  }

  const feedback = await listFeedback(artifactId);
  if (feedback.length === 0) {
    return { ok: false, error: "No feedback to summarize.", status: 400 };
  }

  if (!(await isLlmAvailable())) {
    return {
      ok: false,
      error: "LLM is not available. Set GROQ_API_KEY or run Ollama locally.",
      status: 503,
    };
  }

  const threads = formatFeedbackThreads(feedback);

  return tracePipelineCall(
    { operation: "feedback.digest", meta: { commentCount: feedback.length } },
    async () => {
      const start = Date.now();
      const digest = await summarizeFeedbackDigest(artifact.title, threads);

      if (!digest) {
        logEvent({
          type: "pipeline",
          operation: "feedback.digest",
          ok: false,
          ms: Date.now() - start,
          meta: { commentCount: feedback.length },
          error: "digest parse failed",
        });
        return { ok: false as const, error: "Could not generate summary.", status: 502 };
      }

      logEvent({
        type: "pipeline",
        operation: "feedback.digest",
        ok: true,
        ms: Date.now() - start,
        meta: {
          commentCount: feedback.length,
          themeCount: digest.themes.length,
        },
      });

      return { ok: true as const, digest, commentCount: feedback.length };
    },
  );
}
