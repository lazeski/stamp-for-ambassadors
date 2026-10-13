"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  joinTeam,
  leaveTeam,
  nightGuest,
  parseHttpUrl,
  removeTeammate,
  saveSignup,
  setLooking,
  setTeamOpen,
  startTeam,
  type NightResult,
} from "@/lib/night";
import { hasEnded } from "@/lib/events";
import { votingState, type VotingState } from "@/lib/voting";
import { getSession } from "@/lib/session";

async function guestOf(slug: string) {
  const session = await getSession();
  if (!session) redirect(`/e/${slug}`);
  const night = await nightGuest(slug, session.email);
  if (!night) return { error: "This event is gone." } as const;
  if (!night.attendee) {
    return { error: "Check in at the door first." } as const;
  }
  return { event: night.event, attendee: night.attendee };
}

function signupNotice(state: VotingState, updated: boolean): string {
  if (updated) return "Updated.";
  switch (state) {
    case "idle":
      return "Signed up. It will be on the ballot when voting opens.";
    case "open":
      return "Signed up. It is on the ballot.";
    case "closed":
      return "Saved. Voting is already closed, so this stays on the record.";
    default: {
      const unreachable: never = state;
      return unreachable;
    }
  }
}

function teamsClosed(event: { startAt: Date | null; endAt: Date | null }): NightResult | null {
  if (!hasEnded(event)) return null;
  return { error: "Teams closed with the night." };
}

function refresh(slug: string) {
  revalidatePath(`/e/${slug}/signup`);
  revalidatePath(`/e/${slug}/teams`);
  revalidatePath(`/e/${slug}/projects`);
  revalidatePath(`/e/${slug}/status`);
  revalidatePath(`/e/${slug}/board`);
  revalidatePath(`/admin/e/${slug}/vote`);
}

export async function saveProjectSignup(
  _prev: NightResult | undefined,
  formData: FormData,
): Promise<NightResult> {
  const slug = String(formData.get("eventSlug") ?? "");
  const gate = await guestOf(slug);
  if ("error" in gate && gate.error) return gate;

  const parsed = z
    .object({
      name: z.string().trim().min(1, "Name the project.").max(120),
      who: z.string().trim().min(1, "Say who is building it.").max(200),
    })
    .safeParse({
      name: formData.get("name"),
      who: formData.get("who"),
    });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const product = parseHttpUrl(formData.get("productUrl"), "The product link");
  if ("error" in product) return product;
  const github = parseHttpUrl(formData.get("githubUrl"), "The GitHub link");
  if ("error" in github) return github;

  const saved = await saveSignup({
    eventId: gate.event.id,
    attendeeId: gate.attendee.id,
    name: parsed.data.name,
    who: parsed.data.who,
    productUrl: product.ok,
    githubUrl: github.ok,
  });
  refresh(gate.event.slug);
  if (saved.error) return saved;
  return { ok: signupNotice(votingState(gate.event), saved.ok === "Updated.") };
}

export async function createTeam(
  _prev: NightResult | undefined,
  formData: FormData,
): Promise<NightResult> {
  const slug = String(formData.get("eventSlug") ?? "");
  const gate = await guestOf(slug);
  if ("error" in gate && gate.error) return gate;
  const closed = teamsClosed(gate.event);
  if (closed) return closed;
  const name = z.string().trim().min(1, "Name the team.").max(80).safeParse(formData.get("name"));
  if (!name.success) return { error: name.error.issues[0]?.message ?? "Name the team." };
  const result = await startTeam({
    eventId: gate.event.id,
    attendeeId: gate.attendee.id,
    name: name.data,
  });
  refresh(gate.event.slug);
  return result;
}

export async function lookForTeam(
  _prev: NightResult | undefined,
  formData: FormData,
): Promise<NightResult> {
  const slug = String(formData.get("eventSlug") ?? "");
  const gate = await guestOf(slug);
  if ("error" in gate && gate.error) return gate;
  const closed = teamsClosed(gate.event);
  if (closed) return closed;
  const looking = formData.get("looking") === "yes";
  const result = await setLooking({
    eventId: gate.event.id,
    attendeeId: gate.attendee.id,
    looking,
  });
  refresh(gate.event.slug);
  return result;
}

export async function joinOpenTeam(
  _prev: NightResult | undefined,
  formData: FormData,
): Promise<NightResult> {
  const slug = String(formData.get("eventSlug") ?? "");
  const gate = await guestOf(slug);
  if ("error" in gate && gate.error) return gate;
  const closed = teamsClosed(gate.event);
  if (closed) return closed;
  const result = await joinTeam({
    eventId: gate.event.id,
    attendeeId: gate.attendee.id,
    teamId: String(formData.get("teamId") ?? ""),
  });
  refresh(gate.event.slug);
  return result;
}

export async function leaveMyTeam(
  _prev: NightResult | undefined,
  formData: FormData,
): Promise<NightResult> {
  const slug = String(formData.get("eventSlug") ?? "");
  const gate = await guestOf(slug);
  if ("error" in gate && gate.error) return gate;
  const closed = teamsClosed(gate.event);
  if (closed) return closed;
  const result = await leaveTeam({
    eventId: gate.event.id,
    attendeeId: gate.attendee.id,
  });
  refresh(gate.event.slug);
  return result;
}

export async function toggleTeam(
  _prev: NightResult | undefined,
  formData: FormData,
): Promise<NightResult> {
  const slug = String(formData.get("eventSlug") ?? "");
  const gate = await guestOf(slug);
  if ("error" in gate && gate.error) return gate;
  const closed = teamsClosed(gate.event);
  if (closed) return closed;
  const result = await setTeamOpen({
    eventId: gate.event.id,
    attendeeId: gate.attendee.id,
    open: formData.get("open") === "yes",
  });
  refresh(gate.event.slug);
  return result;
}

export async function kickTeammate(
  _prev: NightResult | undefined,
  formData: FormData,
): Promise<NightResult> {
  const slug = String(formData.get("eventSlug") ?? "");
  const gate = await guestOf(slug);
  if ("error" in gate && gate.error) return gate;
  const closed = teamsClosed(gate.event);
  if (closed) return closed;
  const result = await removeTeammate({
    eventId: gate.event.id,
    attendeeId: gate.attendee.id,
    memberId: String(formData.get("memberId") ?? ""),
  });
  refresh(gate.event.slug);
  return result;
}
