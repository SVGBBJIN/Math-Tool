# AMC Coach

A single-family accountability and training app for a 9th grader preparing for the AMC 10, plus daily Khan Academy
precalculus. Next.js (App Router, TypeScript) · Supabase (Postgres, auth, storage) · Vercel · Sendblue · Anthropic API.

## Status

| Milestone | Scope | State |
|---|---|---|
| **M1** | Schema, auth, problem bank, trainer, error log | ✅ built, tested |
| M2 | Sendblue sending, scheduler, inbound webhook, escalation tests | next |
| M3 | Khan Academy proof entry | |
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
npm run seed:demo           # LOCAL ONLY: demo parent/student logins + 20 original practice problems
```

```bash
npm run dev
```

Demo logins (local only): `parent@demo.local` / `student@demo.local`, password `demo-password-123`.

### Tests

```bash
npm test          # unit tests: plan/streak, spaced review, trainer selection
```

```bash
npm run test:db   # row-level-security checks against the local Supabase (needs seed:demo)
```

## Guest mode

The sign-in screen has a **Continue as guest** button (`/guest`). Guests need no account and nothing touches Supabase:
all progress lives in the browser's `localStorage` (`src/lib/guest`), and the middleware skips the auth check for `/guest`
(it also sends a returning guest, remembered by the `amc_guest` cookie, back to `/guest` instead of the sign-in screen).

- One person with full permissions: they train, log attempts, manage the problem bank (including sealing problems
  in the vault) and edit dates. There is no parent/student split.
- Starts with the 20 original sample problems. Same daily plan, trainer, spaced-review and streak rules as the signed-in app
  (shared pure modules in `src/lib`; the guest engine is `src/lib/guest/engine.ts`, tested in `tests/guest.test.ts`).
- Data is per browser: clearing site data or switching devices starts over. Settings has **Download / Restore backup**.
- Guests can't get text reminders (they need an account).

## How M1 works

- **Accounts.** A parent signs up and confirms they are the parent or guardian. They create the household, then
  create the student's login. The student never signs up on their own. Only the parent can change settings; only
  the student can log attempts. Row-level security covers every table (`tests/db/rls.test.ts`).
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
