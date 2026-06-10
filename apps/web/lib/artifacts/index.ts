import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ALLOWED_MIME_TYPES,
  ARTIFACTS_BUCKET,
  MAX_FILE_SIZE_BYTES,
  isAllowedMimeType,
} from "../constants";
import type { Artifact } from "../types";
import { createAdminClient } from "../supabase/admin";
import { mergeMetadata, suggestMetadata } from "../llm";
import {
  extractContentText,
  parseTags,
  sanitizeFilename,
} from "./text";

export type PublishInput = {
  file: File;
  title?: string;
  description?: string;
  tags?: string;
  createdBy?: string | null;
};

export type PublishResult =
  | { ok: true; artifact: Artifact }
  | { ok: false; error: string; status: number };

function extensionForMime(mime: string): string {
  switch (mime) {
    case "text/html":
      return "html";
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "application/pdf":
      return "pdf";
    default:
      return "bin";
  }
}

export async function uploadToStorage(
  supabase: SupabaseClient,
  artifactId: string,
  file: File,
  buffer: Buffer,
): Promise<{ storagePath: string } | { error: string }> {
  const safeName = sanitizeFilename(file.name || "artifact");
  const ext = extensionForMime(file.type);
  const storagePath = `${artifactId}/${safeName || `file.${ext}`}`;

  const { error } = await supabase.storage
    .from(ARTIFACTS_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    return { error: error.message };
  }

  return { storagePath };
}

export async function publishArtifact(
  input: PublishInput,
): Promise<PublishResult> {
  const { file, title, description, tags, createdBy = null } = input;

  if (!file || file.size === 0) {
    return { ok: false, error: "A file is required.", status: 400 };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      error: `File exceeds ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB limit.`,
      status: 400,
    };
  }

  const mimeType = file.type || "application/octet-stream";
  if (!isAllowedMimeType(mimeType)) {
    return {
      ok: false,
      error: `Unsupported file type. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`,
      status: 400,
    };
  }

  let supabase: SupabaseClient;
  try {
    supabase = createAdminClient();
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Database not configured.",
      status: 503,
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const contentText = await extractContentText(buffer, mimeType);
  const artifactId = randomUUID();

  const aiMeta = await suggestMetadata({
    filename: file.name,
    mimeType,
    contentText,
  });
  const merged = mergeMetadata({ title, description, tags }, aiMeta);

  const upload = await uploadToStorage(supabase, artifactId, file, buffer);
  if ("error" in upload) {
    return { ok: false, error: upload.error, status: 500 };
  }

  const { data, error } = await supabase
    .from("artifacts")
    .insert({
      id: artifactId,
      title: merged.title,
      description: merged.description,
      tags: parseTags(merged.tags),
      mime_type: mimeType,
      storage_path: upload.storagePath,
      content_text: contentText,
      file_size: file.size,
      created_by: createdBy,
    })
    .select()
    .single();

  if (error) {
    await supabase.storage.from(ARTIFACTS_BUCKET).remove([upload.storagePath]);
    return { ok: false, error: error.message, status: 500 };
  }

  return { ok: true, artifact: data as Artifact };
}

export async function listArtifacts(): Promise<Artifact[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("artifacts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Artifact[];
}

export async function getArtifact(id: string): Promise<Artifact | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("artifacts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as Artifact | null;
}

export async function getArtifactSignedUrl(
  storagePath: string,
  expiresIn = 3600,
): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(ARTIFACTS_BUCKET)
    .createSignedUrl(storagePath, expiresIn);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
