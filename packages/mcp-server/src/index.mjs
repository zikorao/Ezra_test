#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  mcpAddFeedback,
  mcpCreateShareLink,
  mcpGetArtifact,
  mcpListArtifacts,
  mcpPublishArtifact,
} from "./client.mjs";

const server = new McpServer({
  name: "artifact-hub",
  version: "0.1.0",
});

server.tool(
  "publish_artifact",
  "Publish an AI-generated file (HTML, PNG, JPG, WebP, PDF) to Artifact Hub. Optionally creates a share link.",
  {
    file_path: z.string().describe("Absolute path to the file"),
    title: z.string().optional(),
    description: z.string().optional(),
    tags: z.string().optional(),
    create_share_link: z.boolean().optional(),
    share_expiry: z.enum(["1d", "7d", "30d", "never"]).optional(),
  },
  async (args) => {
    const data = await mcpPublishArtifact({
      filePath: args.file_path,
      title: args.title,
      description: args.description,
      tags: args.tags,
      createShare: args.create_share_link,
      shareExpiry: args.share_expiry,
    });

    const lines = [
      `Published: **${data.artifact.title}**`,
      `ID: ${data.artifact.id}`,
      `URL: ${data.url}`,
      `Tags: ${data.artifact.tags?.join(", ") || "none"}`,
    ];
    if (data.share_url) {
      lines.push(`Share link: ${data.share_url}`);
      if (data.share_expires_at) lines.push(`Expires: ${data.share_expires_at}`);
    }

    return { content: [{ type: "text", text: lines.join("\n") }] };
  },
);

server.tool(
  "search_artifacts",
  "Search the catalog with natural language (e.g. 'checkout mockups from Claude').",
  { query: z.string() },
  async ({ query }) => {
    const data = await mcpListArtifacts(query);
    if (!data.artifacts?.length) {
      return { content: [{ type: "text", text: `No artifacts found for "${query}".` }] };
    }
    const lines = data.artifacts.map(
      (a) =>
        `- **${a.title}** (${a.mime_type})\n  ID: ${a.id}\n  Tags: ${a.tags.join(", ")}\n  ${a.url}`,
    );
    return {
      content: [{ type: "text", text: `Found ${data.count} artifact(s):\n\n${lines.join("\n\n")}` }],
    };
  },
);

server.tool(
  "list_artifacts",
  "List recent artifacts, newest first.",
  { limit: z.number().optional() },
  async ({ limit = 10 }) => {
    const data = await mcpListArtifacts();
    const items = (data.artifacts ?? []).slice(0, limit);
    if (!items.length) {
      return { content: [{ type: "text", text: "No artifacts published yet." }] };
    }
    const lines = items.map((a) => `- ${a.title} — ${a.url} (id: ${a.id})`);
    return { content: [{ type: "text", text: lines.join("\n") }] };
  },
);

server.tool(
  "get_artifact",
  "Get artifact details, recent feedback, and share links.",
  { artifact_id: z.string().uuid() },
  async ({ artifact_id }) => {
    const data = await mcpGetArtifact(artifact_id);
    const a = data.artifact;
    const lines = [
      `# ${a.title}`,
      a.description || "(no description)",
      `Tags: ${a.tags?.join(", ") || "none"}`,
      `URL: ${a.url}`,
      `Feedback: ${data.feedback_count} comment(s)`,
    ];
    if (data.recent_feedback?.length) {
      lines.push("\nRecent feedback:");
      for (const f of data.recent_feedback) lines.push(`- ${f.author}: ${f.body}`);
    }
    if (data.active_share_links?.length) {
      lines.push("\nShare links:");
      for (const s of data.active_share_links) lines.push(`- ${s.url}`);
    }
    return { content: [{ type: "text", text: lines.join("\n") }] };
  },
);

server.tool(
  "create_share_link",
  "Create a time-limited share link for reviewers.",
  {
    artifact_id: z.string().uuid(),
    expiry: z.enum(["1d", "7d", "30d", "never"]).optional(),
  },
  async ({ artifact_id, expiry = "7d" }) => {
    const data = await mcpCreateShareLink(artifact_id, expiry);
    return {
      content: [
        {
          type: "text",
          text: `Share link: ${data.share_url}\n${data.expires_at ? `Expires: ${data.expires_at}` : "Never expires"}`,
        },
      ],
    };
  },
);

server.tool(
  "add_feedback",
  "Leave feedback on an artifact.",
  {
    artifact_id: z.string().uuid(),
    author_name: z.string(),
    comment: z.string(),
  },
  async ({ artifact_id, author_name, comment }) => {
    await mcpAddFeedback(artifact_id, author_name, comment);
    return {
      content: [{ type: "text", text: `Feedback posted by ${author_name}.` }],
    };
  },
);

if (!process.env.ARTIFACT_HUB_API_KEY) {
  console.error("ARTIFACT_HUB_API_KEY is required.");
  process.exit(1);
}

const transport = new StdioServerTransport();
await server.connect(transport);
