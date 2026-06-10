#!/usr/bin/env node
import { randomBytes } from "crypto";

const key = `ah_${randomBytes(24).toString("base64url")}`;
console.log("Generated Artifact Hub API key:\n");
console.log(key);
console.log("\nAdd to apps/web/.env.local:");
console.log(`ARTIFACT_HUB_API_KEY=${key}`);
console.log("\nAdd to Claude Desktop MCP env (same key).");
