# Scoring rubric

**This file is the authority.** Edit it to change how content is scored — the
`content-score` skill reads it, and nothing else hardcodes these numbers.

---

## SEO — 100 points for an article body

| Rule | Points | Finding key when missed |
|---|---|---|
| Body is 1,200–2,400 characters | 30 | `length` |
| The topic or the target keyword appears in the body | 30 | `topicMissing` |
| A call to action appears inside the body | 20 | `missingCta` |
| At least two `##` section headings | 20 | `fewHeadings` |

**Target length is ~2,050 characters** — a solid, complete article. Anything in
the 1,200–2,400 band passes; below is thin, above is padded.

Bands: pass ≥ 75 · warn ≥ 50 · fail below.

### SEO — 100 points for a short social caption

Used only when the text is a caption rather than an article body.

| Rule | Points | Finding key when missed |
|---|---|---|
| 80–220 characters | 30 | `length` |
| Has a call to action | 20 | `missingCta` |
| Five or fewer hashtags | 20 | `tooManyHashtags` |
| The topic or keyword appears | 30 | `topicMissing` |

---

## GEO — 100 points

GEO asks whether a retrieval-augmented answer engine could quote the piece
usefully. Same rules for an article and a caption.

| Rule | Points | Finding key when missed |
|---|---|---|
| Opens by answering a question | 25 | `notQuestionLed` |
| Contains at least one concrete number | 25 | `noConcreteData` |
| Contains something the reader could follow | 25 | `noCitations` |
| Contains a call to action | 25 | `missingCta` |

Bands: pass ≥ 70 · warn ≥ 45 · fail below.

**A question-led opening** means the first sentence poses or answers a question:
it ends in `?`, or it starts with how / what / why / when / which / who /
where / can / should / is / are / do / does. A `##` heading marker does not
disqualify it — strip a leading `#` before judging.

**Something the reader could follow** is a URL in the body, **or** a source the
brief supplied. A `blocked` probe result still counts: the reader may well be
able to open it.

---

## Links — 100 points

The system probes every URL in the body before you are called and hands you the
results. You only apply the rule; you never fetch anything.

| `status` | Counts against the bar? |
|---|---|
| `ok` | no — reachable |
| `unreachable` | **yes** — the author's link is broken |
| `blocked` | **no** — our own safety probe refused it; not the author's defect |

| Situation | Score | Status |
|---|---|---|
| No URLs in the body at all | 100 | pass |
| Every checkable URL `ok` | 100 | pass |
| Some checkable URLs `unreachable` | proportion reachable, ×100 | warn if any reachable, fail if none |
| Nothing checkable (all `blocked`) | 100 | pass |

Report the `unreachable` URLs under `unreachableUrls`. List `blocked` URLs in
`notes` so they stay visible without being scored.

---

## Editing this rubric

1. Change the point values or bands here.
2. Add or rename a finding key here **and** in `../SKILL.md` — the repair step
   reads keys from the SKILL and you do not want the two to drift.
3. Re-score happens on the next write or the next "Fix based on checks"; nothing
   is cached.
