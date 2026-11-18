import Link from "next/link";
import { householdStudent, requireContext } from "@/lib/session";
import { loadLearnState } from "@/lib/data";
import { LearnClient } from "@/components/learn/LearnClient";

export default async function TodayPage() {
  const ctx = await requireContext();
  const student = await householdStudent(ctx);
  if (!student) {
    return (
      <div className="card">
        <h1 className="h2">Welcome!</h1>
        <p className="mt-1 text-muted">Create your student&apos;s login to get started.</p>
        <Link href="/settings" className="btn mt-4">Go to settings</Link>
      </div>
    );
  }
  const { state, notice } = await loadLearnState(ctx.supabase, student.id);
  return <LearnClient initial={state} notice={notice} today={ctx.today} mode="today" readOnly={ctx.profile.role !== "student"} />;
}
