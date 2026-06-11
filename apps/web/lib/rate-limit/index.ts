import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type RateLimitPolicy = {
  /** Namespace prefix for the bucket key */
  name: string;
  windowSeconds: number;
  maxRequests: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

type HeaderLike = {
  get(name: string): string | null;
};

/** Default limits — override via env for tuning without code changes. */
export const RATE_LIMIT_POLICIES = {
  searchSuggest: {
    name: "search.suggest",
    windowSeconds: 60,
    maxRequests: numEnv("RATE_LIMIT_SEARCH_SUGGEST_PER_MIN", 60),
  },
  searchQuery: {
    name: "search.query",
    windowSeconds: 60,
    maxRequests: numEnv("RATE_LIMIT_SEARCH_QUERY_PER_MIN", 20),
  },
  feedbackDigest: {
    name: "feedback.digest",
    windowSeconds: 600,
    maxRequests: numEnv("RATE_LIMIT_DIGEST_PER_10MIN", 5),
  },
  feedbackDigestArtifact: {
    name: "feedback.digest.artifact",
    windowSeconds: 300,
    maxRequests: numEnv("RATE_LIMIT_DIGEST_PER_ARTIFACT_5MIN", 2),
  },
  mcpSearch: {
    name: "mcp.search",
    windowSeconds: 60,
    maxRequests: numEnv("RATE_LIMIT_MCP_SEARCH_PER_MIN", 60),
  },
} as const satisfies Record<string, RateLimitPolicy>;

function numEnv(key: string, fallback: number): number {
  const raw = process.env[key]?.trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getClientIp(headers: HeaderLike): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0]?.trim();
    if (ip) return ip;
  }

  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "anonymous";
}

export function hashIdentifier(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export async function checkRateLimit(
  policy: RateLimitPolicy,
  identifier: string,
): Promise<RateLimitResult> {
  const bucketKey = `${policy.name}:${identifier}`;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_bucket_key: bucketKey,
      p_window_seconds: policy.windowSeconds,
      p_max_requests: policy.maxRequests,
    });

    if (error) throw error;

    const row = data as {
      allowed?: boolean;
      remaining?: number;
      retry_after_seconds?: number;
    };

    return {
      allowed: row.allowed !== false,
      remaining: row.remaining ?? 0,
      retryAfterSeconds: row.retry_after_seconds ?? 0,
    };
  } catch (e) {
    console.warn(
      "[rate-limit] check failed, allowing request:",
      e instanceof Error ? e.message : e,
    );
    return { allowed: true, remaining: -1, retryAfterSeconds: 0 };
  }
}

export async function enforceRateLimit(
  policy: RateLimitPolicy,
  headers: HeaderLike,
  identifierSuffix?: string,
): Promise<RateLimitResult> {
  const ip = getClientIp(headers);
  const identifier = identifierSuffix ? `${ip}:${identifierSuffix}` : ip;
  return checkRateLimit(policy, identifier);
}

export function rateLimitResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    {
      error: "Too many requests",
      retry_after_seconds: result.retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
        "X-RateLimit-Remaining": String(Math.max(0, result.remaining)),
      },
    },
  );
}

export async function enforceDigestRateLimits(
  headers: HeaderLike,
  artifactId: string,
): Promise<RateLimitResult> {
  const global = await enforceRateLimit(
    RATE_LIMIT_POLICIES.feedbackDigest,
    headers,
  );
  if (!global.allowed) return global;

  return enforceRateLimit(
    RATE_LIMIT_POLICIES.feedbackDigestArtifact,
    headers,
    artifactId,
  );
}
