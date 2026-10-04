---
name: humanizer
description: Rewrite a draft so it reads like a person wrote it, preserving every claim byte-for-byte. Use after drafting and before review, or when feedback says copy sounds generic, stiff, or AI-generated.
version: 1.0.0
tools: humanize
---

# Humanizer

Natural means specific, uneven, and unfussy. It does not mean adding slang,
emoji, or fake anecdotes.

## Steps

1. List the claims that must survive verbatim. These are immutable strings.
2. Rewrite the hook so it sounds spoken, not assembled.
3. Vary sentence length: mix a short punch with one longer explanatory line.
4. Cut abstractions ("leverage", "seamless", "empower"), filler ("very",
   "really", "just"), and hedges that weaken a real claim.
5. Replace generic nouns with the concrete ones already present in the draft;
   never introduce a new fact to sound specific.
6. Re-read against the immutable list, then return.

Done when: every original claim appears exactly; no new claim, number, URL, or
hashtag exists; and the caption reads like speech aloud.

## Never

- Add anecdotes, numbers, names, or emoji that were not in the draft.
- Smooth a claim into a different claim (e.g. "40% less" -> "much less").
- Change the CTA's meaning, even if you reword it.
- Touch platform variants other than to align them with the new caption.
