"use client";
import { useGuest } from "@/lib/guest/GuestProvider";
import { useGuestLearn } from "@/components/learn/GuestLearnProvider";
import { TodayView } from "@/components/learn/TodayView";
import { LearnNotice } from "./LearnNotice";

export default function GuestToday() {
  const { today } = useGuest();
  const learn = useGuestLearn();
  if (!learn || !today) return <p className="learn-card text-muted">Loading…</p>;
  return (
    <>
      <LearnNotice />
      <TodayView store={learn.store} today={today} base="/guest" />
    </>
  );
}
