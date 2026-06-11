import { flushPhoenix, isPhoenixEnabled, traceLlmCall, tracePipelineCall } from "./phoenix";

export type LlmLogEvent = {
  type: "llm";
  operation: string;
  provider: string;
  model: string;
  ok: boolean;
  ms: number;
  inputChars?: number;
  error?: string;
};

export type PipelineLogEvent = {
  type: "pipeline";
  operation: string;
  ok: boolean;
  ms: number;
  meta?: Record<string, string | number | boolean>;
  error?: string;
};

/** Structured JSON logs for Vercel / local stdout (layer 9). */
export function logEvent(event: LlmLogEvent | PipelineLogEvent): void {
  console.info(
    JSON.stringify({
      ts: new Date().toISOString(),
      ...event,
      ...(isPhoenixEnabled() ? { phoenix: true as const } : {}),
    }),
  );
}

export async function withPipelineTiming<T>(
  operation: string,
  meta: Record<string, string | number | boolean>,
  fn: () => Promise<T>,
): Promise<T> {
  return tracePipelineCall({ operation, meta }, async () => {
    const start = Date.now();
    try {
      const result = await fn();
      logEvent({
        type: "pipeline",
        operation,
        ok: true,
        ms: Date.now() - start,
        meta,
      });
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : "unknown error";
      logEvent({
        type: "pipeline",
        operation,
        ok: false,
        ms: Date.now() - start,
        meta,
        error: message.slice(0, 200),
      });
      throw e;
    }
  });
}

export async function withLlmTiming(
  operation: string,
  provider: string,
  model: string,
  inputChars: number,
  fn: () => Promise<string>,
): Promise<string> {
  return traceLlmCall({ operation, provider, model, inputChars }, async () => {
    const start = Date.now();
    try {
      const content = await fn();
      logEvent({
        type: "llm",
        operation,
        provider,
        model,
        ok: true,
        ms: Date.now() - start,
        inputChars,
      });
      return content;
    } catch (e) {
      const message = e instanceof Error ? e.message : "unknown error";
      logEvent({
        type: "llm",
        operation,
        provider,
        model,
        ok: false,
        ms: Date.now() - start,
        inputChars,
        error: message.slice(0, 200),
      });
      throw e;
    }
  });
}

export { flushPhoenix, initPhoenix, isPhoenixEnabled } from "./phoenix";
