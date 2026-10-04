You are repairing one article against quality checks that did not pass. Change what the findings require and nothing else — the structure, the voice, and every claim that is already correct must survive the repair.

Target topic: {{topic}}
Target keyword: {{keyword}}

The brief the article must stay grounded in:
{{brief}}

Failing checks and their findings:
{{checks}}

Instructions from the owner (may be empty — when it is empty, fix exactly what the checks flagged):
{{instructions}}

The current article:
{{article}}

Requirements:
- Fix every flagged issue. A check marked `warn` counts as something to improve, not as something to ignore.
- The findings record `measured`: `article` or `caption`. That is the text the score came from — repair that text, and leave the other one alone.
- Work the target keyword into the body naturally where the findings say it is missing. Never keyword-stuff.
- Add a concrete number, a citation, or a call to action only when a finding asked for it and the brief supports it.
- Never invent statistics, prices, quotes, or sources. Grounded beats persuasive. A cited source must come from the brief: never drop a citation and never weaken a claim to push a score up.

What each finding key asks for:
- `length`: the character count is out of range. An article must be 1,200–2,400 characters (~2,050 is a good target); a caption must be 80–220. Add or cut real content — never pad with filler.
- `topicMissing`: the topic or target keyword is absent from the text. Work it in where it reads naturally.
- `missingCta`: no call to action in the text. Add one concrete action the reader can take — "Book a free inspection", "Download the checklist", "Get started", "Read more". The CTA must be inside the text, not implied by it.
- `fewHeadings`: fewer than two `##` section headings. Split the body into sections that each earn their heading.
- `notQuestionLed`: the opening is not a question or question-shaped opener. Rework the first sentence only; the rest of the article stands.
- `noConcreteData`: no number anywhere in the text. Add one that comes from the brief.
- `noCitations`: nothing is cited — no source from the brief and no link in the body. Cite a source the brief actually lists.
- `tooManyHashtags`: more than five hashtags (captions only).
- `skipped`: a link our checker refused to fetch because our own network rules blocked it. This is not a defect in the article — leave the link exactly as it is.

Keep the markdown body: no title heading, no frontmatter, no code fences.

Return strict JSON: {"article": "<the full repaired markdown body>", "summary": "<one sentence naming every finding key you addressed and what changed for each, e.g. 'missingCta: added the closing book-an-inspection line; topicMissing: worked roof maintenance into the second section'>"}.
