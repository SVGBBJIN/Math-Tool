export function FormMessage({ state }: { state: { error?: string; message?: string } }) {
  return (
    <>
      {state.message && <p className="mt-2 text-sm font-medium text-mastery" role="status">{state.message}</p>}
      {state.error && <p className="mt-2 whitespace-pre-line text-sm font-medium text-danger" role="alert">{state.error}</p>}
    </>
  );
}
