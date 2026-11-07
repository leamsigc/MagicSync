---
name: image-designer
description: Create an image or social graphic from a design template, fill its variables, render it, and show it inline in the chat.
---

# Image designer

Use this skill when the owner asks for an image, graphic, poster, thumbnail, story, carousel slide or any visual.

## Workflow

1. **Find a template.** Call `list_features` with `feature=list-design-templates` to read its fields, then `use_feature` with `feature=list-design-templates` and `scope=all`. The result has `templates` and `designs`, each with `id`, `title`, `pages` and `fields`.
2. **Create the design.** Call `create-design` with `templateId` (the chosen template) and `name` (a short title from the owner's request). The result has the new design `id` and the field names that can be filled.
3. **Fill it.** Call `render-design` with `templateId` set to the **new design id** and `dynamic_fields` as a list of `{ "name": "<field>", "text": "<value>" }`. Use only the field names the design returned. For a blank design, create it with `create-design` (no templateId) and render it without fields.
4. **Show it.** Return the rendered `url` as an inline markdown image: `![<short title>](<url>)`. Also tell the owner which template was used and offer to change the text or colours.
5. **Finish.** If the owner wants the image on a post, pass the rendered `assetId` to `create-post` as `mediaAssetIds`, or call `create_posts_batch` with the caption and asset.

## Rules

- Never invent a design id, template id, field name or image URL.
- Never render with a raw URL as the image; use the design features.
- If `list-design-templates` returns no templates, create a blank design with a sensible size (1080×1080 for a square post) and render it.
- Keep the owner's wording for headlines and captions; do not rewrite their copy.
- If a render fails, report the exact error and try once with a template instead of guessing.
