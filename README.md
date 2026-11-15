# AMC Coach

A single-family accountability and training app for a 9th grader preparing for the AMC 10, plus daily Khan Academy
precalculus. Next.js (App Router, TypeScript) · Supabase (Postgres, auth, storage) · Vercel · Sendblue · Anthropic API.

## Status

| Milestone | Scope | State |
|---|---|---|
| **M1** | Schema, auth, problem bank, trainer, error log | ✅ built, tested |
| **Moves** | Move-based practice engine: guided walkthroughs on a drag-and-drop workspace (see below) | ✅ built, tested; Supabase path not yet run against a live database |
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

Every problem is solved step by step on an on-screen **workspace** that plays the role of paper. The problem sits at
the top, and each step the student completes locks in below it, so the full solution builds up in view. There is no
multiple choice anywhere: not for answers, not for "pick the next move", not in worked examples. Every step is
checked by computation the moment it is made.

Code: `src/lib/engine` (pure logic), `src/components/engine` (UI), `tests/engine-*.test.ts`, `tests/no-multiple-choice.test.tsx`.

### How a step is made (touch-first)

One gesture rule covers everything: **drag X onto Y, or tap X and then tap Y** (`components/engine/dnd.tsx`). Only
pieces and tiles start drags (they carry `touch-action: none`); the rest of the page scrolls normally, and a press
that moves less than a few pixels is a tap. Nothing depends on hover. Mouse works the same way.

- **Module A (expressions).** Each term, factor and side is its own KaTeX-rendered piece. Drag a tile from the
  toolbox onto a part, a side, or the `=` sign (the whole equation). Direct manipulations: drag a term across `=`
  (the app flips its sign), drop a term on a like term to combine them, drop a term into a gap to regroup. A move
  with parameters opens a tray of slots, filled by dragging a piece of the expression into the slot or with the
  on-screen keypad (`Keypad.tsx`; the phone keyboard never opens). The ± on square roots is a toggle on the move.
- **Module B (counting).** The problem's pieces are described in words only ("any runner not used yet"), never with
  their counts. Drop a piece onto the canvas or the active part, then type how many options it has (`24`, `4!` and
  `2×4!` all work); the count is checked at once. Tokens join pieces: `× Multiply` (empty slot), `+ Case`,
  `− Overcount`, `− Complement`, `÷ Symmetry` (type the divisor). The final number comes from the structure.
  **Check** brute-forces a scaled-down version and, on a mismatch, shows a concrete arrangement counted twice,
  missed or not allowed, and outlines the part responsible.
- **Feedback.** A valid step locks in with a one-line reason it works (using the student's own numbers where
  possible); an invalid one shakes and snaps back with a one-line reason.
- **Standing toolbox.** The same tiles, in the same order, for every card of a module (`EXPR_TOOLBOX`,
  `STRUCT_MOVES`). A tile that can't act on the current kind of line is refused without counting as wrong.

### Support levels, hints, timing

- **Level 1, guided:** the part where the next step applies and the right tile are highlighted, and the kind of
  step is named ("Pull out the common factor"). The student still builds the step. **Level 2, prompted:** only the
  goal of the step ("Get everything onto one side"). **Level 3, open:** only the problem's goal.
- The level moves **within a card**: up after 3 clean steps in a row, down after 2 rejected steps in a row
  (`LEVEL_UP_CLEAN_STEPS`, `LEVEL_DOWN_ERRORS` in `config.ts`). The level a card ends on is remembered per skill.
  The Scaffolding dial in the Moves tab can pin a level (Auto adapts).
- **Hint ladder:** highlight the relevant part → name the kind of step → show the step. Any hint removes mastery
  credit for that card, and the idea resurfaces later as a fresh variant.
