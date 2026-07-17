# Metric suggestions — engaged / positive user behaviour

Written 2026-07-16 from `app_analytics_export_2026-07-16_16-06.csv` and
`state_conditions 2.json`.

**Updated 2026-07-17** from `app_analytics_export_2026-07-17_10-16.csv`
(9,778 events, 195 users, 184 with chapter data) and cross-checked against
`app_analytics_export_2026-07-17_13-15.csv` (9,835 events, same 195 users). This
revision resolves the `day`-condition open issue, records a client-side
event-loss problem found while chasing a missing chapter 16 completion, and adds
four new metric candidates.

**Read this first: re-listening is good behaviour, and nothing may penalise it.**
Users skip backwards and forwards to re-hear chapters, and that is deliberate,
healthy use of a wellbeing app — not regression and not cheating. Any metric that
keys on a user's *latest* chapter event rather than their *furthest* will
misread it. This has already caused one real bug (Drop-off Point, fixed) and one
retracted conclusion (traversal shape as a cheat signal, see the `day` section).

---

## Status at a glance

| # | Metric | Status |
|---|---|---|
| 1 | Practice-to-narrative ratio | **Built** 2026-07-17 |
| 2 | Task completion rate, per user | Not built |
| 3 | Post-ending engagement | **Built** 2026-07-17 |
| 4 | Resonance held between sessions | Not built |
| 5 | Ambient use (`patch`) | Not built — semantics still unconfirmed |
| 6 | Crash / lost-session rate | **New suggestion** |
| 7 | Eligible-but-unreported | Partly built (eligible cumulative chart) |
| 8 | Export completeness | **New suggestion** |
| 9 | Time spent eligible before taking a chapter | **New suggestion** |
| 10 | Practice depth vs. breadth | **New suggestion** |

---

## Context: what the export actually contains

| category | events | notes |
|---|---|---|
| chapter | 4,038 | `started` only — no completion event exists |
| task | 2,082 | `started` (1,428) / `finished` (654) |
| app | 1,996 | `opened` / `last seen` — session boundaries |
| patch | 1,662 | **not referenced anywhere in the dashboard** |

Task entities: `nature` (999), `breathing` (399), `stargazing` (339),
`meditation` (207), `rain` (138).

Patch entities: `ambient` (1,636), `mic` (12), plus `test`/`dyl`/`main`/`Test`
(14 total) which are dev artefacts.

Resonance is 0–100 and appears on every row, so any event can be located
against the gates in `state_conditions 2.json`.

**Timezones.** No timezone is stated anywhere, but it is derivable: `Event
Action` carries a device-local timestamp (`"opened 15:38 20/05/2026"`) while
`Event Date/Time` is one common clock. Differencing them per user, 101 of the
121 placeable users sit at +0 — so `Event Date/Time` is **local wall-clock, not
UTC**. The offset clusters only resolve to real zones under a BST home (−8 → US
Pacific, −5 → US Eastern, +7 → China/Singapore, +8 → Japan), so the home zone is
almost certainly `Europe/London`. 20 users are on other clocks; 74 users have no
`opened` row and can't be placed at all.

---

## 1. Practice-to-narrative ratio — **built**

**What:** task events ÷ **distinct chapters reached**, per user.

**Why:** chapters are the reward, activities are the actual wellbeing practice.
A user at eight activities per chapter is living in the app; a user at 1.2 is
doing the minimum to get the next story beat. The dashboard charted chapter
progression and activity volume separately, so this distinction was invisible —
the two populations looked identical on every existing chart.

**Changed from the original spec.** The spec said task events ÷ *chapter
events*. That denominator is wrong: chapter events include re-entries, so a user
who replays a chapter is charged more narrative without consuming any. It
misclassified exactly the users the metric exists to find — `USER-DMCV3W` scored
1.91 (56 chapter events, reads as "doing the minimum") when their real figure is
6.29 across 17 distinct chapters, second-highest in the cohort. Distinct
chapters is now the denominator.

**Still open:** the numerator counts all task events (`started` + `finished`), so
users who finish score roughly double per practice session against those who
abandon. Given 54% of started tasks are abandoned that is not a small
distortion — `started` only would count attempts evenly. Not changed, because the
original spec said raw task events.

