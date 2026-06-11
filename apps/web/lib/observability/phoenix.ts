import {
  LLM_MODEL_NAME,
  LLM_PROVIDER,
  OpenInferenceSpanKind,
  SemanticConventions,
  SpanStatusCode,
} from "@arizeai/phoenix-otel";
import { trace } from "@opentelemetry/api";

import { enrichActiveSpan } from "./correlation";
import { phoenixConfigured } from "./otel";

type ForceFlushProvider = {
  forceFlush?: () => Promise<void>;
};

export function isPhoenixEnabled(): boolean {
  return phoenixConfigured();
}

export async function flushPhoenix(): Promise<void> {
  const provider = trace.getTracerProvider() as ForceFlushProvider;
  if (typeof provider.forceFlush !== "function") return;

  try {
    await provider.forceFlush();
  } catch {
    // Non-fatal on serverless teardown
  }
}

type LlmTraceInput = {
  operation: string;
  provider: string;
  model: string;
  inputChars: number;
};

type PipelineTraceInput = {
  operation: string;
  meta?: Record<string, string | number | boolean>;
};

export async function traceLlmCall<T>(
  input: LlmTraceInput,
  fn: () => Promise<T>,
): Promise<T> {
  const tracer = trace.getTracer("artifact-hub");
  return tracer.startActiveSpan(input.operation, async (span) => {
    enrichActiveSpan();
    span.setAttribute(
      SemanticConventions.OPENINFERENCE_SPAN_KIND,
      OpenInferenceSpanKind.LLM,
    );
    span.setAttribute(LLM_PROVIDER, input.provider);
    span.setAttribute(LLM_MODEL_NAME, input.model);
    span.setAttribute("llm.input.chars", input.inputChars);
    span.setAttribute("llm.operation", input.operation);

    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw e;
    } finally {
      span.end();
      await flushPhoenix();
    }
  });
}

export async function tracePipelineCall<T>(
  input: PipelineTraceInput,
  fn: () => Promise<T>,
): Promise<T> {
  const tracer = trace.getTracer("artifact-hub");
  return tracer.startActiveSpan(input.operation, async (span) => {
    enrichActiveSpan();
    span.setAttribute(
      SemanticConventions.OPENINFERENCE_SPAN_KIND,
      OpenInferenceSpanKind.CHAIN,
    );
    if (input.meta) {
      for (const [key, value] of Object.entries(input.meta)) {
        span.setAttribute(`pipeline.${key}`, value);
      }
    }

    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw e;
    } finally {
      span.end();
      await flushPhoenix();
    }
  });
}

/** @deprecated Use registerObservability() from instrumentation.ts */
export function initPhoenix(): void {
  // Kept for backwards compatibility with log.ts re-exports.
}
