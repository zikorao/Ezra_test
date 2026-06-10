"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Feedback } from "@/lib/types";
import { formatFeedbackDate } from "@/lib/feedback";

type Props = {
  artifactId: string;
  shareToken?: string;
  initialFeedback: Feedback[];
};

function Comment({
  item,
  replies,
  onReply,
}: {
  item: Feedback;
  replies: Feedback[];
  onReply: (parentId: string) => void;
}) {
  return (
    <li className="rounded-lg border border-border bg-background px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{item.author_name}</span>
        <time className="shrink-0 text-xs text-muted">
          {formatFeedbackDate(item.created_at)}
        </time>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{item.body}</p>
      <button
        type="button"
        onClick={() => onReply(item.id)}
        className="mt-2 text-xs font-medium text-accent hover:underline"
      >
        Reply
      </button>
      {replies.length > 0 && (
        <ul className="mt-3 space-y-2 border-l-2 border-border pl-4">
          {replies.map((r) => (
            <li key={r.id}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{r.author_name}</span>
                <time className="text-xs text-muted">
                  {formatFeedbackDate(r.created_at)}
                </time>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{r.body}</p>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function FeedbackPanel({ artifactId, shareToken, initialFeedback }: Props) {
  const router = useRouter();
  const endpoint = shareToken
    ? `/api/share/${shareToken}/feedback`
    : `/api/artifacts/${artifactId}/feedback`;

  const [authorName, setAuthorName] = useState("");
  const [body, setBody] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { roots, repliesByParent } = useMemo(() => {
    const replies: Record<string, Feedback[]> = {};
    const top: Feedback[] = [];
    for (const f of initialFeedback) {
      if (f.parent_id) {
        replies[f.parent_id] = replies[f.parent_id] ?? [];
        replies[f.parent_id].push(f);
      } else {
        top.push(f);
      }
    }
    return { roots: top, repliesByParent: replies };
  }, [initialFeedback]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author_name: authorName,
          body,
          parent_id: parentId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to post comment");
        return;
      }
      setBody("");
      setParentId(null);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-border bg-surface p-6">
      <h2 className="text-lg font-medium">Feedback</h2>
      <p className="mt-1 text-sm text-muted">
        Leave structured comments for the publisher — no account required on share links.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {parentId && (
          <p className="rounded-lg bg-teal-50 px-3 py-2 text-xs text-teal-900">
            Replying to a comment.{" "}
            <button
              type="button"
              className="font-medium underline"
              onClick={() => setParentId(null)}
            >
              Cancel
            </button>
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-1">
            <span className="text-xs font-medium text-muted">Your name</span>
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Alex Chen"
              required
              maxLength={80}
              className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
            />
          </label>
        </div>
        <label className="block">
          <span className="text-xs font-medium text-muted">Comment</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="What works well? What should change?"
            required
            maxLength={2000}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {submitting ? "Posting…" : parentId ? "Post reply" : "Post comment"}
        </button>
      </form>

      {roots.length > 0 ? (
        <ul className="mt-8 space-y-4">
          {roots.map((item) => (
            <Comment
              key={item.id}
              item={item}
              replies={repliesByParent[item.id] ?? []}
              onReply={setParentId}
            />
          ))}
        </ul>
      ) : (
        <p className="mt-8 text-center text-sm text-muted">
          No feedback yet — be the first to comment.
        </p>
      )}
    </section>
  );
}
