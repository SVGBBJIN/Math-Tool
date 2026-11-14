import type { Metadata } from "next";
import { GuestProvider } from "@/lib/guest/GuestProvider";
import { GuestShell } from "./GuestShell";

export const metadata: Metadata = { title: "AMC Coach · Guest" };

/** Guest mode: no account. Everything is kept in this browser (see src/lib/guest). */
export default function GuestLayout({ children }: { children: React.ReactNode }) {
  return (
    <GuestProvider>
      <GuestShell>{children}</GuestShell>
    </GuestProvider>
  );
}
