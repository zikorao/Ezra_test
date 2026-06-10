"use client";

import { useState } from "react";
import type { ShareLink } from "@/lib/types";

type ExpiryPreset = "1d" | "7d" | "30d" | "never";

const PRESETS: { value: ExpiryPreset; label: string }[] = [
  { value: "1d", label: "1 day" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "never", label: "Never" },
];

function formatExpiry(iso: string | null): string {
  if (!iso) return "Never expires";
  const d = new Date(iso);
  if (d < new Date()) return "Expired";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function SharePanel({
  artifactId,
  initialLinks,
}: {
  artifactId: string;
  initialLinks: ShareLink[];
}) {
  const [preset, setPreset] = useState<ExpiryPreset>("7d");
  const [links, setLinks] = useState(initialLinks);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/artifacts/${artifactId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiry: preset }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create link");
        return;
      }
      setLinks((prev) => [data.shareLink, ...prev]);
      await copyUrl(data.url, data.shareLink.token);
    } catch {
      setError("Network error");
    } finally {
      setCreating(false);
    }
  }

  async function copyUrl(url: string, token: string) {
    await navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  }

  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <section className="mt-8 rounded-2xl border border-border bg-surface p-6">
      <h2 className="text-lg font-medium">Share</h2>
      <p className="mt-1 text-sm text-muted">
        Create a time-limited link for reviewers — no login required.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Link expires</span>
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as ExpiryPreset)}
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
          >
            {PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating}
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create & copy link"}
        </button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-700">{error}</p>
      )}

      {links.length > 0 && (
        <ul className="mt-6 space-y-3">
          {links.map((link) => {
            const url = `${base}/s/${link.token}`;
            const active =
              !link.expires_at || new Date(link.expires_at) > new Date();
            return (
              <li
                key={link.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs text-foreground">
                    {url}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {formatExpiry(link.expires_at)}
                    {!active && " · expired"}
                    {link.access_count > 0 &&
                      ` · ${link.access_count} view${link.access_count === 1 ? "" : "s"}`}
                  </p>
                </div>
                {active && (
                  <button
                    type="button"
                    onClick={() => copyUrl(url, link.token)}
                    className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-stone-50"
                  >
                    {copied === link.token ? "Copied!" : "Copy"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
