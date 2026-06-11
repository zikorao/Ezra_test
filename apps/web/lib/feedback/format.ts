import type { Feedback } from "../types";

export function formatFeedbackThreads(feedback: Feedback[]): string {
  const replies: Record<string, Feedback[]> = {};
  const roots: Feedback[] = [];

  for (const item of feedback) {
    if (item.parent_id) {
      replies[item.parent_id] = replies[item.parent_id] ?? [];
      replies[item.parent_id].push(item);
    } else {
      roots.push(item);
    }
  }

  return roots
    .map((root, index) => {
      const threadReplies = replies[root.id] ?? [];
      const replyText = threadReplies
        .map((r) => `  Reply — ${r.author_name}: ${r.body}`)
        .join("\n");
      return [
        `Thread ${index + 1} — ${root.author_name}: ${root.body}`,
        replyText,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

export function feedbackThreadCount(feedback: Feedback[]): number {
  return feedback.filter((f) => !f.parent_id).length;
}
