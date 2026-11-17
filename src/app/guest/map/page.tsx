"use client";
import { useGuest } from "@/lib/guest/GuestProvider";
import { useGuestLearn } from "@/components/learn/GuestLearnProvider";
import { MapView } from "@/components/learn/MapView";
import { LearnNotice } from "../LearnNotice";

export default function GuestMap() {
  const { today } = useGuest();
  const learn = useGuestLearn();
  if (!learn || !today) return <p className="learn-card text-muted">Loading…</p>;
  return (
    <>
      <LearnNotice />
      <MapView store={learn.store} today={today} />
    </>
  );
}
