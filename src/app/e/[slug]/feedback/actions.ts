"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  feedbackAudienceWhere,
  parseFeedbackComment,
  parseFeedbackScore,
} from "@/lib/feedback";
import { getSession } from "@/lib/session";
import { normalizeEmail } from "@/lib/utils";

export type FeedbackActionResult = { error?: string; ok?: string } | undefined;

export async function saveFeedback(
  _prev: FeedbackActionResult,
  formData: FormData,
): Promise<FeedbackActionResult> {
  const session = await getSession();
  if (!session) redirect("/");

  const slug = String(formData.get("eventSlug") ?? "");
  const event = await db.event.findUnique({
    where: { slug },
    select: { id: true, slug: true, perksRequireCheckIn: true },
  });
  if (!event) return { error: "This event is gone." };

  const attendee = await db.eventAttendee.findFirst({
    where: {
      ...feedbackAudienceWhere(event),
      email: normalizeEmail(session.email),
    },
    select: { id: true },
    orderBy: { checkedInAt: { sort: "desc", nulls: "last" } },
  });
  if (!attendee) {
    return {
      error: event.perksRequireCheckIn
        ? "This form is for people who were scanned in at the door."
        : "This form is for people with an approved registration.",
    };
  }

  const score = parseFeedbackScore(formData.get("score"));
  if (score === null) return { error: "Pick a score from 1 to 5." };

  const comment = parseFeedbackComment(formData.get("comment"));
  if ("error" in comment) return { error: comment.error };

  await db.feedback.upsert({
    where: { attendeeId: attendee.id },
    create: {
      eventId: event.id,
      attendeeId: attendee.id,
      score,
      comment: comment.ok,
    },
    update: { score, comment: comment.ok },
  });

  revalidatePath(`/e/${event.slug}/feedback`);
  revalidatePath(`/admin/e/${event.slug}`);
  return { ok: "Saved." };
}
