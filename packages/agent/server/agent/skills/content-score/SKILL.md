---
name: content-score
description: Score one written article against the SEO, GEO and link quality bars and report what is failing. Use after writing or repairing an article so the owner can see exactly what to fix next.
version: 1.0.0
---

# Content Scoring

You score ONE piece of written content against three bars — **SEO**, **GEO**
(generative engine optimisation) and **links** — and report which specific
findings are failing.

You are given the article body, the research brief it must stay grounded in,
the target topic, the target keyword, and the **link probe results** (already
measured by the system). You do not fetch anything yourself. Never invent a
score: if you cannot judge a rule from the text in front of you, mark that
finding as failing rather than guessing.

The full point tables live in `references/scoring-rubric.md`. **Read it before
scoring** — it is the authority, not your own idea of what good SEO is.

## What you are given

| Input | What it is |
|---|---|
| `text` | the exact body to score. Nothing else counts |
| `brief` | the research the article must stay grounded in |
| `topic` | the subject the piece is about |
| `keyword` | the term the owner is targeting; may be empty |
| `linkProbes` | each URL with `status` = `ok` \| `unreachable` \| `blocked` |

## The one thing that matters most

**`text` is the article body.** Score the text you were given. Do not score a
caption, a title, a summary, or the brief. If the text you were handed is a
caption rather than an article, say so in `notes` and score it as a caption.

## Rules you must not bend

- **`blocked` links are not defects.** A URL marked `blocked` was refused by
  the system's own safety probe — the author did nothing wrong. Never report it
  as a link finding and never lower the link score for it. Only `unreachable`
  URLs count against the bar.
- **A link the reader can follow is a citation** for GEO purposes, whether or
  not the probe could fetch it. A `blocked` URL still counts as cited.
- **A call to action must be inside the body text.** A CTA that lives in a
  separate field does not count. Look for an imperative invitation near the end:
  a request to call, book, read, check, subscribe, or try something.
- **Never rewrite the article.** You score. The repair is a separate step that
  receives your findings.

## Status bands

`score` is the sum of the earned points, 0–100.

| Bar | pass | warn | fail |
|---|---|---|---|
| SEO | ≥ 75 | ≥ 50 | below |
| GEO | ≥ 70 | ≥ 45 | below |
| links | all checkable URLs reachable | some | none reachable |

## Finding keys — use these exact strings

The repair step reads these, so a key you invent is a problem your reader cannot
fix. Use only these:

| Bar | Key | Means |
|---|---|---|
| SEO | `length` | body outside the target range (always report the actual length) |
| SEO | `topicMissing` | the topic or keyword never appears in the body |
| SEO | `missingCta` | no call to action inside the body |
| SEO | `fewHeadings` | fewer than the required number of `##` headings |
| GEO | `notQuestionLed` | the opening does not answer a question |
| GEO | `noConcreteData` | no number anywhere in the body |
| GEO | `noCitations` | nothing the reader could follow |
| GEO | `missingCta` | no call to action inside the body |
| links | `unreachableUrls` | URLs the probe could not reach |

## Output

Return **strict JSON only** — no prose, no code fences:

```json
{
  "seo":   { "score": 0, "status": "pass|warn|fail", "findings": { "key": "value" } },
  "geo":   { "score": 0, "status": "pass|warn|fail", "findings": { "key": "value" } },
  "links": { "score": 0, "status": "pass|warn|fail", "findings": { "unreachableUrls": [] } },
  "notes": "one sentence, only if something about the input surprised you"
}
```

`findings` is an object of **only the keys that failed**. A bar with no failing
keys has `findings: {}`. Never list a key that passed. `length` is the one
exception: report the actual character count on every article, pass or fail, so
the owner can see the number.
