---
name: social-research
description: Investigate a topic against primary sources and produce a cited evidence brief. Use when a claim needs facts, numbers, or proof before writing.
version: 1.0.0
tools: web_search, scrape_url, retrieve
---

# Social Research

Produce evidence, not prose. A writer with no context should be able to use your
brief without re-reading anything you read.

## Steps

1. Frame the question: what decision or post does this research support? Write
   the one-sentence question before searching.
2. Search with `web_search` using 2-4 focused queries. Prefer first-party
   sources (official docs, publications, statistics agencies) over write-ups.
3. Read the two or three best sources with `scrape_url` when snippets are thin.
4. Check the business knowledge base with `retrieve` when internal context
   (offer, audience, past content) is relevant.
5. Capture, per finding: the claim, the source URL, the publication date, and a
   confidence note (verified / single-source / contested).
6. Note contradictions explicitly instead of averaging them away.

Done when: every key fact has a source URL; contested points are labeled; and
anything you could not verify is listed as unknown rather than omitted.

## Evidence rules

- Never invent a URL, quote, statistic, or study. An empty citation list beats a
  fabricated one.
- Separate source statements from inference. Mark inference as inference.
- Prefer sources from the last 12 months for platform, market, and trend claims;
  always record the date.
- If search is unavailable, say which parts are memory-based and unverified.

## Output contract

Return the brief the caller asked for, with a `citations` array of
`{ label, url }` entries and a `keyFacts` list of short verifiable assertions.
