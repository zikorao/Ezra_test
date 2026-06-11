import { context, trace } from "@opentelemetry/api";
import type { NextResponse } from "next/server";

export const TRACE_ID_HEADER = "x-trace-id";
export const SPAN_ID_HEADER = "x-span-id";

export type TraceContext = {
  traceId: string;
  spanId: string;
};

export function getActiveTraceContext(): TraceContext | null {
  const span = trace.getSpan(context.active());
  if (!span) return null;

  const { traceId, spanId, traceFlags } = span.spanContext();
  if (!traceId || traceFlags === undefined) return null;

  return { traceId, spanId };
}

/** Vercel + OTEL attributes for span enrichment and structured logs. */
export function getDeploymentAttributes(): Record<string, string> {
  const attrs: Record<string, string> = {};

  if (process.env.VERCEL_ENV) attrs["vercel.env"] = process.env.VERCEL_ENV;
  if (process.env.VERCEL_URL) attrs["vercel.url"] = process.env.VERCEL_URL;
  if (process.env.VERCEL_REGION) attrs["vercel.region"] = process.env.VERCEL_REGION;
  if (process.env.VERCEL_DEPLOYMENT_ID) {
    attrs["vercel.deployment_id"] = process.env.VERCEL_DEPLOYMENT_ID;
  }

  return attrs;
}

export function getLogCorrelationFields(): Record<string, string> {
  const fields: Record<string, string> = { ...getDeploymentAttributes() };
  const active = getActiveTraceContext();

  if (active) {
    fields.trace_id = active.traceId;
    fields.span_id = active.spanId;
  }

  return fields;
}

export function applyTraceHeaders<T extends NextResponse>(response: T): T {
  const active = getActiveTraceContext();
  if (!active) return response;

  response.headers.set(TRACE_ID_HEADER, active.traceId);
  response.headers.set(SPAN_ID_HEADER, active.spanId);
  return response;
}

export function enrichActiveSpan(): void {
  const span = trace.getSpan(context.active());
  if (!span) return;

  for (const [key, value] of Object.entries(getDeploymentAttributes())) {
    span.setAttribute(key, value);
  }
}
