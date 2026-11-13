# AMC Coach

A single-family accountability and training app for a 9th grader preparing for the AMC 10, plus daily Khan Academy
precalculus. Next.js (App Router, TypeScript) · Supabase (Postgres, auth, storage) · Vercel · Sendblue · Anthropic API.

## Status

| Milestone | Scope | State |
|---|---|---|
| **M1** | Schema, auth, problem bank, trainer, error log | ✅ built, tested |
| M2 | Sendblue sending, scheduler, inbound webhook, escalation tests | next |
| M3 | Khan Academy proof entry | UI built (`/khan`); requirement date ranges still to do |
| M4 | Endurance mode + vault | |
| M5 | Problem generator with verification | |
| M6 | Timeline and progress maps | |
| M7 | Chrome extension | |

## Run locally

Requires Node 22+ and Docker.

```bash
npm install
```

```bash
npx supabase start          # local Postgres + auth + storage
```

```bash
npx supabase db reset       # applies supabase/migrations
```

Copy `.env.example` to `.env.local` and fill it from the output of `npx supabase status`. Then:

```bash
npm run seed:demo           # LOCAL ONLY: a demo account + 20 original practice problems
```

```bash
npm run dev
```

Demo login (local only): `demo@demo.local`, password `demo-password-123`. Or just click **Create account** on the login page.

### Tests

```bash
npm test          # unit tests: plan/streak, spaced review, trainer selection
```

```bash
npm run test:db   # row-level-security checks against the local Supabase (needs seed:demo)
```

## Connecting a Supabase project

1. Create a project at supabase.com (or reuse one) and copy **Project URL**, the **publishable** key and the
   **secret** key from Project Settings → API into `.env.local` (see `.env.example`).
2. Apply the migrations: `npx supabase link --project-ref <ref>` then `npx supabase db push`.
3. Auth → URL Configuration: set **Site URL** to your deployed URL and add `<your URL>/auth/callback` (and
   `http://127.0.0.1:3000/auth/callback` for local) to **Redirect URLs**.
4. Auth → Providers → Email: choose whether **Confirm email** is required. Both work: with it on, the form
   says "Check your email" and the link lands on `/auth/callback`; with it off, sign-up signs the user straight in.
5. Optional: set `NEXT_PUBLIC_SITE_URL` if the confirmation link must use a fixed origin.

Accounts that existed before the self-service migration are repaired on their next request (`ensure_account`).
The old `role` column is kept but no longer used; old `parent` rows keep working as ordinary accounts.

## How M1 works

- **Accounts.** Anyone can create an account with a name, email and password (`signUp` in
  `src/app/actions/account.ts`). Supabase creates the auth user; the `handle_new_user` trigger
  (`supabase/migrations/20261113000000_self_service_accounts.sql`) creates the profile and the settings row
  (table `households`, one per account: it is the key every other table is scoped by) from the sign-up
  metadata. There are no roles: every account owns its own data. Row-level security covers every table
  (`tests/db/rls.test.ts`).
- **Daily plan.** Mon/Tue/Thu/Fri trainer · Wed error-log review · Sat timed block · Sun review of Saturday
  (`src/lib/plan.ts`). The streak survives if every required item is done **or** at least 10 minutes of plan work are
  logged. An unfinished *today* never breaks the streak. Khan becomes a requirement in M3, and the timed block and
  Sunday review arrive with M4. Until those milestones, Saturday and Sunday can only be kept by the 10-minute minimum.
- **Problem bank.** Sources: `aops_wiki` (a link plus metadata; the database rejects stored problem text),
  `pasted`, and `generated` (M5; the database rejects generated problems in the vault). Statuses: train, vault
  (sealed: tags and answer hidden in the UI), burned. Add problems one at a time or by CSV:
  `contest,year,number,answer,topic,techniques[,status]` with tags separated by `;`, from the controlled vocabulary
  in `src/lib/tags.ts`.
- **Trainer** (`src/lib/trainer.ts`). Three problems a day, chosen from problems never attempted:
  1. Due review twins first: at most 2, oldest due date first, never the problem that was missed.
  2. Then the weakest technique tags. Accuracy is smoothed (Laplace) and counts unfamiliar attempts only.
  3. Then one stretch problem at the student's comfort level + 4 or higher.

  The flow is a timer, then A–E or blank, confidence 1–3, and "seen before?". After submitting, the student sees the
  result and must write a one-sentence key idea; a miss also needs an error type. Technique tags stay hidden until
  after the attempt, so they don't hint at the method.
- **Spaced review** (`src/lib/review.ts`). A miss queues the problem's primary technique tag. A twin (a different
  problem with the same tag) is due in 1 day. Each correct, unfamiliar solve moves it to 3, then 7, then 21 days, and
  a correct solve at 21 days retires it. Any miss resets it to 1 day. Attempts marked "seen before" don't move it.
- **Error log.** All misses, with counts by error type and the share of careless + misread misses. Wednesday review:
  write a "next time I will…" takeaway for 5 misses (or all remaining) to complete the day.

## Decisions & caveats

- **Scheduler (M2).** Vercel Hobby cron runs at most once a day, with up to ±59 minutes of drift (per Vercel docs),
  which is too coarse for the 5 pm / 7 pm / every-45-minutes reminder ladder. Plan: Supabase `pg_cron` + `pg_net`
  calls `/api/cron/tick` every 5 minutes at no cost, or Vercel Pro cron with the same endpoint.
- **AoPS.** The AoPS wiki refuses automated fetches, so the app ships no AoPS seed data. Add problems through the
  form or CSV. The demo seed is 20 original problems, each answer checked by `scripts/demo/verify.py`
  (SymPy / brute force).
- **The vault is sealed in the UI only.** RLS still lets the student's account read vault answers. That's acceptable
  for a self-training tool; tighten it in M4 if needed.
- **Answers before submission.** The trainer page never sends a problem's answer to the browser before an attempt.
