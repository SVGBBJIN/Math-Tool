"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { signIn, signUpParent, type FormState } from "../actions/account";
import { FormMessage } from "@/components/FormMessage";

export function LoginForms() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [inState, inAction, inPending] = useActionState<FormState, FormData>(signIn, {});
  const [upState, upAction, upPending] = useActionState<FormState, FormData>(signUpParent, {});
  const signup = mode === "signup";
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
            {m === "signin" ? "Sign in" : "Parent sign-up"}
          </button>
        ))}
      </div>
      <form action={signup ? upAction : inAction} className="space-y-3">
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
            minLength={8}
            autoComplete={signup ? "new-password" : "current-password"}
            required
            className="input"
          />
        </div>
        {signup && (
          <label className="flex items-start gap-2 text-sm text-muted">
            <input type="checkbox" name="adult" className="mt-1" required />
            I am the parent or guardian. I&apos;ll create my student&apos;s login and own the phone numbers on this account.
          </label>
        )}
        <button className="btn w-full" disabled={signup ? upPending : inPending}>
          {signup ? "Create parent account" : "Sign in"}
        </button>
        <FormMessage state={signup ? upState : inState} />
      </form>
      {!signup && <p className="mt-3 text-xs text-muted">Students: use the login your parent created for you.</p>}
      <div className="my-4 flex items-center gap-3 text-xs text-muted" aria-hidden>
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>
      <Link href="/guest" className="btn-ghost w-full">Continue as guest</Link>
      <p className="mt-2 text-xs text-muted">No account needed. Your progress is saved in this browser only.</p>
    </div>
  );
}
