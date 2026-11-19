"use client";
import { useGuest } from "@/lib/guest/GuestProvider";
import { useGuestLearn } from "@/components/learn/GuestLearnProvider";
import { ProgressView } from "@/components/learn/ProgressView";
import { LearnNotice } from "../LearnNotice";

export default function GuestProgress() {
  const { today } = useGuest();
  const learn = useGuestLearn();
  if (!learn || !today) return <p className="learn-card text-muted">Loading…</p>;
  return (
    <>
      <LearnNotice />
      <ProgressView store={learn.store} today={today} base="/guest" />
    </>
  );
}
