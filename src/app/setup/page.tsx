import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SetupForm } from "./SetupForm";

export default async function SetupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (profile) redirect("/");
  return (
    <div className="mx-auto min-h-dvh max-w-md px-4 py-10">
      <h1 className="h1 mb-1">Set up your household</h1>
      <p className="mb-6 text-muted">You&apos;re the parent account. Next you&apos;ll create your student&apos;s login.</p>
      <SetupForm />
    </div>
  );
}
