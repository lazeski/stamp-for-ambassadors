"use client";

import { useActionState } from "react";
import { saveProjectSignup } from "@/app/e/[slug]/night-actions";
import type { NightResult } from "@/lib/night";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function SignupForm({
  eventSlug,
  project,
  whoDefault,
}: {
  eventSlug: string;
  whoDefault: string;
  project: {
    name: string;
    who: string;
    productUrl: string;
    githubUrl: string;
  } | null;
}) {
  const [state, formAction, pending] = useActionState<NightResult | undefined, FormData>(
    saveProjectSignup,
    undefined,
  );

  return (
    <form action={formAction} className="mt-10 flex max-w-md flex-col gap-5">
      <input type="hidden" name="eventSlug" value={eventSlug} />
      <Field label="Project">
        <Input name="name" required maxLength={120} defaultValue={project?.name ?? ""} autoComplete="off" />
      </Field>
      <Field label="Who" hint="A team name, or your name if you are building alone.">
        <Input
          name="who"
          required
          maxLength={200}
          defaultValue={project?.who || whoDefault}
          autoComplete="off"
        />
      </Field>
      <Field label="Product" hint="Optional. The link people should open.">
        <Input
          name="productUrl"
          type="url"
          inputMode="url"
          placeholder="https://"
          defaultValue={project?.productUrl ?? ""}
          autoComplete="off"
        />
      </Field>
      <Field label="GitHub" hint="Optional.">
        <Input
          name="githubUrl"
          type="url"
          inputMode="url"
          placeholder="https://github.com/"
          defaultValue={project?.githubUrl ?? ""}
          autoComplete="off"
        />
      </Field>
      {state?.error ? (
        <p role="alert" className="text-sm text-severity-high">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? <p className="text-sm text-mute">{state.ok}</p> : null}
      <Button type="submit" variant="primary" className="self-start" disabled={pending}>
        {pending ? "Saving…" : project ? "Update" : "Sign up"}
      </Button>
    </form>
  );
}
