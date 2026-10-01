import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FeedbackForm } from "@/app/e/[slug]/feedback/feedback-form";
import { AppShell } from "@/components/app-shell";
import { EmailForm } from "@/components/email-form";
import { PageIntro } from "@/components/page-intro";
import { db } from "@/lib/db";
import { feedbackAudienceWhere } from "@/lib/feedback";
import { getSession } from "@/lib/session";
import { normalizeEmail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "How was the night?",
};

export default async function FeedbackPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await db.event.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, perksRequireCheckIn: true },
  });
  if (!event) notFound();

  const session = await getSession();
  const nextPath = `/e/${event.slug}/feedback`;
  const who = event.perksRequireCheckIn
    ? "people who were scanned in at the door"
    : "people with an approved registration";

  const attendee = session
    ? await db.eventAttendee.findFirst({
        where: {
          ...feedbackAudienceWhere(event),
          email: normalizeEmail(session.email),
        },
        select: {
          name: true,
          feedback: { select: { score: true, comment: true } },
        },
        orderBy: { checkedInAt: { sort: "desc", nulls: "last" } },
      })
    : null;

  const saved = attendee?.feedback ?? null;
  const greeting = attendee?.name?.split(" ")[0];

  return (
    <AppShell
      center={!session || !attendee}
      breadcrumb={
        <>
          <span>{event.name}</span>
        </>
      }
    >
      {!session ? (
        <div className="max-w-md">
          <PageIntro
            size="page"
            title="How was the night?"
            description="A link to the email on your ticket. Once you open it, the form already knows it's you."
          />
          <div className="mt-10">
            <EmailForm nextPath={nextPath} label="Email on the ticket" />
          </div>
        </div>
      ) : (
        <>
          <PageIntro
            size="page"
            eyebrow={event.name}
            title={
              saved
                ? "Saved."
                : greeting
                  ? `${greeting}, how was the night?`
                  : "How was the night?"
            }
            description={
              !attendee
                ? "This is the page guests get. One score, and an optional note."
                : saved
                  ? "Change it if you want. This is what the organizers have."
                  : "One score, and anything you want the organizers to know."
            }
          />
          <FeedbackForm
            eventSlug={event.slug}
            score={saved?.score ?? null}
            comment={saved?.comment ?? null}
            lockedReason={
              attendee
                ? undefined
                : `This email isn't on the list. Replies are saved for ${who}.`
            }
          />
          <Link
            href={`/e/${event.slug}/status`}
            className="mt-12 inline-block text-sm text-mute hover:text-ink"
          >
            Your credits →
          </Link>
        </>
      )}
    </AppShell>
  );
}
