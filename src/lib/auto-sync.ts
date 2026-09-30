import { db } from "@/lib/db";
import { hasEnded } from "@/lib/events";
import { syncRosterIfStale } from "@/lib/roster";

const AUTO_SYNC_INTERVAL_MS = 60_000;

/**
 * Door scans happen in Luma, and nothing tells us about them. Without this
 * loop a check-in only reaches Stamp when someone happens to open a page, so
 * a quiet admin tab means nobody gets their credits email.
 */
async function syncLiveEvents() {
  const events = await db.event.findMany({
    select: { id: true, lumaEventId: true, startAt: true, endAt: true },
  });
  for (const event of events) {
    if (hasEnded(event)) continue;
    try {
      await syncRosterIfStale(event);
    } catch (error) {
      console.error(`[stamp] auto sync failed for ${event.lumaEventId}:`, error);
    }
  }
}

let started = false;

export function startAutoSync() {
  if (started) return;
  started = true;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await syncLiveEvents();
    } catch (error) {
      console.error("[stamp] auto sync pass failed:", error);
    } finally {
      running = false;
    }
  };
  setInterval(tick, AUTO_SYNC_INTERVAL_MS).unref();
  void tick();
  console.log("[stamp] auto roster sync started");
}
