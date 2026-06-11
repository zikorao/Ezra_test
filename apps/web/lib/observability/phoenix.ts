import {
  LLM_MODEL_NAME,
  LLM_PROVIDER,
  OpenInferenceSpanKind,
  register,
  SemanticConventions,
  SpanStatusCode,
  trace,
} from "@arizeai/phoenix-otel";
import type { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";

let provider: NodeTracerProvider | null = null;
let enabled = false;

function phoenixConfigured(): boolean {
  return Boolean(
    process.env.PHOENIX_API_KEY?.trim() ||
      process.env.PHOENIX_COLLECTOR_ENDPOINT?.trim(),
  );
}

/** Initialize Phoenix OTEL (call once per Node process). */
export function initPhoenix(): void {
  if (provider || !phoenixConfigured()) return;

  try {
    provider = register({
      projectName: process.env.PHOENIX_PROJECT_NAME?.trim() || "artifact-hub",
      url: process.env.PHOENIX_COLLECTOR_ENDPOINT?.trim(),
      apiKey: process.env.PHOENIX_API_KEY?.trim(),
      // Immediate export on serverless — avoids lost batches when the function freezes.
      batch: process.env.PHOENIX_BATCH === "true",
    });
    enabled = true;
  } catch (e) {
    console.warn(
      "[phoenix] init failed:",
      e instanceof Error ? e.message : e,
    );
  }
}

function ensurePhoenix(): void {
  if (!provider && phoenixConfigured()) initPhoenix();
}

export function isPhoenixEnabled(): boolean {
  ensurePhoenix();
  return enabled;
}

export async function flushPhoenix(): Promise<void> {
  if (!provider) return;
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
  ensurePhoenix();
  if (!enabled) return fn();

  const tracer = trace.getTracer("artifact-hub");
  return tracer.startActiveSpan(input.operation, async (span) => {
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
  ensurePhoenix();
  if (!enabled) return fn();

  const tracer = trace.getTracer("artifact-hub");
  return tracer.startActiveSpan(input.operation, async (span) => {
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
