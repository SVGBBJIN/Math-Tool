import { householdStudent, requireContext } from "@/lib/session";
import { loadEngineProgress } from "@/lib/data";
import { CONTEST_DATE } from "@/lib/engine/config";
import { MovesClient } from "./MovesClient";

export default async function MovesPage() {
  const ctx = await requireContext();
  const student = await householdStudent(ctx);
  if (!student) return <div className="card text-muted">No student yet.</div>;
  const progress = await loadEngineProgress(ctx.supabase, student.id);
  // The date set in Settings wins; CONTEST_DATE is only the fallback placeholder.
  const contestDate = ctx.household.amc_date ?? CONTEST_DATE;
  return <MovesClient initial={progress} today={ctx.today} contestDate={contestDate} readOnly={ctx.profile.role !== "student"} />;
}
