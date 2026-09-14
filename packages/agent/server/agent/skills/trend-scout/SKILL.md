---
name: trend-scout
description: Find current, publishable content angles grounded in this business's best-performing posts and live web signals. Use for trend scans, weekly idea batches, or when a calendar needs fresh angles tied to evidence.
version: 1.0.0
tools: scan_trends, web_search, board_add_cards
---

# Trend Scout

An angle is only useful when it names the signal it came from. Never propose a
trend you cannot point to.

## Steps

1. Call `scan_trends` to rank this business's best-performing posts. Read the
   top entries: platform, content, engagement rate.
2. Search the web with `web_search` for what is currently moving in the niche.
   Prefer the last 7-30 days (`freshness: oneWeek` or `oneMonth`).
3. For each candidate angle, deconstruct the signal:
   - Hook shape (question, contrarian, data, story, how-to).
   - Why it worked: emotion, specificity, timing, format.
   - How this business can credibly take it: proof it already owns.
4. Keep 3-8 angles. Reject anything with no proof, no freshness, or no audience
   fit. One angle per card.
5. Add them with `board_add_cards` (`sourceType: "trend"`, state `idea`) and
   include the originating signal in the brief.

Done when: every card's brief names its signal (post id or source URL) and the
proposed format; nothing was scheduled or published.

## Deconstruction checklist

- Hook: what made the first line stop the scroll?
- Structure: hook -> tension -> proof -> takeaway?
- Proof: what concrete evidence is available to this business?
- Timing: why now; what date or event makes it current?
- Fit: does it sound like this brand, or like a trend-chaser?
