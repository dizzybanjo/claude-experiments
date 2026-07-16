# Metric suggestions — engaged / positive user behaviour

Written 2026-07-16, from `app_analytics_export_2026-07-16_16-06.csv` (9,658 events,
184 users with chapter data) and `state_conditions 2.json`.

Excludes **Voluntary Practice**, which is being built into the dashboard separately.

---

## Context: what the export actually contains

| category | events | notes |
|---|---|---|
| chapter | 4,015 | `started` only — no completion event exists |
| task | 2,031 | `started` (1,393) / `finished` (638) |
| app | 1,978 | `opened` / `last seen` — session boundaries |
| patch | 1,634 | **not referenced anywhere in the dashboard** |

Task entities: `nature` (976), `breathing` (389), `stargazing` (330),
`meditation` (198), `rain` (138).

Resonance is 0–100 and appears on every row, so any event can be located
against the gates in `state_conditions 2.json`.

---

## 1. Practice-to-narrative ratio

**What:** task events ÷ chapter events, per user.

**Why:** chapters are the reward, activities are the actual wellbeing practice.
A user at eight activities per chapter is living in the app; a user at 1.2 is
doing the minimum to get the next story beat. The current dashboard charts
chapter progression and activity volume separately, so this distinction is
invisible — the two populations look identical on every existing chart.

**Data:** available now. No new events needed.

---

## 2. Task completion rate, per user

**What:** distribution of per-user `started` → `finished` ratios, not the
aggregate the dashboard already shows.

**Why:** users abandon **54% of what they start** (1,393 started, 638 finished).
For a meditation app that is a product finding in its own right. The per-user
*distribution* is the valuable part: a bimodal split means "finishers vs.
bouncers" (a targeting problem), while everyone clustered at ~46% means the
activities themselves are too long or unsatisfying (a design problem). These
imply completely different fixes and the aggregate can't tell them apart.

**Watch:** pairing needs a time window. Unmatched `finished` events and
same-entity re-starts will otherwise inflate or deflate the ratio.

**Data:** available now.

---

## 3. Post-ending engagement

**What:** activity by users who have reached chapter 17, after they reach it.

**Why:** chapter 17 is the last state in the JSON. Past it there is no story
left to unlock, so *anything* a user does is free of extrinsic pull. This is the
strongest available evidence that the app became a practice rather than a
narrative.

**Watch:** small cohort (18 users reached chapter 16 unfiltered), so report
counts, never percentages.

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

**Data:** available now — `buildAppSessions()` already produces the boundaries.

---

## 5. Ambient use (the `patch` category)

**What:** anything at all. It is currently unmeasured.

**Why:** 1,634 events across 126 users that the dashboard never touches. 98% is
`ambient` (1,608), the rest is `mic` (12) plus `test`/`dyl`/`main` dev noise.
If `ambient` is a soundscape left running, that is passive companion use — a
distinct engagement mode, and plausibly a strong one for a wellbeing app.

**Watch:** `started` only, no matching end event, so duration isn't directly
derivable. Repeated identical `started` rows suggest a heartbeat rather than
discrete user actions — worth confirming against the app before reading
anything into the counts. The `test`/`dyl`/`main` entities are dev artefacts
and should be excluded.

**Data:** available now, but semantics need confirming first.

---

## Open issue: the `day` condition may be misinterpreted

**This affects trust in every metric above, and the default filters.**

`detectCheatUsers()` reads `day: N` in the state conditions as "N unique real
calendar days" and flags **88 users** as cheats. That filter is **on by
default**, and is much of why the default view collapses 179 users to 18.

The data doesn't support that reading:

- Median user reaches chapter16 on their **1st–2nd active day**, despite `day: 10`.
- Median elapsed time from chapter1 to chapter12 is **0.02 days** (~30 minutes),
  against a `day: 7` gate.
- For some users the elapsed time is **negative** — chapter12 entered before
  chapter1 ever was.

The negative spans are partly replay (users revisit chapters, so "first chapter1
event" isn't their start). That doesn't explain day gates falling in one sitting.

**Hypothesis:** `day` is an **in-game day counter, not wall-clock**. It sits
alongside `night: true` and `slowTime: true`, which are plainly world-state, not
real time.

If that's right, the cheat filter is discarding over half the userbase —
plausibly including the *most* engaged users — on a false premise. Resolving
this needs the app source; it can't be settled from the export.

---

## Correction to an earlier claim

I initially suggested that breathing and meditation are "voluntary" because no
gate names them as a condition (unlike `nature: true`). **That reasoning was
wrong.** Both raise resonance, and resonance gates it at chapters 5, 7, 8, 9,
10, 11, 12, 14, 15 and 16 — so they are an instrumental route to progression.

Measured resonance gain per paired session:

| activity | avg Δ | sessions |
|---|---|---|
| meditation | **+5.38** | 52 |
| breathing | +3.56 | 154 |
| nature | +2.96 | 431 |

Meditation is the *most efficient* resonance gain in the app. So the observed
"meditators reach chapter 12.7 vs 5.5 for non-meditators" gap may be measuring
optimal grinding rather than devotion, and is further confounded by
survivorship (deeper users have more chances to meditate).

This is why Voluntary Practice is defined by **user state at the moment of the
session** — resonance already at or above the next chapter's gate — rather than
by activity type.