Cohort average is a stat tile (**1.69** at time of writing): the mean of each
user's ratio, so every user counts once regardless of volume. Seven of 23 cohort
users are at 0.00 — they take chapters and never practise — which drags the mean
hard. Total-tasks ÷ total-chapters would read higher by weighting toward the
heavy practitioners; different question, one-line change.

---

## 2. Task completion rate, per user

**What:** distribution of per-user `started` → `finished` ratios, not the
aggregate the dashboard already shows.

**Why:** users abandon **54% of what they start** (1,428 started, 654 finished).
For a meditation app that is a product finding in its own right. The per-user
*distribution* is the valuable part: a bimodal split means "finishers vs.
bouncers" (a targeting problem), while everyone clustered at ~46% means the
activities themselves are too long or unsatisfying (a design problem). These
imply completely different fixes and the aggregate can't tell them apart.

**Watch:** pairing needs a time window. Unmatched `finished` events and
same-entity re-starts will otherwise inflate or deflate the ratio.

**Data:** available now.

## 3. Post-ending engagement — **built**

**What:** activity by users who have reached chapter 17, after they reach it.
Built as the **Post-Ending Engagement** chart: task events after a user's first
final-chapter event, per user. The final chapter is read from `MAX_STATE` rather
than hardcoded, so it follows if the story grows.

**Exposure time is the whole story, and the spec's "counts, never percentages"
warning does not cover it.** The problem isn't percentages, it's unequal
windows. Raw counts invert the ranking: `DMCV3W` looks third at 10 task events,
but did them in the **2.7 hours** between reaching the ending and the export
cutting off, while `K4TUBV` had 11.6 days to accumulate 4. Every tooltip
therefore carries the observation window, and a bar of 0 on a short window means
nothing at all.

