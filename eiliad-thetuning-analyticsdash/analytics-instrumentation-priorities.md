# Analytics instrumentation — top 5 priorities for the app developer

**Prepared:** 4 September 2026
**Source data:** `app_analytics_export_2026-07-28_12-42.csv` — 10,551 rows, 199 distinct users, 187 with chapter activity
**Method:** analysis of the raw export cross-referenced against the workarounds the dashboard (`eiliad-thetuning-analyticsdash.html`) is currently forced to implement

Ranked by how much insight is unavailable today. Items 1–3 make headline numbers *wrong* rather than merely missing; item 4 loses a whole cohort; item 5 blocks causal questions rather than descriptive ones.

Fixing items 1 and 2 alone would let us remove both duration caps and the Quality Sessions filter from the dashboard.

---

## Current export schema

| Column | Notes |
|---|---|
| `User ID` | Pseudonymous, per-run (see item 4) |
| `User Registration Date` | Clean and internally consistent, but equals first event exactly |
| `Event Category` | `app`, `chapter`, `patch`, `task` |
| `Entity ID` | Session UUID for `app`; name for everything else |
| `Event Action` | `opened` / `last seen` / `started` / `finished` |
| `Resonance` | 0–100. Healthy — zeros concentrate in ch1–6 as expected and vanish from ch7 |
| `Event Date/Time` | Naive local timestamp, no zone |

Event volumes:

| Category | Action | Rows |
|---|---|---|
| chapter | started | 4,193 |
| patch | started | 1,824 |
| task | started | 1,626 |
| task | finished | 726 |
| app | opened | 1,135 |
| app | last seen | 1,046 |

Note there is no `chapter finished`, no `patch finished`, and no `app closed`.

---

## 1. No session-end event — "last seen" is a heartbeat, not a boundary

`app` emits `opened` plus `last seen` against a session UUID, but that UUID survives backgrounding, so `last seen` keeps advancing for days.

| Session length | Share of 1,018 paired sessions |
|---|---|
| > 5 min | 71.8% |
| > 30 min | 51.6% |
| > 60 min | 45.6% |
| > 6 h | 29.0% |
| > 24 h | 11.8% |
| > 7 days | 2.2% (longest: **18.8 days**) |

The dashboard's 360-minute cap exists purely to contain this, and it **discards 83.7% of all measured time** — 14,453 h raw collapses to 2,352 h once capped. Every time-based metric rests on that guess: total time spent, average and median session duration, DAU/MAU, and the minimum-engagement threshold that decides who is even in the cohort.

A further 142 of 1,160 sessions (12.2%) are missing one half of the `opened`/`last seen` pair entirely.

**Fix:** emit an explicit `closed` / `backgrounded` event carrying an app-measured foreground duration, and mint a new session id after N minutes in the background rather than resuming the old one.

---

## 2. Two of five activities never emit `finished` at all

| Activity | Started | Finished | Implied completion |
|---|---|---|---|
| nature | 625 | 468 | 74.9% |
| stargazing | 380 | **0** | **0.0%** |
| breathing | 270 | 183 | 67.8% |
| meditation | 207 | 75 | 36.2% |
| rain | 144 | **0** | **0.0%** |

`stargazing` and `rain` are 524 starts — 32% of all activity starts — that can never be resolved. This is a bug rather than user behaviour: it is not credible that 380 stargazing sessions produced exactly zero completions while nature completes three quarters of the time. `meditation` at 36.2% also warrants a look.

Compounding it, `task` rows carry no instance id — `Entity ID` is just the activity name — so a start can only ever be paired to "the next finish by the same user". Across the file that produces:

- 717 cleanly paired start → finish
- 909 starts with no finish (**56% of all starts unresolved**)
- 780 start-after-start sequences, each one a lost end event
- 9 finishes with no preceding start

Separately, `patch` (deep listening, 1,824 events, 1,798 of them `ambient`) has **no end event in the schema whatsoever**, so all passive-practice time is inferred from the gap to the next unrelated event.

**Fix:** emit `finished` for all five activities; add an attempt/instance id so a finish can be tied to its own start; add an end event for `patch`; and put the app-measured duration on the finish event rather than making the dashboard subtract timestamps.

---

## 3. No chapter `completed` event, and `started` re-fires as spam

4,193 `chapter started` rows cover only 1,188 distinct user-chapter pairs — an average of 3.5 starts each, with one user re-starting a single chapter 47 times.

The gaps between consecutive re-starts of the *same* chapter by the *same* user show this is not re-reading:

| Gap since previous start | Share of 3,005 re-starts |
|---|---|
| within 10 seconds | 11.7% |
| within 1 minute | 35.7% |
| within 5 minutes | 54.6% |
| within 1 hour | 73.9% |
| within 1 day | 92.0% |

Median gap is 3.2 minutes. The event is firing on view, render or resume, not on genuine chapter entry.

Because there is no completion event, the entire funnel is inferred from "highest chapter number ever started" — which cannot distinguish *opened chapter 7* from *completed chapter 6*. Stall-point analysis and drop-off inherit that ambiguity directly.

Furthest chapter reached, by user count: ch1 33, ch2 25, ch3 14, ch4 12, ch5 8, ch6 18, ch7 16, ch8 10, ch9 4, ch10 3, ch11 5, ch12 1, ch13 3, ch14 4, ch15 3, ch16 4, ch17 24.

**Fix:** emit `chapter completed` on genuine completion, and separate `resumed` from `started` (or debounce repeats within a short window).

---

## 4. Identity breaks on reset

A user who finishes chapter 17 and resets starts a fresh run under a brand-new User ID, with no recorded link between the two. The dashboard patches this by hand — you type `replay=original` pairs (e.g. `2SZCGM=ELDVJ2`) into a text box in the filter bar.

24 users (13% of the 187 with chapter activity) have already reached chapter 17 and sit at that threshold. That is precisely the cohort whose repeat engagement is most worth measuring, and it is the cohort we currently cannot follow.

**Fix:** carry a stable install/device id alongside the per-run id, or emit a `reset` event naming the prior User ID.

---

## 5. Zero segmentation dimensions in the export

Seven columns, none carrying user context: no platform or OS, no app version, no timezone, no acquisition source, no notification or push interaction.

`User Registration Date` is clean — no user has conflicting values, and no event predates registration — but the median gap from registration to first event is 0.0 minutes, meaning it records first-open rather than acquisition. There is no signup-to-activation funnel to analyse.

The practical consequences: we cannot ask whether a given release improved anything, whether one platform retains better than another, or whether reminders drive return visits.

The habit analysis is also timezone-blind. "Same time of day" clustering assumes the timestamp reflects the user's local clock; for any user outside the recording zone that assumption silently fails.

**Fix:** add platform, app version and timezone to every row, and introduce a `notification` event category.

---

## Appendix — data quality items that are *fine*

Worth recording so they don't get re-litigated:

- **Resonance** looks healthy. Zeros concentrate in chapters 1–6 (57.4% at ch1, falling to 0% from ch7 onward), consistent with resonance genuinely building from zero rather than with missing data.
- **Registration dates** are internally consistent: no user carries more than one value, and no event is timestamped before its user's registration.
