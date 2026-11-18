# AMC Coach

Three short cards a day to become a better AMC 10 problem solver, plus a problem bank, error log and accountability
tools for one family. Next.js (App Router, TypeScript) · Supabase (Postgres, auth, storage) · Vercel · Sendblue · Anthropic API.

## Status

| Milestone | Scope | State |
|---|---|---|
| **M1** | Schema, auth, problem bank, trainer (since replaced by Learn), error log | ✅ built, tested |
| **Learn** | Concept curriculum, card system, mastery and review engines (see below) | ✅ built, tested; Supabase path not yet run against a live database |
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
npm test          # unit tests: learning system (curriculum, cards, mastery, review, selection, persistence, a full journey), guest, plan
```

```bash
npm run test:db   # row-level-security checks against the local Supabase (needs seed:demo)
```

```bash
npm run verify:cards   # validates the curriculum and every card; also runs before every build
```

## Guest mode

The sign-in screen has a **Continue as guest** button (`/guest`). Guests need no account and nothing touches Supabase:
all progress lives in the browser's `localStorage` (`src/lib/guest`), and the middleware skips the auth check for `/guest`
(it also sends a returning guest, remembered by the `amc_guest` cookie, back to `/guest` instead of the sign-in screen).

- One person with full permissions: they train, log attempts, manage the problem bank (including sealing problems
  in the vault) and edit dates. There is no parent/student split.
- Starts with the 20 original sample problems. Same learning engines as the signed-in app
  (shared pure modules in `src/lib`; the guest engine is `src/lib/guest/engine.ts`, tested in `tests/guest.test.ts`).
- Data is per browser: clearing site data or switching devices starts over. Settings has **Download / Restore backup**.
- Guests can't get text reminders (they need an account).

## How M1 works

- **Accounts.** A parent signs up and confirms they are the parent or guardian. They create the household, then
  create the student's login. The student never signs up on their own. Parent and student have the same management powers (settings, vault, delete problems); only
  the student can log attempts. Row-level security covers every table (`tests/db/rls.test.ts`).
- **Daily plan and streak.** The weekday plan and streak rules (`src/lib/plan.ts`) and the stored activity rows are
  kept, but no longer shown: the home page is the learning system below, with no streak.
- **Problem bank.** Sources: `aops_wiki` (a link plus metadata; the database rejects stored problem text),
  `pasted`, and `generated` (M5; the database rejects generated problems in the vault). Statuses: train, vault
  (sealed: tags and answer hidden in the UI), burned. Add problems one at a time or by CSV:
  `contest,year,number,answer,topic,techniques[,status]` with tags separated by `;`, from the controlled vocabulary
  in `src/lib/tags.ts`.
- **Trainer and spaced review of twins.** Removed with the rebuild; see "What was removed" below. Past attempts and
  their reviews are kept and still appear in the error log.
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

## The learning system (Today and Map tabs)

Opening the app shows today's three cards. Each one teaches or tests one capability, takes about 20–45 seconds,
and has no timer. Code: `src/lib/learn` (pure logic, no React), `src/components/learn` (UI), `tests/learn`.

**Curriculum** (`src/lib/learn/curriculum`). Course → domain → unit → concept → learning objectives → cards. The AMC 10
course has 40 concepts in five domains; each has a description, measurable objectives, prerequisites (`required`
blocks the daily plan from starting it, `helpful` never blocks), techniques, related concepts and a mastery
standard. 12 concepts have cards so far; the rest show on the map as "not written yet" and are never scheduled.
`validateCurriculum` checks ids, objectives, references and cycles.

**Cards** (`src/lib/learn/cards`, content in `src/lib/learn/content`). Five types: insight, technique (teaches the
method with a worked demonstration first), recognition, application and variation. Interactions: exact numbers,
symbolic expressions (with a "factor completely" check), fill-in-the-blank reasoning, step ordering, tapping a
figure, a written explanation compared against a model, and single or multiple selection. Application and variation
cards must ask for the answer itself; single choice is capped at 20% of the bank. Card text uses `$…$` math and
`**bold**`. Every card has an objective, difficulty, estimated time, hint, reasoning-based feedback (including known
wrong answers and what they usually mean), explanation, takeaway, "use it when", and provenance. Some cards are
generated from families with new numbers, so reviews need not repeat a problem.

**Verification** (`npm run verify:cards`, run before every build). Every card with a computable key is recomputed
by an independent function in `content/verifiers.ts` (brute force, integer arithmetic, or exact arithmetic on
a + b√d; geometry keys are also measured from the figure's coordinates). The checker must accept the key and reject
every listed slip; the explanation must state the answer; markup must parse; no real contest names or problem
numbers. Generated families are validated over 30 seeds and re-validated before a variant is shown. Cards with
no computable key (ordering, explanations, "which approach" choices) are marked `reasoned` with a review note, and
any numbers quoted in their explanations are rechecked.

**Mastery** (`mastery.ts`). Everything is derived from one evidence log. A response is *clean* when it is right on
the first try, with no hint, checked by the app (not self-judged), and not the same problem seen in the last 14 days
(or a same-structure variant in the last 3). States: Locked → Available → Introduced → Developing (follows the idea)
→ Practicing (one clean application) → Proficient (two different clean applications, one clean recognition, one
clean variation) → Mastered (plus two clean successes after gaps of 3+ days, one after 7+, one an application or
variation). Two recent misses mark a concept as needing reinforcement and cap it at Developing until a clean
success. The map shows the evidence behind each state and the next thing that would move it.

**Review** (`review.ts`). Per concept, not per card: intervals 1, 3, 7, 16, 35, 75 days. A clean, spaced success moves
up a step; cramming the same day doesn't; a miss drops two steps and is due tomorrow.

**Daily selection** (`select.ts`). Default Discover / Reinforce / Apply. With two slipping concepts or many overdue
reviews it becomes Reinforce, Reinforce, Apply with nothing new; with three concepts open, it finishes those first.
New concepts come from the domain furthest below its share of the contest (`data/topic-distribution.json`). Within a
concept it follows teaching order and what evidence is missing; a card or problem family is never repeated in a day,
and a seen card returns only after 7 days when nothing fresh exists. After the three, "One more card" is available,
and any concept can be practised from the map.

**Storage** (`persistence.ts`). Local-first and versioned (v2). Guests keep the record in `localStorage` with a backup
at the first save of each day (last 5 kept); unreadable data is set aside, never overwritten, and the newest good backup
is restored. Settings → Download backup includes the learning record. Signed-in students keep it in the
`engine_progress` row; the server action validates it and refuses to overwrite a row it cannot read. `LearnRepository`
is the seam for a future backend.

**Migration from the Moves engine (v1).** Old card logs become evidence on the matching concepts, flagged as legacy:
they count as exposure (Developing, scheduled for review) but never as clean evidence, because those cards offered a
move menu and ran on a timer. Timeouts are dropped; mistakes and their takeaways move to the error log. The original
document is kept as a backup.

**What was removed.** The Trainer tab (timed A–E problems) and the Moves tab (timed move-picking), with their engines
and tests, and the streak, weekday checklist and heat grid on the home page. The problem bank, error log, settings,
accounts, guest mode and the stored activity data are unchanged. The move cards' worked examples were reviewed and
several were adapted into the new cards (marked `adapted` in their provenance).

**Add a card.** Add it to a file in `src/lib/learn/content`, add an independent verifier for a computable key, and run
`npm run verify:cards`. A concept becomes schedulable once it has at least two teaching cards (one a technique),
a checked recognition card, two applications and a variation.

**Known limitations.**

- The Supabase path (load, migrate and save of the learning record) is typechecked but has not been run against a
  live database. Guest mode was tested in a browser.
- 12 of 40 concepts have cards. Solving quadratics lost its move cards and has none yet.
- Answers are checked in the browser, so keys ship to the client.
- Explanations are self-assessed against a model answer, so they never count as clean evidence.