- **Timing:** only micro-session cards (quick reps and the daily set, `TIMED_SOURCES`) show a timer, and only on
  the decision step: it stops once the key move (or a single-step card's only step) locks in. Lessons are untimed,
  and so is the reveal. Budgets are per card type (`TIME_BUDGETS`, per-card `timeLimit`). **Not sure** is free and
  skips to the reveal.
- **Worked example:** interactive. The student predicts each step by performing it (guided, untimed, unscored);
  **Show me this step** reveals it. The key move is called out as it locks in.
- **Reveal:** an animated replay of the hand-authored shortest path with the key step highlighted, plus a note when
  the student skipped the key step or took more steps than the shortest path. One line of insight.

### Skills and how cards are scheduled

A skill is one interactive worked example, three easy reps and one twist. **Mastery needs the twist, finished at
Level 2 or 3 with no hints** (a twist never starts at Level 1, and dropping to Level 1 mid-card forfeits credit).
Skills have prerequisites. Three misses in a row re-show the worked example and park the skill for two days.
Earlier skills are mixed into later sets.

Daily set: one review from the mistakes queue, one new concept, one stretch from the weakest topic. Missed ideas
come back as fresh variants (never the same card) after 1, 3 and 7 days. Quick reps only draw from skills already
worked in a lesson or daily set.

**Logs and mistakes.** Every step is logged (`progress.steps`): topic, skill, support level, time, wrong-move count,
hint level, result. A missed card goes to the existing Errors tab and the Wednesday review with the problem, the
student's whole final workspace, the correct result, time taken, which step failed, an error type the student taps
(concept gap, didn't see the approach, setup error, arithmetic slip, misread, ran out of time; a metadata row on
the reveal, not part of the problem) and an optional one-line note.

`CONTEST_DATE` in `config.ts` is a placeholder fallback (`NEXT_PUBLIC_CONTEST_DATE`); the date in Settings wins.
Pacing and the difficulty ramp are computed from it.

### How verification works

- **Module A, per step** (`expr/verify.ts`): the new line is compared with the previous one by numeric evaluation
  at 12 seeded pseudo-random points, skipping points where the old line is undefined. Expressions must agree in
  value; equations must keep the same solution set (a rejected step names the root lost or added); congruences
  must agree at integer points. A new line that is undefined where the old one was fine (e.g. dividing by
  something that can be 0) is reported as a domain problem.
- **Module B, per step:** each typed count is compared with the slot's real option count at that position.
  **On Check** (`struct/module.ts`): the structure is enumerated on the scaled-down version and compared, outcome
  by outcome, with an independent brute-force list. Each card defines its scaled-down version (same template,
  same slots in the same roles, smaller pool).
- **Build gate:** `npm run verify:cards` (`verify-cards.ts`, runs before every build) replays every reference path
  through the live verifier, re-checks every key a second way that shares no code with it (exact polynomial
  identity, irreducibility and exact roots for Module A; full-size brute force for Module B), and for counting
  cards replays the path again with every count typed as a student would. It covers the 45 hand-written cards and
  40 generated variants per generator, and fails the build on any mismatch.
- **Tests:** `tests/engine-expr.test.ts`, `engine-struct.test.ts` and `engine-gestures.test.ts` cover every verifier,
  including steps that look valid but are not (a sum of squares as a difference of squares, only the positive
  root, 3x and 3x² "combined", the starting count reused in a later slot, dividing by a number no symmetry
  explains...). `tests/no-multiple-choice.test.tsx` renders every card at Levels 1–3, every worked example and the
  reveal, and fails if any tappable control is not a standing toolbox tile, a fixed control, a keypad key or a
  piece of the student's own workspace, or if the answer is ever a button.

### Add a card

Add an entry to `CARDS` in a pack file (`packs/quadratics.ts`, `packs/counting.ts`) with its prompt, start (or
template and full/scaled-down parameters), goal, hand-authored shortest path and key move(s), then run
`npm run verify:cards`. A card that doesn't verify can't ship.

### Add a topic pack

Write `packs/<name>.ts` exporting a `TopicPack` (skills, cards, `generate`) and list it in `registry.ts`. New Module A
moves go in `expr/moves.ts` and need a `META` entry (toolbox group, Level 1 kind, Level 2 goal, confirmation line):
they then appear in the standing toolbox automatically. New Module B problem shapes are templates registered with
`registerTemplate` (slots described in words, option counts, an independent brute force). Modular-arithmetic moves
(reduce, cycle, evaluate) already exist and are tested, but no cards use them yet.

### Keeping content original

No real contest problem, wording, name, year or number appears in the app; `verify:cards` rejects card text that
names one. Real problems are only tagged privately to build `data/topic-distribution.json` (aggregate topic shares
that drive sampling weights; it currently holds a placeholder estimate). Replace it with:

```bash
npm run topics:build -- path/to/your-tagged.csv
```

The CSV uses the problem bank's format (`contest,year,number,answer,topic,techniques`). Generated cards are built
backwards from their answers and replayed through the verifier before they are shown.

### Known limitations

- The Supabase path (migration, save action, parent view) is typechecked but has not been run against a live
  database. Guest mode was driven end to end in a headless browser (factoring, an equation solved by dragging
  terms across `=`, and a counting structure).
- Moves are verified in the browser, so answers ship to the client and a determined student could edit saved
  progress. Progress is one JSON document per student; two devices open at once overwrite each other.
- Numeric verification is probabilistic in principle. Irrational roots get no named counterexample.
- A move acts on a whole side or one top-level term/factor, not on deeper sub-expressions. "Drag a factor out of a
  group" is done with the Factor-out tile (drop the factor into its slot), not by dragging a sub-factor.
- Level 1/2 guidance follows the hand-authored path; after a valid detour it says so and offers Undo instead of
  re-planning from the new line.
- Module B adds slots only to the active (last) part. Probability is not built yet.
- "Shortest path" is hand-authored and replayed, not proven minimal.
