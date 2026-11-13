import { requireContext } from "@/lib/session";
import { ScrollClient } from "./ScrollClient";

export default async function ScrollPage() {
  const ctx = await requireContext();
  if (ctx.profile.role !== "student") {
    return <div className="card text-muted">The math scroll is for the student&apos;s login.</div>;
  }
  return <ScrollClient />;
}
