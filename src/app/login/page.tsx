import { LoginForms } from "./LoginForms";

const NOTICES: Record<string, string> = {
  confirm: "That confirmation link is invalid or has expired. Sign in, or create the account again.",
  account: "We couldn't load your account. Sign in again, and contact support if it keeps happening.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <p className="text-3xl font-extrabold tracking-tight text-brand">AMC Coach</p>
      <p className="mb-6 text-muted">Daily AMC 10 training and accountability.</p>
      {error && NOTICES[error] && (
        <p className="card mb-4 text-sm font-medium text-danger" role="alert">{NOTICES[error]}</p>
      )}
      <LoginForms />
    </div>
  );
}
