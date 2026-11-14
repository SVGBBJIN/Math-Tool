"use client";
import { useEffect } from "react";
import Link from "next/link";
import { BottomNav } from "@/components/BottomNav";
import { GUEST_COOKIE, useGuest } from "@/lib/guest/GuestProvider";

export function GuestShell({ children }: { children: React.ReactNode }) {
  const { state, persisted } = useGuest();

  // Remember the choice so a returning guest isn't sent to the sign-in screen (see middleware).
  useEffect(() => {
    document.cookie = `${GUEST_COOKIE}=1; path=/; max-age=31536000; samesite=lax`;
  }, []);

  return (
    <div className="mx-auto min-h-dvh max-w-md px-4 pb-24">
      <header className="flex items-center justify-between py-4">
        <div>
          <p className="text-lg font-extrabold tracking-tight text-brand">AMC Coach</p>
          <p className="text-xs text-muted">Guest · saved in this browser{state ? ` · ${state.settings.timezone}` : ""}</p>
        </div>
        <Link href="/login" className="text-sm font-semibold text-muted hover:text-ink">Sign in</Link>
      </header>
      {!persisted && (
        <p className="card mb-4 border-danger/40 text-sm text-danger" role="alert">
          This browser is blocking local storage, so your progress will be lost when you close the tab.
        </p>
      )}
      <main>{children}</main>
      <BottomNav base="/guest" />
    </div>
  );
}
