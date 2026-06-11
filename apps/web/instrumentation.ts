export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerObservability } = await import("./lib/observability/otel");
    registerObservability();
  }
}
