# AMC Coach

A single-family accountability and training app for a 9th grader preparing for the AMC 10, plus daily Khan Academy
precalculus. Next.js (App Router, TypeScript) · Supabase (Postgres, auth, storage) · Vercel · Sendblue · Anthropic API.

## Status

| Milestone | Scope | State |
|---|---|---|
| **M1** | Schema, auth, problem bank, trainer, error log | ✅ built, tested |
| **Moves** | Move-based practice engine (see below) | ✅ built, tested; Supabase path not yet run against a live database |
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
npm test          # unit tests: plan/streak, spaced review, trainer, practice engine
```

```bash
npm run test:db   # row-level-security checks against the local Supabase (needs seed:demo)
```

```bash
npm run verify:cards   # re-verifies every engine card; also runs before every build
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
  create the student's login. The student never signs up on their own. Parent and student have the same management powers (settings, vault, delete problems); only
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

## Move-based practice engine (Moves tab)

Instead of picking A–E, the student solves by choosing moves, and every move is checked by computation.
Code: `src/lib/engine` (pure logic), `src/components/engine` (UI), `tests/engine-*.test.ts`.

**One shell, two modules.** Both share a state, a set of moves, a verifier and a goal (`types.ts`).

- **Module A, expressions** (`expr/`). The state is an expression, a set of equations joined by "or", or a
  congruence. The student picks a named move and supplies its parameters (the factor, the two numbers); the
  engine builds the resulting line and `verify.ts` checks it against the previous line by numeric evaluation
  at pseudo-random points. Expressions must agree in value. Equations must keep the same solution set, and a
  rejected step names the root that was lost or added. Lines that become undefined where the old one was fine
  are reported as domain problems.
- **Module B, structures** (`struct/`). The state is a count built from slots, cases, a subtracted part and a
  divisor. The verifier enumerates what the structure really builds on a scaled-down version and compares it,
  outcome by outcome, with a brute-force list. A mismatch shows a concrete arrangement that was counted twice,
  missed or not allowed. Scaled-down means the same slots in the same roles with a smaller pool.

**Around the cards** (`progress.ts`, `config.ts`).

- A skill is one worked example, three easy reps and one twist. Mastery needs the twist. A skill opens when
  the easy reps of its prerequisites are done.
- Scaffolding dial: level 1 offers 4 moves, level 2 all moves, level 3 a blank page where the move is named
  first. Hints go nudge, move name, full step; any hint removes mastery credit for that card.
- The decision step has a visible timer (30 s for reps, 60 s for twists, per-card overrides). The reveal is
  untimed. "Not sure" is always available and still shows the insight.
- A miss or an assisted solve comes back as a fresh variant after 1, 3 and 7 days. Three misses in a row on a
  skill re-show the worked example and park the skill for two days.
- Daily set: one review from the queue, one new concept, one stretch from the weakest topic. Its minutes go
  into `day_activity` as `moves` and count toward the 10-minute minimum; it is not a required plan item.
- Quick reps (90 seconds) only draw from skills already worked in a lesson or daily set.
- Misses appear in the Errors tab and the Wednesday review with problem, answer reached, correct answer, time,
  error type and note. Every card is logged with topic, skill, level, time, wrong moves, hint level and result.
- `CONTEST_DATE` in `config.ts` is a placeholder fallback (`NEXT_PUBLIC_CONTEST_DATE`); the date in Settings
  wins. Pacing and the scaffolding/time ramp are computed from it.

**How verification works.** `npm run verify:cards` (`src/lib/engine/verify-cards.ts`) runs before every build
and fails it on any mismatch. For each of the 45 hand-written cards and 40 generated variants per generator it
replays the reference path through the live verifier, then checks the key a second way that shares no code
with it: exact polynomial identity, irreducibility of each factor and exact root tests for Module A; brute
force of the full-size problem for Module B. `tests/engine-progress.test.ts` feeds it deliberately wrong keys
to confirm they are caught.

**Add a card.** Add an entry to `CARDS` in a pack file (`packs/quadratics.ts`, `packs/counting.ts`) with its
start, goal, reference path and key move, then run `npm run verify:cards`.

**Add a topic pack.** Write `packs/<name>.ts` exporting a `TopicPack` (skills, cards, `generate`) and list it
in `registry.ts`. New Module A moves go in `expr/moves.ts`; new Module B problem shapes are templates
registered with `registerTemplate`. Modular-arithmetic moves (reduce, cycle, evaluate) already exist and are
tested, but no cards use them yet.

**Keeping content original.** No real contest problem, wording, name, year or number appears in the app; the
verifier rejects card text that names one. Real problems are only tagged privately. `data/topic-distribution.json`
holds aggregate topic shares and currently contains a placeholder estimate. Replace it with:

```bash
npm run topics:build -- path/to/your-tagged.csv
```

The CSV uses the problem bank's format (`contest,year,number,answer,topic,techniques`).

**Known limitations.**

- The Supabase path (migration `20261115000000_move_engine.sql`, save action, parent view) is typechecked but
  has not been run against a live database. Guest mode was tested in a browser.
- Moves are verified in the browser, so answers ship to the client and a determined student could edit saved
  progress.
- Progress is one JSON document per student; two devices open at once overwrite each other.
- Numeric verification is probabilistic in principle. Irrational roots get no named counterexample.
- A move acts on a whole side or one top-level factor or term, not on deeper sub-expressions.
- Hints after leaving the reference path only point back to its first step.
- Module B covers ordered rows, unordered groups with an optional leader, and one glued pair. Probability is
  not built.
- "Shortest path" is hand-authored and replayed, not proven minimal.
