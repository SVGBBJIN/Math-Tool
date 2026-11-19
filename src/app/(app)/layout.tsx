import { requireContext } from "@/lib/session";
import { BottomNav } from "@/components/BottomNav";
import { CalculatorPopup } from "@/components/calculator/CalculatorPopup";
import { signOut } from "../actions/account";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, household } = await requireContext();
  return (
    <div className="shell">
      <header className="shell-header">
        <div>
          <p className="brand-text text-xl font-black tracking-tight">AMC Coach</p>
          <p className="text-xs text-muted">
            {profile.display_name} · {profile.role} · {household.timezone}
          </p>
        </div>
        <form action={signOut}>
          <button className="text-sm font-semibold text-muted hover:text-ink">Sign out</button>
        </form>
      </header>
      <main>{children}</main>
      <CalculatorPopup />
      <BottomNav />
    </div>
  );
}