`patch`/ambient and chapter re-listens are in the tooltip, not the bar — ambient
because its semantics are unconfirmed (#5), re-listens because they are a
different behaviour, though a legitimate one.

**Why:** chapter 17 is the last state in the JSON. Past it there is no story
left to unlock, so *anything* a user does is free of extrinsic pull. This is the
strongest available evidence that the app became a practice rather than a
narrative.

**Watch:** tiny cohort — only **5 users** reach chapter 16 with a credible
pattern (see the `day` section below); 4 are recorded at chapter 17, of which 3
are in the alpha cohort (`UA38YU` is pre-alpha). Report counts, never
percentages. Note that `TLZFTR` sits at chapter 16 and `258HNL` has confirmed
chapter 17 with no event for it — so the true post-ending population is larger
than the recorded one.

**Data:** available now.

---

## 4. Resonance held between sessions

**What:** resonance at session end vs. resonance at next session start.

**Why:** separates durable progress from grind-and-decay. A user who holds or
builds across a gap is sustaining something; one who decays and re-grinds is
treading water while looking busy on volume charts.

**Note:** only 41–50% of activity sessions raise resonance at all, averaging
about +3. So resonance is slow and noisy — this needs several sessions per user
to say anything, and should be restricted to users with a decent session count.

**Watch:** session ends are unreliable — see the event-loss section. 109 of 1,062
sessions have no end event at all.

**Data:** available now — `buildAppSessions()` already produces the boundaries.

---

## 5. Ambient use (the `patch` category)

**What:** anything at all. It is currently unmeasured.

**Why:** 1,662 events across 126 users that the dashboard never touches. 98% is
`ambient` (1,636), the rest is `mic` (12) plus `test`/`dyl`/`main` dev noise.
If `ambient` is a soundscape left running, that is passive companion use — a
distinct engagement mode, and plausibly a strong one for a wellbeing app.

**Watch:** `started` only, no matching end event, so duration isn't directly
derivable. Repeated identical `started` rows suggest a heartbeat rather than
discrete user actions — worth confirming against the app before reading
anything into the counts. The `test`/`dyl`/`main` entities are dev artefacts
and should be excluded.

**Data:** available now, but semantics need confirming first.

---

## RESOLVED: the `day` condition **is** wall-clock

The previous revision hypothesised that `day: N` was an in-game day counter
rather than real days, on the grounds that the median user reached chapter 16 on
their 1st–2nd active day against a `day: 10` gate — and warned that if so, the
cheat filter was discarding half the userbase on a false premise.

**That hypothesis is wrong, and the statistic that motivated it was
contaminated.** Of the 21 users who reach chapter 16, 15 are dev builds. The
median was computed over a population that is nearly three-quarters dev
accounts.

Splitting them by median gap between consecutive **first**-entries
(`13-15` export):

| pattern | users | active days |
|---|---|---|
| organic pacing (median gap 6.5h–17.1h) | 6 | 10, 10, 11, 11, 12, 14 |
| rapid chaining (median gap 0–150s) | 15 | 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 4, 8 |

**No organic user reaches chapter 16 with fewer than 10 active days, and the
minimum is exactly 10 — the gate.** There is no overlap and nobody sits between
the groups. That is what a real, enforced wall-clock gate looks like.

**The argument rests on the day count alone.** An earlier revision also cited
traversal shape as evidence — `GVUGDH` running chapters 4→14 in 70 seconds and
then walking *backwards*, `ECDMKD` visiting chapter 1 after chapter 17. **Retract
that.** Skipping backwards and forwards is normal, deliberate use: people
re-listen to chapters. `258HNL` — a confirmed real user — produced an identical
backwards chain on 17 July, and it was *induced* (they were asked to skip around
so their user ID could be identified). The chain is not evidence of anything.

What does hold: **you cannot have chapter 17 unlocked on 4 active days when the
gate needs 10.** `GVUGDH` has 4, `ECDMKD` has 2. They did not earn the state, so
they are on dev builds. The traversal was never the proof; the day count was.

The same logic confirms `258HNL` from the other direction: they could skip
straight into chapter 17 on request *because it was unlocked*, which is only
possible if they had earned it.

**Consequence:** the cheat filter's premise is sound and it should stay on. Note
that the filter only ever compared active days against the gates — it never
looked at traversal, so no one was flagged for re-listening. The sample is small
(6 organic users), so this is strong but not conclusive; the exact-10 boundary
is what makes it convincing.

---

## NEW: the client loses events

Found while chasing a chapter 16 completion that a tester confirmed by
screenshot but which does not exist in the export. **This is the most important
finding in this revision — it is upstream of every metric here.**

**Mechanism.** The client defers writes and flushes on next launch. A session's
`last seen` is written at the moment the *next* session opens — 866 of 905
closed sessions (95.7%) have their end row land within 2 seconds of the next
open. So anything pending when the app dies is never sent.

**Evidence of loss:**

- **109 of 1,062 sessions have no end event.** 92 are a user's final session
  (expected — not reopened yet). **17 are earlier sessions**: the flush never
  happened. That is the crash signature.
- **21 of 184 users are missing a chapter event below their furthest chapter.**
  `LBBQGC` reached chapter 17 with 14 intervening events absent.

**The worked case — `USER-258HNL`.** Organic pacing, chapter 1 on 6 July to
chapter 15 on 15 July, respecting every gate. Three mid-history unflushed
sessions — out of only 8 users in the whole dataset with any. Demonstrably loses
events (no chapter 11 despite reaching 15). Their 10th active day, which unlocks
chapter 16, began at 00:03 on 16 July; that session never flushed, and their
last event is 00:07:18 that day despite the `10-16` export running to 17 July
10:16. At that moment they satisfied every recorded condition for chapter 16
(chapter 15 done, 10 days, resonance 100). **The user confirmed by screenshot
that they completed chapters 16 and 17.** The events never arrived.

### Confirmed: lost events do not come back

The `13-15` export settles what the flush does and does not recover, and the
answer is worse than expected.

`258HNL` gained chapters 16 and 17 between the two exports — but **not as
recovered 16 July events.** They are new events timestamped 17 July 12:56–13:01,
from a session where the user opened the app, went straight into chapter 17 as
the first action, and walked backwards through every chapter (this was induced —
they had been asked to skip around so their ID could be identified).

So the deferred flush delivers the **session boundary** but **not the buffered
events**. `2SZCGM` shows the boundary half cleanly: a `"last seen 09:59
16/07/2026"` row written at 17 July 14:08, on relaunch. The chapter events from
16 July are permanently gone.

**The consequence is a silently wrong timeline, not just a low count.** The
record now says `258HNL` reached chapter 17 on the 17th. They did it on the
16th. The count self-repaired only because they happened to revisit; had they
never reopened, the completion would have stayed invisible forever. Any metric
keyed on *when* a chapter was reached — time-to-gate, #9, retention curves — will
be quietly wrong for affected users, and there is no flag marking them.

**Consequences to carry into every metric:**

- Chapter counts are a floor, not a truth. The dashboard can only show what it
  is given.
- Chapter *timestamps* are not trustworthy either, for any user with a crash
  signature.
- Every user's most recent session is systematically incomplete: 92 sessions
  have no end, so they are counted as zero-length and contribute nothing to
  engagement totals. Engagement is under-reported by roughly one session per
  user.
- Session-boundary metrics (#4) inherit this directly.

**This needs the client team.** No dashboard change can recover the data.

---

## 6. Crash / lost-session rate *(new)*

**What:** per user, count of mid-history sessions with no end event — i.e.
sessions where the deferred flush never happened.

**Why:** it is simultaneously a product-health metric (whose app is crashing)
and a data-quality metric (how much are we under-counting, and for whom).
`258HNL` had three and it cost us a real chapter 16 completion. 8 users show the
signature today; if that number moves, trust in every other chart moves with it.

**Watch:** a user's *final* session legitimately has no end event — they simply
haven't reopened. Only count sessions with a later session from the same user.

**Data:** available now.

---

## 7. Eligible-but-unreported *(partly built)*

**What:** users who satisfy every recorded condition for a chapter but have no
event for it.

**Why:** this is the `258HNL` detector. It would have surfaced them
immediately instead of taking a long investigation. Built as the **Chapter
Completions Eligible Cumulative** chart; it isn't yet surfaced as an alert or a
list.

**Watch — this is an upper bound.** Six unlock conditions (`persuasion`,
`clairvoyance`, `dreamweaving`, `slowTime`, `water`, `night`) never appear as
entities for *any* user, so they cannot be verified and are skipped. Only `day`,
`resonance` and `nature` are checkable. Chapter 16 genuinely requires
`persuasion` and we cannot test it. `rain` and `stargazing` exist as tasks and
are tempting matches for `water`/`night` — that mapping is a **guess** and is
deliberately not encoded. Confirming it against the app would make two more
conditions checkable.

**Also:** chapters whose only gate is the previous chapter (2, 6, 13, 17) make
eligibility trivially true, so the low end is noisy — chapter 2 gains +6 from
users who did chapter 1 and churned. The signal is at the top of the chart
(14–17). Restricting extension to users with evidence of loss (an unflushed
session, or a gap in their chapter sequence) would keep `258HNL` and drop the
churn.

---

## 8. Export completeness *(new)*

**What:** a standing data-quality panel — % of users with a chapter gap, count of
mid-history unflushed sessions, count of sessions with no end.

**Why:** currently 21/184 users have a hole in their chapter sequence and
nothing on the dashboard says so. Every number on every chart is quietly a floor.
A visible completeness figure stops silent under-reporting being mistaken for
user behaviour — which is exactly the mistake this investigation started as.

**Data:** available now.

---

## 9. Time spent eligible before taking a chapter *(new)*

**What:** elapsed time between a user first satisfying a chapter's conditions and
their first event for that chapter.

**Why:** separates *gated* from *disengaged*. A user who takes a chapter within
minutes of unlocking it is pulled by the story; one who sits eligible for days
has the content available and isn't coming back for it. The current drop-off
chart cannot tell "stuck at the gate" from "lost interest after the gate" — very
different fixes.

**Watch:** needs the day gate to be wall-clock, which is now established.

**Data:** available now.

---

## 10. Practice depth vs. breadth *(new)*

**What:** per user, number of distinct task entities used vs. total task events.

**Why:** `nature` is 48% of all task events (999 of 2,082). A user doing only
`nature` and a user rotating through all five have the same practice-to-narrative
ratio but are not the same user. Breadth plausibly signals someone exploring the
app as a practice rather than optimising the cheapest route to resonance — and
the previous revision established that meditation is the most *efficient*
resonance gain (+5.38 vs +2.96 for nature), so route-optimising is a real
behaviour to control for.

**Data:** available now.

---

## Who's who — the users that keep coming up

| user | verdict | evidence |
|---|---|---|
| `258HNL` | **Real. Never cheat-flagged.** | Organic pacing, 11 active days. Completed ch16/17 on 16 July — confirmed by screenshot; those events were lost to a crash. Chapters 16/17 appear in the `13-15` export only because they revisited on 17 July, so their recorded timeline is 1 day late. Was absent from chapter charts because the data wasn't there, not because a filter hid them |
| `JZQAMV` | Cheat/dev | 8 active days against a 10-day gate. The user revealed by toggling Filter Cheat/Dev off |
| `GVUGDH` | Cheat/dev | **4 active days** against a 10-day gate. Hidden twice: cheat-flagged **and** hardcoded in the exclusion list, so the cheat toggle never reveals them |
| `ECDMKD` | Cheat/dev | **2 active days** against a 10-day gate. Cheat-flagged and excluded by the alpha button |
| `ELDVJ2`, `K4TUBV`, `DMCV3W`, `TLZFTR` | Real | Confirmed chapter 16 finishers, all ≥10 active days |

The distinction that matters: **`258HNL` was hidden by missing data; everyone
else by a filter.** That is why toggling filters never surfaced them.

---

## Dashboard changes made 2026-07-17

- **Fixed Drop-off Point**, which keyed on the user's *latest* chapter event by
  timestamp and so recorded re-listening as regression. `ELDVJ2` finished the
  story, went back to chapter 2, and was charted as having dropped off at
  chapter 2 — misread by 15 chapters; `258HNL` by 5. It now uses the furthest
  chapter reached, and has a rollover listing who is at each bar. Re-worded
  Chapter Re-entry Rate to read as engagement rather than churn.
- **Chapter Completions Eligible Cumulative** — new chart (#7 above). The
  original cumulative chart is unchanged, alongside it. Vindicated in practice:
  it counted `258HNL` at chapters 16 and 17 before any event for them existed,
  and the user then confirmed both.
- **Post-Ending Engagement** — new chart (#3).
- **Practice-to-Narrative Ratio** — new chart (#1) plus an *Avg practice /
  chapter* stat tile.
- **Rollover on Chapter Completions** — hovering a bar lists the users behind
  it, capped at 30 (a chapter runs to ~180 users with the cohort filters off).
- **Fixed UTC day-bucketing.** `toISOString().slice(0,10)` was reinterpreting
  local wall-clock timestamps as UTC, filing anything before 01:00 BST under the
  previous day. It affected 13 call sites — the cheat detector, DAU/MAU,
  days-active, streaks, resonance-by-day and every weekly/monthly bucket. Week
  keys were worst: a Monday event before 01:00 filed into the previous week. Day
  bucketing is now timezone-independent. This corrected one cheat verdict
  (`6R9KVL`, whose single active day was being split into two, letting them
  through chapter 3's 2-day gate).
- **Fixed the date-range `from` filter**, which parsed `YYYY-MM-DD` as UTC
  midnight against local event times, dropping events in the first hour of the
  boundary day.

### Known, not fixed

- **Cheat detector counts lifetime active days**, including days *after* the
  chapter being judged. `ELDVJ2` is credited with 14 when only 10 preceded their
  chapter 17 event. Latent rather than active: on this export the fix changes no
  verdict, because flagged users fail by wide margins and passing users clear the
  gate before the event anyway. A user who reached a chapter early and kept
  playing for weeks would be wrongly rescued.
- **Hardcoded exclusions.** `USER-GVUGDH` and `USER-DVXWZU` are seeded into the
  exclusion list on every page load, merged with anything in `localStorage`.
  Assumed deliberate (both look like dev accounts). Note the seeds and
  user-added exclusions share one list, so **Reset clears the seeds until
  reload**, and `localStorage` entries persist silently across sessions.
- **`parseActionTimestamp` only matches slash-format dates.** Three rows use
  dashes (`"opened 12:14 15-06-2026"`) and silently fall back to
  `Event Date/Time`. Cosmetic.
- **Alpha filter auto-enables on upload** (`filter-alpha-btn.click()`), which is
  intended — it selects the real alpha testers. Worth knowing that the variable's
  default is `false` and **Reset turns it off**, so Reset gives a *wider* cohort
  than a fresh upload rather than the same one.
