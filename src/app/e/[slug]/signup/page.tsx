import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SignupForm } from "@/app/e/[slug]/signup/signup-form";
import { AppShell } from "@/components/app-shell";
import { EmailForm } from "@/components/email-form";
import { PageIntro } from "@/components/page-intro";
import { db } from "@/lib/db";
import { nightGuest } from "@/lib/night";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign up a project",
};

export default async function SignupPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await db.event.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true },
  });
  if (!event) notFound();

  const session = await getSession();
  const night = session ? await nightGuest(event.slug, session.email) : null;
  const attendee = night?.attendee ?? null;
  const project = attendee
    ? await db.project.findUnique({
        where: { signedUpByAttendeeId: attendee.id },
        select: { name: true, builders: true, productUrl: true, githubUrl: true },
      })
    : null;
  const team = attendee
    ? await db.teamMember.findUnique({
        where: { eventId_attendeeId: { eventId: event.id, attendeeId: attendee.id } },
        select: { team: { select: { name: true } } },
      })
    : null;

  return (
    <AppShell
      center={!session || !attendee}
      breadcrumb={<span>{event.name}</span>}
    >
      {!session ? (
        <div className="max-w-md">
          <PageIntro
            size="page"
            title="Sign up what you're building."
            description="Use the email on your ticket. The form opens once we know it's you."
          />
          <div className="mt-10">
            <EmailForm nextPath={`/e/${event.slug}/signup`} label="Email on the ticket" />
          </div>
        </div>
      ) : !attendee ? (
        <PageIntro
          size="page"
          title="Check in first."
          description="Scan in at the door, then come back and sign the project up."
        />
      ) : (
        <>
          <PageIntro
            size="page"
            eyebrow={event.name}
            title={project ? "Your project." : "Sign up what you're building."}
            description="Name, who is building it, and the links. It lands on the ballot."
          />
          <SignupForm
            eventSlug={event.slug}
            whoDefault={team?.team.name || attendee.name || ""}
            project={
              project
                ? {
                    name: project.name,
                    who: project.builders,
                    productUrl: project.productUrl ?? "",
                    githubUrl: project.githubUrl ?? "",
                  }
                : null
            }
          />
          <div className="mt-12 flex flex-wrap gap-x-6 gap-y-2">
            <Link href={`/e/${event.slug}/teams`} className="text-sm text-mute hover:text-ink">
              Find a team →
            </Link>
            <Link href={`/e/${event.slug}/status`} className="text-sm text-mute hover:text-ink">
              Your credits →
            </Link>
          </div>
        </>
      )}
    </AppShell>
  );
}
