import { requireContext } from "@/lib/session";
import { SettingsForm, TextRemindersForm } from "./SettingsForms";

export default async function SettingsPage() {
  const ctx = await requireContext();
  return (
    <div className="space-y-4">
      <h1 className="h1">Settings</h1>
      <section className="card">
        <h2 className="h2">Account</h2>
        <p className="mt-1 text-sm">
          <span className="font-semibold">{ctx.profile.display_name}</span>
          <span className="text-muted"> · {ctx.user.email}</span>
        </p>
      </section>
      <section className="card">
        <h2 className="h2">Dates &amp; time zone</h2>
        <SettingsForm
          timezone={ctx.household.timezone}
          amcDate={ctx.household.amc_date ?? ""}
          finalsStart={ctx.household.finals_start ?? ""}
          finalsEnd={ctx.household.finals_end ?? ""}
        />
      </section>
      <section className="card">
        <h2 className="h2">Text reminders</h2>
        <p className="mt-1 text-sm text-muted">
          Off by default. This is the only switch for reminders: the trainer, math scroll and error review work the same either way.
          Sending, phone numbers, the reminder ladder, quiet hours and the daily cap arrive in M2.
        </p>
        <TextRemindersForm enabled={ctx.household.texts_enabled} />
      </section>
    </div>
  );
}
