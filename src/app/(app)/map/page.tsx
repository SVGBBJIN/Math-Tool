import { householdStudent, requireContext } from "@/lib/session";
import { loadLearnState } from "@/lib/data";
import { LearnClient } from "@/components/learn/LearnClient";

export default async function MapPage() {
  const ctx = await requireContext();
  const student = await householdStudent(ctx);
  if (!student) return <div className="card text-muted">No student yet.</div>;
  const { state, notice } = await loadLearnState(ctx.supabase, student.id);
  return <LearnClient initial={state} notice={notice} today={ctx.today} mode="map" readOnly={ctx.profile.role !== "student"} />;
}
