export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.RENDER !== "true") return;
  // Loaded lazily so the edge build never pulls in Prisma.
  const { startAutoSync } = await import("@/lib/auto-sync");
  startAutoSync();
}
