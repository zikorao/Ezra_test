export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initPhoenix } = await import("./lib/observability/phoenix");
    initPhoenix();
  }
}
