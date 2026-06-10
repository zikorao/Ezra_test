import { readFile } from "fs/promises";
import { basename } from "path";

const API_URL = process.env.ARTIFACT_HUB_API_URL ?? "http://localhost:3000";
const API_KEY = process.env.ARTIFACT_HUB_API_KEY ?? "";

function headers(json = false) {
  const h = { "X-API-Key": API_KEY };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

async function parseError(res) {
  try {
    const data = await res.json();
    return data.error ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export async function mcpListArtifacts(query) {
  const url = query
    ? `${API_URL}/api/mcp/artifacts?q=${encodeURIComponent(query)}`
    : `${API_URL}/api/mcp/artifacts`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function mcpGetArtifact(id) {
  const res = await fetch(`${API_URL}/api/mcp/artifacts/${id}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function mcpPublishArtifact(opts) {
  const buffer = await readFile(opts.filePath);
  const name = basename(opts.filePath);
  const mime = mimeFromName(name);

  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mime }), name);
  if (opts.title) form.append("title", opts.title);
  if (opts.description) form.append("description", opts.description);
  if (opts.tags) form.append("tags", opts.tags);
  if (opts.createShare) form.append("create_share", "true");
  if (opts.shareExpiry) form.append("share_expiry", opts.shareExpiry);

  const res = await fetch(`${API_URL}/api/mcp/publish`, {
    method: "POST",
    headers: headers(),
    body: form,
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function mcpCreateShareLink(artifactId, expiry) {
  const res = await fetch(`${API_URL}/api/mcp/artifacts/${artifactId}/share`, {
    method: "POST",
    headers: headers(true),
    body: JSON.stringify({ expiry }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function mcpAddFeedback(artifactId, authorName, body) {
  const res = await fetch(
    `${API_URL}/api/mcp/artifacts/${artifactId}/feedback`,
    {
      method: "POST",
      headers: headers(true),
      body: JSON.stringify({ author_name: authorName, body }),
    },
  );
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

function mimeFromName(name) {
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "html":
    case "htm":
      return "text/html";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}
