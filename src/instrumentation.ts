export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { getServerLogger } = await import("./server/logging/logger");
  getServerLogger().info("application_started", {
    runtime: "nodejs",
  });
}
