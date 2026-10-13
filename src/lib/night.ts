import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/codes";
import { feedbackAudienceWhere } from "@/lib/feedback";
import { normalizeEmail } from "@/lib/utils";

export type NightResult = { error?: string; ok?: string };

export function parseHttpUrl(
  value: unknown,
  label: string,
): { ok: string | null } | { error: string } {
  if (typeof value !== "string") return { ok: null };
  const trimmed = value.trim();
  if (!trimmed) return { ok: null };
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { error: `${label} needs a full link, starting with https://` };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { error: `${label} needs a full link, starting with https://` };
  }
  return { ok: url.toString() };
}

export async function nightGuest(slug: string, rawEmail: string) {
  const event = await db.event.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      perksRequireCheckIn: true,
      startAt: true,
      endAt: true,
      votingOpenedAt: true,
      votingClosedAt: true,
    },
  });
  if (!event) return null;
  const attendee = await db.eventAttendee.findFirst({
    where: {
      ...feedbackAudienceWhere(event),
      email: normalizeEmail(rawEmail),
    },
    select: {
      id: true,
      name: true,
      email: true,
      lookingForTeam: true,
    },
    orderBy: { checkedInAt: { sort: "desc", nulls: "last" } },
  });
  return { event, attendee };
}

export async function saveSignup(input: {
  eventId: string;
  attendeeId: string;
  name: string;
  who: string;
  productUrl: string | null;
  githubUrl: string | null;
}): Promise<NightResult> {
  const existing = await db.project.findUnique({
    where: { signedUpByAttendeeId: input.attendeeId },
    select: { id: true },
  });
  if (existing) {
    await db.project.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        builders: input.who,
        productUrl: input.productUrl,
        githubUrl: input.githubUrl,
      },
    });
    return { ok: "Updated." };
  }

  const last = await db.project.findFirst({
    where: { eventId: input.eventId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  try {
    await db.project.create({
      data: {
        eventId: input.eventId,
        name: input.name,
        builders: input.who,
        productUrl: input.productUrl,
        githubUrl: input.githubUrl,
        signedUpByAttendeeId: input.attendeeId,
        sortOrder: (last?.sortOrder ?? 0) + 1,
      },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    await db.project.update({
      where: { signedUpByAttendeeId: input.attendeeId },
      data: {
        name: input.name,
        builders: input.who,
        productUrl: input.productUrl,
        githubUrl: input.githubUrl,
      },
    });
    return { ok: "Updated." };
  }
  return { ok: "Signed up." };
}

export async function startTeam(input: {
  eventId: string;
  attendeeId: string;
  name: string;
}): Promise<NightResult> {
  const already = await db.teamMember.findUnique({
    where: {
      eventId_attendeeId: {
        eventId: input.eventId,
        attendeeId: input.attendeeId,
      },
    },
    select: { id: true },
  });
  if (already) return { error: "You are already on a team. Leave it first." };

  try {
    await db.$transaction([
      db.team.create({
        data: {
          eventId: input.eventId,
          name: input.name,
          members: {
            create: {
              eventId: input.eventId,
              attendeeId: input.attendeeId,
              host: true,
            },
          },
        },
      }),
      db.eventAttendee.update({
        where: { id: input.attendeeId },
        data: { lookingForTeam: false },
      }),
    ]);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { error: "You are already on a team." };
    }
    throw error;
  }
  return { ok: `${input.name} is open. Checked-in people can join.` };
}

export async function setLooking(input: {
  eventId: string;
  attendeeId: string;
  looking: boolean;
}): Promise<NightResult> {
  const membership = await db.teamMember.findUnique({
    where: {
      eventId_attendeeId: {
        eventId: input.eventId,
        attendeeId: input.attendeeId,
      },
    },
    select: { id: true },
  });
  if (membership && input.looking) {
    return { error: "Leave your team before looking for another." };
  }
  await db.eventAttendee.update({
    where: { id: input.attendeeId },
    data: { lookingForTeam: input.looking },
  });
  return {
    ok: input.looking
      ? "You are on the board. Join a team when one fits."
      : "You are off the board.",
  };
}

export async function joinTeam(input: {
  eventId: string;
  attendeeId: string;
  teamId: string;
}): Promise<NightResult> {
  const team = await db.team.findFirst({
    where: { id: input.teamId, eventId: input.eventId },
    select: { id: true, name: true, open: true },
  });
  if (!team) return { error: "That team is gone." };
  if (!team.open) return { error: `${team.name} is closed.` };

  try {
    await db.$transaction([
      db.teamMember.create({
        data: {
          teamId: team.id,
          eventId: input.eventId,
          attendeeId: input.attendeeId,
        },
      }),
      db.eventAttendee.update({
        where: { id: input.attendeeId },
        data: { lookingForTeam: false },
      }),
    ]);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { error: "You are already on a team." };
    }
    throw error;
  }
  return { ok: `You joined ${team.name}.` };
}

export async function leaveTeam(input: {
  eventId: string;
  attendeeId: string;
}): Promise<NightResult> {
  const membership = await db.teamMember.findUnique({
    where: {
      eventId_attendeeId: {
        eventId: input.eventId,
        attendeeId: input.attendeeId,
      },
    },
    select: { id: true, teamId: true, host: true },
  });
  if (!membership) return { error: "You are not on a team." };

  await db.$transaction(async (tx) => {
    const members = await tx.teamMember.findMany({
      where: { teamId: membership.teamId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (members.length <= 1) {
      await tx.team.delete({ where: { id: membership.teamId } });
      return;
    }
    await tx.teamMember.delete({ where: { id: membership.id } });
    if (membership.host) {
      const next = members.find((member) => member.id !== membership.id);
      if (next) {
        await tx.teamMember.update({
          where: { id: next.id },
          data: { host: true },
        });
      }
    }
  });
  return { ok: "You left the team." };
}

export async function setTeamOpen(input: {
  eventId: string;
  attendeeId: string;
  open: boolean;
}): Promise<NightResult> {
  const membership = await hostMembership(input.eventId, input.attendeeId);
  if (!membership) return { error: "Only the person who started the team can do that." };
  await db.team.update({
    where: { id: membership.teamId },
    data: { open: input.open },
  });
  return { ok: input.open ? "The team is open." : "The team is closed." };
}

export async function removeTeammate(input: {
  eventId: string;
  attendeeId: string;
  memberId: string;
}): Promise<NightResult> {
  const membership = await hostMembership(input.eventId, input.attendeeId);
  if (!membership) return { error: "Only the person who started the team can do that." };
  if (membership.id === input.memberId) {
    return { error: "Leave the team if you want off it." };
  }
  const removed = await db.teamMember.deleteMany({
    where: { id: input.memberId, teamId: membership.teamId },
  });
  if (removed.count === 0) return { error: "They are already off the team." };
  return { ok: "Removed." };
}

async function hostMembership(eventId: string, attendeeId: string) {
  const membership = await db.teamMember.findUnique({
    where: { eventId_attendeeId: { eventId, attendeeId } },
    select: { id: true, teamId: true, host: true },
  });
  if (!membership?.host) return null;
  return membership;
}
