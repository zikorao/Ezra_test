"use client";

import { track } from "@vercel/analytics";

import { TRACE_ID_HEADER } from "./correlation";

type EventProps = Record<string, string | number | boolean | null | undefined>;

export function readTraceIdFromResponse(response: Response): string | null {
  return response.headers.get(TRACE_ID_HEADER);
}

/** Vercel Web Analytics custom event correlated with a Phoenix / Vercel OTEL trace. */
export function trackCorrelatedEvent(
  name: string,
  properties: EventProps,
  traceId?: string | null,
): void {
  track(name, {
    ...properties,
    ...(traceId ? { trace_id: traceId } : {}),
  });
}
