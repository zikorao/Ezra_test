import { getDefaultSpanProcessor } from "@arizeai/phoenix-otel";
import { SEMRESATTRS_PROJECT_NAME } from "@arizeai/openinference-semantic-conventions";
import { registerOTel } from "@vercel/otel";
import type { SpanProcessor } from "@opentelemetry/sdk-trace-base";

export function phoenixConfigured(): boolean {
  return Boolean(
    process.env.PHOENIX_API_KEY?.trim() ||
      process.env.PHOENIX_COLLECTOR_ENDPOINT?.trim(),
  );
}

/**
 * Single OTEL registration: Vercel platform traces ("auto") + optional Phoenix export.
 * Keeps request spans in Vercel Observability while mirroring LLM/pipeline spans to Phoenix.
 */
export function registerObservability(): void {
  const projectName =
    process.env.PHOENIX_PROJECT_NAME?.trim() || "artifact-hub";
  const spanProcessors: Array<SpanProcessor | "auto"> = ["auto"];

  if (phoenixConfigured()) {
    spanProcessors.push(
      getDefaultSpanProcessor({
        url:
          process.env.PHOENIX_COLLECTOR_ENDPOINT?.trim() ||
          "https://app.phoenix.arize.com",
        apiKey: process.env.PHOENIX_API_KEY?.trim(),
        batch: process.env.PHOENIX_BATCH === "true",
      }),
    );
  }

  registerOTel({
    serviceName: "artifact-hub",
    attributes: {
      [SEMRESATTRS_PROJECT_NAME]: projectName,
    },
    spanProcessors,
  });
}
