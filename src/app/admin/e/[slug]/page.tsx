import Link from "next/link";
import { requireEventManager } from "@/app/actions";
import {
  AssignHostsForm,
  RefreshLumaForm,
} from "@/app/admin/host-forms";
import { FeedbackSendForm } from "@/app/admin/e/[slug]/feedback-send";
import {
  CodePool,
  DeletePartnerButton,
  EditPartnerForm,
  LeftoverForm,
  GuideForm,
  UploadForm,
} from "@/app/admin/e/[slug]/inventory-forms";
import { AppShell } from "@/components/app-shell";
import { Fold } from "@/components/fold";
import { PageIntro } from "@/components/page-intro";
import { SignOutButton } from "@/components/session-actions";
import { StampCard } from "@/components/stamp-card";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import {
  formatEventWhen,
  hasEnded,
  isFixtureEvent,
  isUpcomingEvent,
} from "@/lib/events";
import { feedbackAudienceWhere } from "@/lib/feedback";
import { hostedBy, syncEventHostsIfStale } from "@/lib/hosts";
import { partnersFor } from "@/lib/partners";
import { syncRosterIfStale } from "@/lib/roster";
import { voterCount, votingState } from "@/lib/voting";

export const dynamic = "force-dynamic";

export default async function AdminEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { organizer, event } = await requireEventManager(slug);

  const [sponsors, otherEvents, hosts] = await Promise.all([
    db.sponsor.findMany({
      where: partnersFor(event.id),
      orderBy: { sortOrder: "asc" },
      select: {
        slug: true,
        name: true,
        perk: true,
        instructions: true,
        codes: {
          where: { eventId: event.id },
          select: {
            id: true,
            code: true,
            claimedAt: true,
            claimedByAttendeeId: true,
            claimedBy: { select: { name: true, email: true, checkedInAt: true } },
          },
        },
      },
    }),
    db.event.findMany({
      where: {
        id: { not: event.id },
        ...(organizer.admin ? {} : hostedBy(organizer.host?.id)),
      },
      orderBy: { createdAt: "desc" },
      select: {
        slug: true,
        name: true,
        lumaEventId: true,
        startAt: true,
        endAt: true,
      },
    }),
    organizer.admin
      ? db.host.findMany({
          where: { confirmedAt: { not: null } },
          orderBy: { email: "asc" },
          select: { id: true, email: true },
        })
      : Promise.resolve([]),
    hasEnded(event) ? Promise.resolve() : syncRosterIfStale(event),
    syncEventHostsIfStale(event),
  ]);

  const audienceWhere = feedbackAudienceWhere(event);
  const [projectCount, voters, audience, asked, replies] = await Promise.all([
    db.project.count({ where: { eventId: event.id } }),
    voterCount(event.id),
    db.eventAttendee.count({ where: audienceWhere }),
    db.eventAttendee.count({
      where: { ...audienceWhere, feedbackAskedAt: { not: null } },
    }),
    db.feedback.findMany({
      where: { eventId: event.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        score: true,
        comment: true,
        updatedAt: true,
        attendee: { select: { name: true, email: true } },
      },
    }),
  ]);
  const unasked = Math.max(0, audience - asked);
  const average =
    replies.length === 0
      ? null
      : (replies.reduce((sum, row) => sum + row.score, 0) / replies.length).toFixed(1);

  const when = formatEventWhen(event.startAt, event.timezone);
  const voting = votingState(event);
  const pooled = sponsors
    .filter((sponsor) => sponsor.codes.length > 0)
    .map((sponsor) => {
      const leftover = sponsor.codes
        .filter((row) => !row.claimedByAttendeeId)
        .map((row) => ({ id: row.id, code: row.code }));
      const claims = sponsor.codes
        .filter((row) => row.claimedBy && row.claimedByAttendeeId)
        .sort(
          (a, b) =>
            (b.claimedAt?.getTime() ?? 0) - (a.claimedAt?.getTime() ?? 0),
        )
        .map((row) => ({
          id: row.id,
          name: row.claimedBy?.name ?? null,
          email: row.claimedBy?.email ?? "",
          when: formatEventWhen(row.claimedBy?.checkedInAt, event.timezone),
        }));
      return {
        slug: sponsor.slug,
        name: sponsor.name,
        leftover,
        claims,
      };
    });

  return (
    <AppShell
      breadcrumb={
        <>
          <Link href="/admin" className="hover:opacity-60">
            {organizer.admin ? "Admin" : "Host"}
          </Link>
          <span className="text-mute" aria-hidden>
            {" "}·{" "}
          </span>
          <span>{event.name}</span>
        </>
      }
      actions={
        <div className="flex items-center gap-5">
          <Link
            href={`/e/${event.slug}`}
            className="text-sm text-ink hover:opacity-60"
          >
            Event page →
          </Link>
          <SignOutButton />
        </div>
      }
    >
      <PageIntro eyebrow="Inventory" title={event.name} />

      <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-5">
        {when ? (
          <div>
            <dt className="eyebrow">When</dt>
            <dd className="mt-2 text-sm tracking-tight">{when}</dd>
          </div>
        ) : null}
        {event.location ? (
          <div>
            <dt className="eyebrow">Where</dt>
            <dd className="mt-2 text-sm tracking-tight">{event.location}</dd>
          </div>
        ) : null}
        <div>
          <dt className="eyebrow">Check-in</dt>
          <dd className="mt-2 text-sm tracking-tight">
            {event.perksRequireCheckIn
              ? "Door scan required"
              : "Approved registration is enough"}
          </dd>
        </div>
        <div>
          <dt className="eyebrow">Event ID</dt>
          <dd className="mt-2 font-mono text-sm tracking-tight">
            {event.lumaEventId}
            {event.lumaUrl ? (
              <>
                <span className="font-sans text-mute"> · </span>
                <a
                  href={event.lumaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-sans hover:opacity-60"
                >
                  Luma ↗
                </a>
              </>
            ) : null}
          </dd>
        </div>
      </dl>

      <div className="mt-14">
        <p className="eyebrow mb-6">Credits</p>
        {pooled.length === 0 ? (
          <>
            <p className="text-sm text-mute">
              Nothing uploaded yet. The CSV you were sent goes in here.
            </p>
            <UploadForm
              eventSlug={event.slug}
              sponsors={sponsors.map((s) => ({ slug: s.slug, name: s.name }))}
            />
            {sponsors
              .filter((sponsor) => sponsor.slug !== "cursor")
              .map((sponsor) => (
                <section key={sponsor.slug} className="border-t border-line py-8">
                  <h2 className="font-display text-2xl tracking-heading">
                    {sponsor.name}
                  </h2>
                  <p className="mt-2 text-sm text-mute">No codes on this event.</p>
                  <Fold title="Edit" summary="Name and steps">
                    <EditPartnerForm eventSlug={event.slug} sponsor={sponsor} />
                  </Fold>
                  <DeletePartnerButton
                    eventSlug={event.slug}
                    sponsorSlug={sponsor.slug}
                  />
                </section>
              ))}
          </>
        ) : (
          <>
            {pooled.map((pool) => {
              const source = sponsors.find((row) => row.slug === pool.slug);
              return (
                <section key={pool.slug} className="border-t border-line py-8">
                  <div className="flex flex-wrap items-baseline justify-between gap-4">
                    <h2 className="font-display text-2xl tracking-heading">
                      {pool.name}
                    </h2>
                    <p className="font-mono text-[11px] tracking-wide text-mute">
                      {pool.claims.length} claimed · {pool.leftover.length}{" "}
                      left · {pool.claims.length + pool.leftover.length} total
                    </p>
                  </div>
                  <CodePool eventSlug={event.slug} pool={pool} />
                  {pool.slug === "cursor" || !source ? null : (
                    <>
                      <Fold title="Edit" summary="Name and steps">
                        <EditPartnerForm eventSlug={event.slug} sponsor={source} />
                      </Fold>
                      <DeletePartnerButton
                        eventSlug={event.slug}
                        sponsorSlug={pool.slug}
                      />
                    </>
                  )}
                </section>
              );
            })}
            {sponsors
              .filter(
                (sponsor) =>
                  sponsor.slug !== "cursor" &&
                  !pooled.some((row) => row.slug === sponsor.slug),
              )
              .map((sponsor) => (
                <section key={sponsor.slug} className="border-t border-line py-8">
                  <h2 className="font-display text-2xl tracking-heading">
                    {sponsor.name}
                  </h2>
                  <p className="mt-2 text-sm text-mute">No codes on this event.</p>
                  <Fold title="Edit" summary="Name and steps">
                    <EditPartnerForm eventSlug={event.slug} sponsor={sponsor} />
                  </Fold>
                  <DeletePartnerButton
                    eventSlug={event.slug}
                    sponsorSlug={sponsor.slug}
                  />
                </section>
              ))}
            <Fold
              title="Add codes"
              summary="CSV"
              hint="The file you were sent. One code per line. Leftovers can be removed from the pool above; claimed codes stay with their guest."
            >
              <UploadForm
                eventSlug={event.slug}
                sponsors={sponsors.map((s) => ({ slug: s.slug, name: s.name }))}
              />
            </Fold>
          </>
        )}
        <Fold
          title="How-to"
          summary="No codes"
          hint="Steps for an offer that has no file. Shown to guests stamped at this event. What you write stays in this database."
        >
          <GuideForm eventSlug={event.slug} />
        </Fold>
      </div>

      <StampCard className="mt-20 max-w-md">
        <p className="eyebrow">Open mic</p>
        <h2 className="mt-4 font-display text-2xl tracking-heading">
          {voting === "open"
            ? "Voting is open."
            : voting === "closed"
              ? "Voting is closed."
              : "Not open yet."}
        </h2>
        <p className="mt-3 text-sm leading-6 text-mute">
          {voting === "idle"
            ? "Write projects in as they present, then open the vote."
            : `${projectCount} ${projectCount === 1 ? "project" : "projects"} on the ballot · ${voters} ${voters === 1 ? "vote" : "votes"} in`}
        </p>
        <Button asChild variant="primary" className="mt-6">
          <Link href={`/admin/e/${event.slug}/vote`}>
            {voting === "idle" ? "Run the open mic" : "Manage the ballot"}
          </Link>
        </Button>
      </StampCard>

      <div className="mt-8">
        <StampCard className="max-w-md">
          <p className="eyebrow">Feedback</p>
          <h2 className="mt-4 font-display text-2xl tracking-heading">
            {average ? `${average} average.` : "Ask how the night went."}
          </h2>
          <p className="mt-3 text-sm leading-6 text-mute">
            One score from 1 to 5, and a note. The email goes to people who{" "}
            {event.perksRequireCheckIn
              ? "were scanned in"
              : "have an approved registration"}{" "}
            and do not have the link yet. The link works for two weeks.
          </p>
          <p className="mt-4 text-sm leading-6 text-mute">
            {replies.length === 0
              ? `No replies yet. ${asked} ${asked === 1 ? "person has" : "people have"} the email.`
              : `${replies.length} ${replies.length === 1 ? "reply" : "replies"} so far. ${asked} ${asked === 1 ? "person has" : "people have"} the email.`}
          </p>
          {replies.length > 0 ? (
            <p className="mt-1 text-sm leading-6 text-mute">{scoreSummary(replies)}</p>
          ) : null}
          {audience === 0 ? (
            <p className="mt-6 text-sm text-mute">
              {event.perksRequireCheckIn
                ? "Nobody has been scanned in yet."
                : "Nobody with an approved registration yet."}
            </p>
          ) : (
            <FeedbackSendForm eventSlug={event.slug} count={unasked} />
          )}
          <Link
            href={`/e/${event.slug}/feedback`}
            className="mt-5 inline-block text-sm text-ink hover:opacity-60"
          >
            Open the form →
          </Link>
        </StampCard>

        {replies.length > 0 ? (
          <ul className="mt-8 border-t border-line">
            {replies.map((row) => {
              const name = row.attendee.name?.trim();
              const when = formatEventWhen(row.updatedAt, event.timezone);
              return (
                <li key={row.id} className="border-b border-line py-5">
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="text-sm">{name || row.attendee.email}</p>
                    <p className="shrink-0 font-mono text-sm">{row.score} / 5</p>
                  </div>
                  {name ? (
                    <p className="mt-1 text-xs text-mute">{row.attendee.email}</p>
                  ) : null}
                  {when ? <p className="mt-1 text-xs text-mute">{when}</p> : null}
                  {row.comment ? (
                    <p className="mt-3 max-w-xl text-sm leading-6 whitespace-pre-wrap">
                      {row.comment}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      <div className="mt-20">
        <p className="eyebrow mb-6">Setup</p>

        {isFixtureEvent(event) ? null : (
          <Fold
            title="Leftovers"
            summary="Move unclaimed"
            hint="Unclaimed rows move to another event you manage. Claimed codes stay put."
          >
            <LeftoverForm
              fromSlug={event.slug}
              sponsors={sponsors.map((s) => ({ slug: s.slug, name: s.name }))}
              events={otherEvents.filter(
                (row) => isUpcomingEvent(row) && !isFixtureEvent(row),
              )}
            />
          </Fold>
        )}

        <Fold
          title="Luma details"
          summary="Re-sync"
          hint="Pulls the event name, times, cover, Luma hosts, and re-syncs the guest list and door scans."
        >
          <RefreshLumaForm eventSlug={event.slug} />
        </Fold>

        {organizer.admin && hosts.length > 0 ? (
          <Fold
            title="Hosts"
            summary={`${hosts.length} confirmed`}
            hint="Luma hosts are appointed automatically but wait on confirmation, which happens on /admin. Admins can add extras for this event here."
          >
            <AssignHostsForm
              eventSlug={event.slug}
              hosts={hosts}
              appointedHostIds={event.hosts.map((host) => host.id)}
            />
          </Fold>
        ) : null}
      </div>
    </AppShell>
  );
}

function scoreSummary(replies: { score: number }[]): string {
  const parts = [5, 4, 3, 2, 1].flatMap((score) => {
    const count = replies.filter((row) => row.score === score).length;
    if (count === 0) return [];
    const people = count === 1 ? "person gave" : "people gave";
    return [`${count} ${people} a ${score}`];
  });
  return `${parts.join(". ")}.`;
}
