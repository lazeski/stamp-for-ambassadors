"use client";

import { useActionState } from "react";
import { sendFeedbackForm, type ActionResult } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

export function FeedbackSendForm({
  eventSlug,
  count,
}: {
  eventSlug: string;
  count: number;
}) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(
    sendFeedbackForm,
    undefined,
  );

  return (
    <form action={formAction} className="mt-6 flex flex-col items-start gap-3">
      <input type="hidden" name="eventSlug" value={eventSlug} />
      {state?.error ? (
        <p role="alert" className="text-sm text-severity-high">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? <p className="text-sm text-mute">{state.ok}</p> : null}
      {count > 0 ? (
        <Button type="submit" variant="primary" disabled={pending}>
          {pending
            ? "Sending…"
            : count === 1
              ? "Email 1 person"
              : `Email ${count} people`}
        </Button>
      ) : state?.ok ? null : (
        <p className="text-sm text-mute">
          Everyone already has the link.
        </p>
      )}
    </form>
  );
}
