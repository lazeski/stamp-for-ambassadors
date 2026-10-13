"use client";

import { useActionState } from "react";
import {
  createTeam,
  joinOpenTeam,
  kickTeammate,
  leaveMyTeam,
  lookForTeam,
  toggleTeam,
} from "@/app/e/[slug]/night-actions";
import type { NightResult } from "@/lib/night";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

function Note({ state }: { state: NightResult | undefined }) {
  if (state?.error) {
    return (
      <p role="alert" className="text-sm text-severity-high">
        {state.error}
      </p>
    );
  }
  if (state?.ok) return <p className="text-sm text-mute">{state.ok}</p>;
  return null;
}

export function LookForm({
  eventSlug,
  looking,
}: {
  eventSlug: string;
  looking: boolean;
}) {
  const [state, formAction, pending] = useActionState<NightResult | undefined, FormData>(
    lookForTeam,
    undefined,
  );
  return (
    <form action={formAction} className="mt-6 flex flex-col items-start gap-3">
      <input type="hidden" name="eventSlug" value={eventSlug} />
      <input type="hidden" name="looking" value={looking ? "no" : "yes"} />
      <Note state={state} />
      <Button type="submit" variant={looking ? "outline" : "primary"} disabled={pending}>
        {pending ? "Saving…" : looking ? "Stop looking" : "I need a team"}
      </Button>
    </form>
  );
}

export function StartTeamForm({ eventSlug }: { eventSlug: string }) {
  const [state, formAction, pending] = useActionState<NightResult | undefined, FormData>(
    createTeam,
    undefined,
  );
  return (
    <form action={formAction} className="mt-8 flex max-w-md flex-col gap-4">
      <input type="hidden" name="eventSlug" value={eventSlug} />
      <Field label="Team name">
        <Input name="name" required maxLength={80} autoComplete="off" />
      </Field>
      <Note state={state} />
      <Button type="submit" variant="primary" className="self-start" disabled={pending}>
        {pending ? "Starting…" : "Start a team"}
      </Button>
    </form>
  );
}

export function JoinForm({
  eventSlug,
  teamId,
}: {
  eventSlug: string;
  teamId: string;
}) {
  const [state, formAction, pending] = useActionState<NightResult | undefined, FormData>(
    joinOpenTeam,
    undefined,
  );
  return (
    <form action={formAction} className="mt-3 flex flex-col items-start gap-2">
      <input type="hidden" name="eventSlug" value={eventSlug} />
      <input type="hidden" name="teamId" value={teamId} />
      <Note state={state} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Joining…" : "Join"}
      </Button>
    </form>
  );
}

export function LeaveForm({ eventSlug }: { eventSlug: string }) {
  const [state, formAction, pending] = useActionState<NightResult | undefined, FormData>(
    leaveMyTeam,
    undefined,
  );
  return (
    <form action={formAction} className="mt-4 flex flex-col items-start gap-2">
      <input type="hidden" name="eventSlug" value={eventSlug} />
      <Note state={state} />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Leaving…" : "Leave team"}
      </Button>
    </form>
  );
}

export function OpenForm({
  eventSlug,
  open,
}: {
  eventSlug: string;
  open: boolean;
}) {
  const [state, formAction, pending] = useActionState<NightResult | undefined, FormData>(
    toggleTeam,
    undefined,
  );
  return (
    <form action={formAction} className="mt-4 flex flex-col items-start gap-2">
      <input type="hidden" name="eventSlug" value={eventSlug} />
      <input type="hidden" name="open" value={open ? "no" : "yes"} />
      <Note state={state} />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Saving…" : open ? "Close the team" : "Open the team"}
      </Button>
    </form>
  );
}

export function RemoveForm({
  eventSlug,
  memberId,
}: {
  eventSlug: string;
  memberId: string;
}) {
  const [state, formAction, pending] = useActionState<NightResult | undefined, FormData>(
    kickTeammate,
    undefined,
  );
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="eventSlug" value={eventSlug} />
      <input type="hidden" name="memberId" value={memberId} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-mute hover:text-ink disabled:opacity-50"
      >
        {pending ? "…" : "Remove"}
      </button>
      {state?.error ? (
        <span role="alert" className="ml-2 text-xs text-severity-high">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
