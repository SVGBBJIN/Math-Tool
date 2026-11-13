"use client";
import { useActionState, useEffect, useState } from "react";
import { signIn, signUp, type FormState } from "../actions/account";
import { FormMessage } from "@/components/FormMessage";

export function LoginForms() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [timezone, setTimezone] = useState("");
  const [inState, inAction, inPending] = useActionState<FormState, FormData>(signIn, {});
  const [upState, upAction, upPending] = useActionState<FormState, FormData>(signUp, {});
  const signup = mode === "signup";

  useEffect(() => {
    try {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "");
    } catch {}
  }, []);

  return (
    <div className="card">
      <div className="mb-4 grid grid-cols-2 rounded-xl bg-canvas p-1 text-sm font-semibold">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-lg py-2 ${mode === m ? "bg-white shadow-sm" : "text-muted"}`}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>
      <form key={mode} action={signup ? upAction : inAction} className="space-y-3">
        {signup && (
          <div>
            <label className="label" htmlFor="displayName">Your name</label>
            <input id="displayName" name="displayName" autoComplete="name" maxLength={60} required className="input" />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            minLength={signup ? 8 : undefined}
            autoComplete={signup ? "new-password" : "current-password"}
            required
            className="input"
          />
          {signup && <p className="mt-1 text-xs text-muted">At least 8 characters.</p>}
        </div>
        {signup && <input type="hidden" name="timezone" value={timezone} />}
        <button className="btn w-full" disabled={signup ? upPending : inPending}>
          {signup ? "Create account" : "Sign in"}
        </button>
        <FormMessage state={signup ? upState : inState} />
      </form>
    </div>
  );
}
