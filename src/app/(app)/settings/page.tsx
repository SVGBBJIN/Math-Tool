import { householdStudent, requireContext } from "@/lib/session";
import { HouseholdForm, StudentForm } from "./SettingsForms";

export default async function SettingsPage() {
  const ctx = await requireContext();
  const student = await householdStudent(ctx);
  const isParent = ctx.profile.role === "parent";
  return (
    <div className="space-y-4">
      <h1 className="h1">Settings</h1>
      {!isParent && (
        <p className="card text-sm text-muted">Settings are managed by your parent&apos;s account.</p>
      )}
      <section className="card">
        <h2 className="h2">Dates &amp; time zone</h2>
        <HouseholdForm
          disabled={!isParent}
          timezone={ctx.household.timezone}
          amcDate={ctx.household.amc_date ?? ""}
          finalsStart={ctx.household.finals_start ?? ""}
          finalsEnd={ctx.household.finals_end ?? ""}
        />
      </section>
      <section className="card">
        <h2 className="h2">Student</h2>
        {student ? (
          <p className="mt-1 text-sm">
            <span className="font-semibold">{student.display_name}</span> has a login. Share it with them and have them sign in on their phone.
          </p>
        ) : isParent ? (
          <StudentForm />
        ) : null}
      </section>
      <section className="card">
        <h2 className="h2">Text reminders</h2>
        <p className="mt-1 text-sm text-muted">Phone numbers, the reminder ladder, quiet hours and the daily cap arrive in M2.</p>
      </section>
    </div>
  );
}
