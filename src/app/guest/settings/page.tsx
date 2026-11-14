"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useGuest } from "@/lib/guest/GuestProvider";
import { updateSettings } from "@/lib/guest/engine";
import type { FormState } from "../../actions/account";
import { HouseholdForm } from "../../(app)/settings/SettingsForms";

export default function GuestSettings() {
  const { state, update, reset, restore } = useGuest();
  const [msg, setMsg] = useState<FormState>({});
  const fileRef = useRef<HTMLInputElement>(null);
  if (!state) return <p className="card text-muted">Loading…</p>;

  const save = async (_: FormState, form: FormData): Promise<FormState> => {
    const r = update((d) =>
      updateSettings(d, {
        timezone: String(form.get("timezone") ?? ""),
        amcDate: String(form.get("amcDate") ?? ""),
        finalsStart: String(form.get("finalsStart") ?? ""),
        finalsEnd: String(form.get("finalsEnd") ?? ""),
      }),
    );
    return r.error ? { error: r.error } : { message: "Saved." };
  };

  const exportBackup = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `amc-coach-guest-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = async (file: File | undefined) => {
    if (!file) return;
    const r = restore(await file.text());
    setMsg(r.error ? { error: r.error } : { message: "Backup restored." });
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      <h1 className="h1">Settings</h1>
      <section className="card">
        <h2 className="h2">Dates &amp; time zone</h2>
        <HouseholdForm
          disabled={false}
          action={save}
          timezone={state.settings.timezone}
          amcDate={state.settings.amcDate}
          finalsStart={state.settings.finalsStart}
          finalsEnd={state.settings.finalsEnd}
        />
      </section>

      <section className="card space-y-3">
        <h2 className="h2">Your data</h2>
        <p className="text-sm text-muted">
          Guest progress is stored only in this browser. Clearing site data or switching browsers or devices starts you from scratch, so
          download a backup now and then. <Link href="/login" className="font-semibold text-brand">Sign in</Link> instead if you want
          your progress to follow you.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-ghost" onClick={exportBackup}>Download backup</button>
          <button className="btn-ghost" onClick={() => fileRef.current?.click()}>Restore backup</button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => importBackup(e.target.files?.[0])} />
        <button
          className="w-full text-sm font-semibold text-danger"
          onClick={() => {
            if (confirm("Erase all guest progress and problems in this browser and start over with the sample problems?")) {
              reset();
              setMsg({ message: "Reset." });
            }
          }}
        >
          Erase everything and start over
        </button>
        {msg.message && <p className="text-sm font-medium text-mastery" role="status">{msg.message}</p>}
        {msg.error && <p className="text-sm font-medium text-danger" role="alert">{msg.error}</p>}
      </section>

      <section className="card">
        <h2 className="h2">Text reminders</h2>
        <p className="mt-1 text-sm text-muted">Reminders need an account (they arrive in M2). Guests can still train and keep a streak.</p>
      </section>
    </div>
  );
}
