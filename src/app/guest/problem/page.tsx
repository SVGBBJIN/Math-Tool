"use client";
import { useGuest } from "@/lib/guest/GuestProvider";
import { useGuestLearn } from "@/components/learn/GuestLearnProvider";
import { ProblemPage } from "@/components/learn/ProblemPage";
import { LearnNotice } from "../LearnNotice";

export default function GuestProblem() {
  const { today } = useGuest();
  const learn = useGuestLearn();
  if (!learn || !today) return <p className="learn-card text-muted">Loading…</p>;
  return (
    <>
      <LearnNotice />
      <ProblemPage store={learn.store} today={today} base="/guest" />
    </>
  );
}
