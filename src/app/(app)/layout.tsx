import { requireContext } from "@/lib/session";
import { BottomNav } from "@/components/BottomNav";
import { signOut } from "../actions/account";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, household } = await requireContext();
  return (
    <div className="mx-auto min-h-dvh max-w-md px-4 pb-24">
      <header className="flex items-center justify-between py-4">
        <div>
          <p className="text-lg font-extrabold tracking-tight text-brand">AMC Coach</p>
          <p className="text-xs text-muted">
            {profile.display_name} · {household.timezone}
          </p>
        </div>
        <form action={signOut}>
          <button className="text-sm font-semibold text-muted hover:text-ink">Sign out</button>
        </form>
      </header>
      <main>{children}</main>
      <BottomNav />
    </div>
  );
}
