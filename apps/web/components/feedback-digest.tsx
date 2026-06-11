"use client";

import { useState } from "react";
import {
  readTraceIdFromResponse,
  trackCorrelatedEvent,
} from "@/lib/observability/analytics-client";
import type { FeedbackDigest } from "@/lib/llm/types";

type Props = {
  artifactId: string;
  commentCount: number;
};

export function FeedbackDigestPanel({ artifactId, commentCount }: Props) {
  const [digest, setDigest] = useState<FeedbackDigest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (commentCount === 0) return null;

  async function generate() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/artifacts/${artifactId}/feedback/digest`);
      const data = (await res.json()) as {
        digest?: FeedbackDigest;
        error?: string;
        retry_after_seconds?: number;
      };

      if (!res.ok) {
        trackCorrelatedEvent(
          "feedback.digest",
          { ok: false, artifact_id: artifactId },
          readTraceIdFromResponse(res),
        );
        if (res.status === 429 && data.retry_after_seconds) {
          setError(
            `Rate limit reached. Try again in ${data.retry_after_seconds}s.`,
          );
        } else {
          setError(data.error ?? "Could not generate summary");
        }
        return;
      }

      trackCorrelatedEvent(
        "feedback.digest",
        {
          ok: true,
          artifact_id: artifactId,
          themes: data.digest?.themes?.length ?? 0,
        },
        readTraceIdFromResponse(res),
      );
      if (data.digest) setDigest(data.digest);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-border bg-surface p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">Feedback digest</h2>
          <p className="mt-1 text-sm text-muted">
            AI summary of {commentCount} comment{commentCount === 1 ? "" : "s"}{" "}
            across review threads — for publishers catching up async.
          </p>
        </div>
        {!digest && (
          <button
            type="button"
            onClick={() => void generate()}
            disabled={loading}
            className="shrink-0 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-stone-50 disabled:opacity-50"
          >
            {loading ? "Summarizing…" : "Summarize feedback"}
          </button>
        )}
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {digest && (
        <div className="mt-5 space-y-5 rounded-xl border border-teal-100 bg-teal-50/50 p-5">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-teal-800">
              Overview
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-foreground">
              {digest.summary}
            </p>
          </div>

          {digest.themes.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-teal-800">
                Themes
              </h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {digest.themes.map((theme) => (
                  <li
                    key={theme}
                    className="rounded-full bg-white px-3 py-1 text-xs font-medium text-foreground ring-1 ring-teal-100"
                  >
                    {theme}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {digest.consensus && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-teal-800">
                Consensus
              </h3>
              <p className="mt-2 text-sm text-foreground">{digest.consensus}</p>
            </div>
          )}

          {digest.actionItems.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-teal-800">
                Suggested actions
              </h3>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-foreground">
                {digest.actionItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={() => void generate()}
            disabled={loading}
            className="text-xs font-medium text-accent hover:underline disabled:opacity-50"
          >
            {loading ? "Refreshing…" : "Refresh summary"}
          </button>
        </div>
      )}
    </section>
  );
}
