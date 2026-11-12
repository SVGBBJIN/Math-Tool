import { LoginForms } from "./LoginForms";

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <p className="text-3xl font-extrabold tracking-tight text-brand">AMC Coach</p>
      <p className="mb-6 text-muted">Daily AMC 10 training and accountability.</p>
      <LoginForms />
    </div>
  );
}
