import { createMagicLink, FEEDBACK_LINK_TTL_MS } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendFeedbackEmail } from "@/lib/mail";

const SEND_BATCH = 4;
const BATCH_GAP_MS = 1_100;

export const FEEDBACK_COMMENT_MAX = 2000;

/**
 * Who may be asked, and who may answer. A night that gates credits on the
 * door scan asks the people who were scanned. A night that does not, asks
 * anyone Luma approved, scanned or not.
 */
export function feedbackAudienceWhere(event: {
  id: string;
  perksRequireCheckIn: boolean;
}) {
  return {
    eventId: event.id,
    approvalStatus: { not: "declined" },
    ...(event.perksRequireCheckIn
      ? { checkedInAt: { not: null } }
      : {
          OR: [{ approvalStatus: "approved" }, { checkedInAt: { not: null } }],
        }),
  };
}

export function parseFeedbackScore(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const score = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(score) || score < 1 || score > 5) return null;
  return score;
}

/** Empty becomes null. Over the cap is refused rather than silently cut. */
export function parseFeedbackComment(
  value: unknown,
): { ok: string | null } | { error: string } {
  if (typeof value !== "string") return { ok: null };
  const trimmed = value.replace(/\r\n/g, "\n").trim();
  if (!trimmed) return { ok: null };
  if (trimmed.length > FEEDBACK_COMMENT_MAX) {
    return { error: "Keep the note under 2000 characters." };
  }
  return { ok: trimmed };
}

export type FeedbackSend = {
  sent: number;
  failed: number;
  /** Checked-in (or approved) people who had not been asked before this press. */
  waiting: number;
};

/**
 * Emails the feedback form to everyone owed it who has not already been
 * asked. A failed send clears the mark, so the next press retries only them.
 * Two presses at once claim the same rows once.
 */
export async function sendFeedbackAsks(event: {
  id: string;
  slug: string;
  name: string;
  perksRequireCheckIn: boolean;
}): Promise<FeedbackSend> {
  const rows = await db.eventAttendee.findMany({
    where: {
      ...feedbackAudienceWhere(event),
      feedbackAskedAt: null,
    },
    select: { id: true, email: true },
    orderBy: { checkedInAt: { sort: "asc", nulls: "last" } },
  });

  const byEmail = new Map<string, { email: string; ids: string[] }>();
  for (const row of rows) {
    const existing = byEmail.get(row.email);
    if (existing) existing.ids.push(row.id);
    else byEmail.set(row.email, { email: row.email, ids: [row.id] });
  }
  const waiting = [...byEmail.values()];

  let sent = 0;
  let failed = 0;
  for (let index = 0; index < waiting.length; index += SEND_BATCH) {
    const started = Date.now();
    const batch = waiting.slice(index, index + SEND_BATCH);
    const results = await Promise.allSettled(
      batch.map((attendee) => deliverAsk(event, attendee)),
    );
    for (const result of results) {
      if (result.status === "rejected") {
        failed += 1;
        console.error("[stamp] feedback email failed:", result.reason);
        continue;
      }
      if (result.value === "sent") sent += 1;
    }
    const remaining = BATCH_GAP_MS - (Date.now() - started);
    if (remaining > 0 && index + SEND_BATCH < waiting.length) {
      await wait(remaining);
    }
  }

  return { sent, failed, waiting: waiting.length };
}

async function deliverAsk(
  event: { slug: string; name: string },
  attendee: { email: string; ids: string[] },
): Promise<"sent" | "skipped"> {
  const claimed = await db.eventAttendee.updateMany({
    where: { id: { in: attendee.ids }, feedbackAskedAt: null },
    data: { feedbackAskedAt: new Date() },
  });
  if (claimed.count === 0) return "skipped";

  try {
    const url = await createMagicLink(
      attendee.email,
      `/e/${event.slug}/feedback`,
      FEEDBACK_LINK_TTL_MS,
    );
    try {
      await sendFeedbackEmail({
        email: attendee.email,
        url,
        eventName: event.name,
      });
    } catch (error) {
      if (!isRateLimit(error)) throw error;
      await wait(BATCH_GAP_MS);
      await sendFeedbackEmail({
        email: attendee.email,
        url,
        eventName: event.name,
      });
    }
    return "sent";
  } catch (error) {
    await db.eventAttendee.updateMany({
      where: { id: { in: attendee.ids } },
      data: { feedbackAskedAt: null },
    });
    throw error;
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimit(error: unknown): boolean {
  return error instanceof Error && error.message.includes("rate_limit_exceeded");
}
