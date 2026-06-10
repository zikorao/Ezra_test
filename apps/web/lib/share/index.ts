import { randomBytes } from "crypto";
import type { Artifact, ShareLink } from "../types";
import { getArtifact, getArtifactSignedUrl } from "../artifacts";
import { createAdminClient } from "../supabase/admin";

export type ExpiryPreset = "1d" | "7d" | "30d" | "never";

const EXPIRY_DAYS: Record<ExpiryPreset, number | null> = {
  "1d": 1,
  "7d": 7,
  "30d": 30,
  never: null,
};

export function expiryFromPreset(preset: ExpiryPreset): Date | null {
  const days = EXPIRY_DAYS[preset];
  if (days === null) return null;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function createShareLink(
  artifactId: string,
  preset: ExpiryPreset = "7d",
): Promise<{ shareLink: ShareLink; url: string } | { error: string }> {
  const artifact = await getArtifact(artifactId);
  if (!artifact) return { error: "Artifact not found." };

  const supabase = createAdminClient();
  const expiresAt = expiryFromPreset(preset);
  const token = generateToken();

  const { data, error } = await supabase
    .from("share_links")
    .insert({
      artifact_id: artifactId,
      token,
      expires_at: expiresAt?.toISOString() ?? null,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return {
    shareLink: data as ShareLink,
    url: `${base}/s/${token}`,
  };
}

export async function listShareLinks(artifactId: string): Promise<ShareLink[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("share_links")
    .select("*")
    .eq("artifact_id", artifactId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ShareLink[];
}

export type SharedArtifactResult =
  | {
      ok: true;
      artifact: Artifact;
      shareLink: ShareLink;
      fileUrl: string | null;
    }
  | { ok: false; reason: "not_found" | "expired" };

async function lookupShareToken(
  token: string,
  increment = false,
): Promise<SharedArtifactResult> {
  const supabase = createAdminClient();

  const { data: link, error } = await supabase
    .from("share_links")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!link) return { ok: false, reason: "not_found" };

  const shareLink = link as ShareLink;
  if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
    return { ok: false, reason: "expired" };
  }

  if (increment) {
    await supabase
      .from("share_links")
      .update({ access_count: shareLink.access_count + 1 })
      .eq("id", shareLink.id);
    shareLink.access_count += 1;
  }

  const artifact = await getArtifact(shareLink.artifact_id);
  if (!artifact) return { ok: false, reason: "not_found" };

  const fileUrl = await getArtifactSignedUrl(artifact.storage_path);

  return { ok: true, artifact, shareLink, fileUrl };
}

/** Resolve a share token and record one page view. */
export async function resolveShareToken(
  token: string,
): Promise<SharedArtifactResult> {
  return lookupShareToken(token, true);
}

/** Validate token without incrementing (e.g. file download). */
export async function validateShareToken(
  token: string,
): Promise<SharedArtifactResult> {
  return lookupShareToken(token, false);
}

export function formatExpiry(iso: string | null): string {
  if (!iso) return "Never expires";
  const d = new Date(iso);
  if (d < new Date()) return "Expired";
  return `Expires ${d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

export function isShareLinkActive(link: ShareLink): boolean {
  if (!link.expires_at) return true;
  return new Date(link.expires_at) > new Date();
}
