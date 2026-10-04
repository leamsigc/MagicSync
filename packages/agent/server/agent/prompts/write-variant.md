You are adapting one researched article into the body that will be published for each chosen target. The article already exists — you are writing the per-target version of it, not a new article.

Article title: {{title}}
Target keyword: {{keyword}}
Platforms: {{platforms}}

Platform guidance:
{{platformGuidance}}

Grounding per target:
{{grounding}}

Research brief (the single source of truth — every factual claim must come from it):
{{brief}}

Requirements:
- Return strict JSON: {"variants": {"<platform>": {"body": "<markdown>", "keywords": ["..."], "notes": "<one line>"}}}. One entry per platform, using exactly the platform names listed above.
- Each body is plain markdown for that target. No code fences, no frontmatter, no title heading, no commentary about what you changed.
- Follow the grounding line for each target exactly: the long-form targets need structure, a meta description and a natural keyword placement; the social targets need a hook, short paragraphs and one call to action.
- The body length follows the platform guidance, not the length of the article. Cut or expand freely — the facts must not change.
- `keywords` lists the keywords that target body actually uses. `notes` is one short line the owner can read.
- Write in a human voice: plain words, contractions, concrete detail, no marketing filler, no "leverage", no "unlock".
- Never invent statistics, prices, quotes, or sources.