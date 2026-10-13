import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  JoinForm,
  LeaveForm,
  LookForm,
  OpenForm,
  RemoveForm,
  StartTeamForm,
} from "@/app/e/[slug]/teams/team-forms";
import { AppShell } from "@/components/app-shell";
import { EmailForm } from "@/components/email-form";
import { PageIntro } from "@/components/page-intro";
import { db } from "@/lib/db";
import { hasEnded } from "@/lib/events";
import { feedbackAudienceWhere } from "@/lib/feedback";
import { nightGuest } from "@/lib/night";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Find a team",
};

function personName(person: { name: string | null }) {
  return person.name?.trim() || "Checked in";
}

export default async function TeamsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await db.event.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      perksRequireCheckIn: true,
      startAt: true,
      endAt: true,
    },
  });
  if (!event) notFound();

  const session = await getSession();
  const night = session ? await nightGuest(event.slug, session.email) : null;
  const attendee = night?.attendee ?? null;

  const [teams, looking] = await Promise.all([
    db.team.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        open: true,
        members: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            host: true,
            attendee: { select: { id: true, name: true } },
          },
        },
      },
    }),
    db.eventAttendee.findMany({
      where: { ...feedbackAudienceWhere(event), lookingForTeam: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const ended = hasEnded(event);
  const mine = attendee
    ? teams.find((team) => team.members.some((member) => member.attendee.id === attendee.id))
    : undefined;
  const mineMembership = mine?.members.find((member) => member.attendee.id === attendee?.id);
  const openTeams = teams.filter((team) => team.open && team.id !== mine?.id);
  const closedTeams = teams.filter((team) => !team.open && team.id !== mine?.id);

  return (
    <AppShell center={!session || !attendee} breadcrumb={<span>{event.name}</span>}>
      {!session ? (
        <div className="max-w-md">
          <PageIntro
            size="page"
            title="Find a team."
            description="Use the email on your ticket. You can start a team or join one after you check in."
          />
          <div className="mt-10">
            <EmailForm nextPath={`/e/${event.slug}/teams`} label="Email on the ticket" />
          </div>
        </div>
      ) : !attendee ? (
        <PageIntro
          size="page"
          title="Check in first."
          description="Teams are for people who were scanned in at the door."
        />
      ) : (
        <>
          <PageIntro
            size="page"
            eyebrow={event.name}
            title={mine ? mine.name : "Find a team."}
            description={
              ended
                ? "Teams closed with the night. This is who built together."
                : mine
                  ? mine.open
                    ? "Anyone checked in can still join."
                    : "This team is closed."
                  : "Start one, or join one that is open. Only people scanned in at the door are here."
            }
          />

          {mine && mineMembership ? (
            <section className="mt-10 max-w-md">
              <ul className="border-y border-line">
                {mine.members.map((member) => (
                  <li
                    key={member.id}
                    className="flex items-baseline justify-between gap-4 border-b border-line py-3 last:border-b-0"
                  >
                    <p className="text-sm">
                      {personName(member.attendee)}
                      {member.host ? <span className="text-mute"> · started it</span> : null}
                    </p>
                    {!ended && mineMembership.host && !member.host ? (
                      <RemoveForm eventSlug={event.slug} memberId={member.id} />
                    ) : null}
                  </li>
                ))}
              </ul>
              {ended ? null : (
                <>
                  {mineMembership.host ? (
                    <OpenForm eventSlug={event.slug} open={mine.open} />
                  ) : null}
                  <LeaveForm eventSlug={event.slug} />
                </>
              )}
            </section>
          ) : ended ? null : (
            <>
              <LookForm eventSlug={event.slug} looking={attendee.lookingForTeam} />
              <StartTeamForm eventSlug={event.slug} />
            </>
          )}

          {openTeams.length > 0 ? (
            <section className="mt-14">
              <p className="eyebrow">Open teams</p>
              <ul className="mt-4 border-t border-line">
                {openTeams.map((team) => (
                  <li key={team.id} className="border-b border-line py-5">
                    <p className="text-sm">{team.name}</p>
                    <p className="mt-1 text-xs text-mute">
                      {team.members.length} {team.members.length === 1 ? "person" : "people"}
                      {" · "}
                      {team.members.map((member) => personName(member.attendee)).join(", ")}
                    </p>
                    {mine || ended ? null : <JoinForm eventSlug={event.slug} teamId={team.id} />}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {closedTeams.length > 0 ? (
            <section className="mt-14">
              <p className="eyebrow">Closed</p>
              <ul className="mt-4 border-t border-line">
                {closedTeams.map((team) => (
                  <li key={team.id} className="border-b border-line py-5">
                    <p className="text-sm">{team.name}</p>
                    <p className="mt-1 text-xs text-mute">
                      {team.members.map((member) => personName(member.attendee)).join(", ")}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="mt-14">
            <p className="eyebrow">Looking</p>
            {looking.length > 0 ? (
              <ul className="mt-4 border-t border-line">
                {looking.map((person) => (
                  <li key={person.id} className="border-b border-line py-3 text-sm">
                    {person.name?.trim() || "Checked in"}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-mute">Nobody is looking right now.</p>
            )}
          </section>

          <div className="mt-12 flex flex-wrap gap-x-6 gap-y-2">
            <Link href={`/e/${event.slug}/signup`} className="text-sm text-mute hover:text-ink">
              Sign up a project →
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
