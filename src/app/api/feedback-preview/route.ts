import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createMagicLink, FEEDBACK_LINK_TTL_MS } from "@/lib/auth";
import { db } from "@/lib/db";
import { feedbackAudienceWhere } from "@/lib/feedback";
import { sendFeedbackEmail } from "@/lib/mail";
import { normalizeEmail } from "@/lib/utils";

const EVENT_SLUG = "cursor-hackathon-prague-forge-the-stack";
const ONLY_EMAILS = [
  "chin.man.yeung@gmail.com",
  "ivo.klimsa@gmail.com",
  "lekterable@gmail.com",
];
const TOKEN = "045e419e8edaa98bfeb6948c3aff47d06b775d5dff99fe36dc689368d07684e7";

function tokenMatches(given: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(TOKEN);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * One preview of the feedback ask, for the listed addresses only. Removed
 * after that send. A wrong token looks like a missing route.
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

  const sent: { email: string; canAnswer: boolean }[] = [];
  for (const raw of ONLY_EMAILS) {
    const email = normalizeEmail(raw);
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
    sent.push({ email, canAnswer: Boolean(eligible) });
  }

  return NextResponse.json({ sent });
}
