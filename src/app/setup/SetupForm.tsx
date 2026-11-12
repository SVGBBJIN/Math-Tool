"use client";
import { useActionState, useEffect, useState } from "react";
import { createHousehold, type FormState } from "../actions/account";
import { FormMessage } from "@/components/FormMessage";

export function SetupForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createHousehold, {});
  const [tz, setTz] = useState("America/Los_Angeles");
  useEffect(() => {
    try {
      setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles");
    } catch {}
  }, []);
  return (
    <form action={action} className="card space-y-3">
      <div>
        <label className="label" htmlFor="name">Household name</label>
        <input id="name" name="name" required className="input" placeholder="The Lee family" />
      </div>
      <div>
        <label className="label" htmlFor="displayName">Your name</label>
        <input id="displayName" name="displayName" required className="input" placeholder="Parent" />
      </div>
      <div>
        <label className="label" htmlFor="timezone">Time zone</label>
        <input id="timezone" name="timezone" required className="input" value={tz} onChange={(e) => setTz(e.target.value)} />
        <p className="mt-1 text-xs text-muted">Detected from this device. Days, streaks and reminders use this zone.</p>
      </div>
      <button className="btn w-full" disabled={pending}>Create household</button>
      <FormMessage state={state} />
    </form>
  );
}
