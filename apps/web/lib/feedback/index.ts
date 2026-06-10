import type { Feedback } from "../types";
import { createAdminClient } from "../supabase/admin";

const MAX_NAME = 80;
const MAX_BODY = 2000;

export type AddFeedbackInput = {
  artifactId: string;
  authorName: string;
  body: string;
  parentId?: string | null;
};

export function validateFeedbackInput(
  authorName: string,
  body: string,
): { ok: true; authorName: string; body: string } | { ok: false; error: string } {
  const name = authorName.trim();
  const text = body.trim();

  if (!name) return { ok: false, error: "Name is required." };
  if (name.length > MAX_NAME) {
    return { ok: false, error: `Name must be ${MAX_NAME} characters or fewer.` };
  }
  if (!text) return { ok: false, error: "Comment is required." };
  if (text.length > MAX_BODY) {
    return { ok: false, error: `Comment must be ${MAX_BODY} characters or fewer.` };
  }

  return { ok: true, authorName: name, body: text };
}

export async function listFeedback(artifactId: string): Promise<Feedback[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .eq("artifact_id", artifactId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Feedback[];
}

export async function addFeedback(
  input: AddFeedbackInput,
): Promise<{ ok: true; feedback: Feedback } | { ok: false; error: string }> {
  const validated = validateFeedbackInput(input.authorName, input.body);
  if (!validated.ok) return validated;

  const supabase = createAdminClient();

  if (input.parentId) {
    const { data: parent } = await supabase
      .from("feedback")
      .select("id, artifact_id")
      .eq("id", input.parentId)
      .maybeSingle();

    if (!parent || parent.artifact_id !== input.artifactId) {
      return { ok: false, error: "Invalid reply target." };
    }
  }

  const { data, error } = await supabase
    .from("feedback")
    .insert({
      artifact_id: input.artifactId,
      author_name: validated.authorName,
      body: validated.body,
      parent_id: input.parentId ?? null,
    })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, feedback: data as Feedback };
}

export function formatFeedbackDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
