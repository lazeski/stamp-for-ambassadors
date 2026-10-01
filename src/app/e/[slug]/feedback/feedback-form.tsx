"use client";

import { useActionState } from "react";
import { saveFeedback, type FeedbackActionResult } from "@/app/e/[slug]/feedback/actions";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/input";

const SCORES = [1, 2, 3, 4, 5] as const;

export function FeedbackForm({
  eventSlug,
  score,
  comment,
  lockedReason,
}: {
  eventSlug: string;
  score: number | null;
  comment: string | null;
  /** Set when this signed-in person is not someone the form is for. */
  lockedReason?: string;
}) {
  const [state, formAction, pending] = useActionState<FeedbackActionResult, FormData>(
    saveFeedback,
    undefined,
  );

  return (
    <form action={formAction} className="mt-10 flex max-w-md flex-col gap-8">
      <input type="hidden" name="eventSlug" value={eventSlug} />
      <fieldset disabled={Boolean(lockedReason)}>
        <legend className="text-[10px] uppercase tracking-[0.14em] text-mute select-none">
          Score
        </legend>
        <p className="mt-2 text-xs leading-5 text-mute">1 is rough. 5 is the one.</p>
        <div className="mt-3 flex gap-2">
          {SCORES.map((value) => (
            <label key={value} className="cursor-pointer">
              <input
                type="radio"
                name="score"
                value={value}
                required
                defaultChecked={score === value}
                className="peer sr-only"
              />
              <span className="flex size-11 items-center justify-center border border-line font-mono text-sm peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:border-ink">
                {value}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Note" hint="Optional. Whatever you want the organizers to know.">
        <Textarea
          name="comment"
          rows={5}
          maxLength={2000}
          defaultValue={comment ?? ""}
          placeholder="The room, the credits, the open mic."
        />
      </Field>
      {lockedReason ? (
        <p className="text-sm text-mute">{lockedReason}</p>
      ) : (
        <>
          {state?.error ? (
            <p role="alert" className="text-sm text-severity-high">
              {state.error}
            </p>
          ) : null}
          {state?.ok ? <p className="text-sm text-mute">{state.ok}</p> : null}
          <Button type="submit" variant="primary" className="self-start" disabled={pending}>
            {pending ? "Saving…" : score === null ? "Send" : "Update"}
          </Button>
        </>
      )}
    </form>
  );
}
