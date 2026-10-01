import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createMagicLink, FEEDBACK_LINK_TTL_MS } from "@/lib/auth";
import { db } from "@/lib/db";
import { feedbackAudienceWhere } from "@/lib/feedback";
import { sendFeedbackEmail } from "@/lib/mail";
import { normalizeEmail } from "@/lib/utils";

const EVENT_SLUG = "cursor-hackathon-prague-forge-the-stack";
const ONLY_EMAIL = "dejanlazeski@gmail.com";
const TOKEN = "81d6535435d87463dd3a3a8867b2269b7762ba00c5569d7a5207487a3ebb9f6b";

function tokenMatches(given: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(TOKEN);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * One preview of the feedback ask, for a single address. Removed after that
 * send. A wrong token looks like a missing route.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token : "";
  if (!tokenMatches(token)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const event = await db.event.findUnique({
    where: { slug: EVENT_SLUG },
    select: { id: true, slug: true, name: true, perksRequireCheckIn: true },
  });
  if (!event) {
    return NextResponse.json({ error: "missing_event" }, { status: 404 });
  }

  const email = normalizeEmail(ONLY_EMAIL);
  const eligible = await db.eventAttendee.findFirst({
    where: { ...feedbackAudienceWhere(event), email },
    select: { id: true },
  });

  const url = await createMagicLink(
    email,
    `/e/${event.slug}/feedback`,
    FEEDBACK_LINK_TTL_MS,
  );
  await sendFeedbackEmail({ email, url, eventName: event.name });

  if (eligible) {
    await db.eventAttendee.updateMany({
      where: { eventId: event.id, email },
      data: { feedbackAskedAt: new Date() },
    });
  }

  return NextResponse.json({ sent: true, canAnswer: Boolean(eligible) });
}
