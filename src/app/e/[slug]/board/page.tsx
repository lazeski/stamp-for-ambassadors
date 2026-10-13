import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckInWatcher } from "@/components/check-in-watcher";
import { db } from "@/lib/db";
import { hasEnded } from "@/lib/events";
import { syncRosterIfStale } from "@/lib/roster";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Check-in board",
};

const FRESH_MS = 3 * 60 * 1000;

function justScanned(checkedInAt: Date | null): boolean {
  if (!checkedInAt) return false;
  return Date.now() - checkedInAt.getTime() < FRESH_MS;
}

export default async function CheckInBoardPage({
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
      lumaEventId: true,
      startAt: true,
      endAt: true,
    },
  });
  if (!event) notFound();
  if (!hasEnded(event)) await syncRosterIfStale(event);

  const people = await db.eventAttendee.findMany({
    where: { eventId: event.id, checkedInAt: { not: null } },
    orderBy: { checkedInAt: "desc" },
    select: { id: true, name: true, checkedInAt: true },
  });
  return (
    <main className="min-h-dvh bg-ink px-6 py-8 text-paper sm:px-10 sm:py-12">
      <div className="flex items-baseline justify-between gap-6">
        <p className="text-sm tracking-wide text-paper/70">{event.name}</p>
        <Link href={`/e/${event.slug}`} className="text-sm text-paper/70 hover:text-paper">
          Event →
        </Link>
      </div>
      <p className="mt-10 font-display text-[6rem] leading-none tracking-heading sm:text-[8rem]">
        {people.length}
      </p>
      <p className="mt-3 text-lg text-paper/80">
        {people.length === 1 ? "person checked in" : "people checked in"}
      </p>
      {people.length > 0 ? (
        <ul className="mt-12 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
          {people.map((person) => {
            const fresh = justScanned(person.checkedInAt);
            const label = person.name?.trim() || "Checked in";
            return (
              <li key={person.id} className={fresh ? "text-lg" : "text-base text-paper/80"}>
                {label}
                {fresh ? <span className="ml-2 text-xs tracking-wide text-paper/60">now</span> : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-12 text-lg text-paper/70">Waiting for the first scan.</p>
      )}
      <CheckInWatcher intervalMs={8000} />
    </main>
  );
}
