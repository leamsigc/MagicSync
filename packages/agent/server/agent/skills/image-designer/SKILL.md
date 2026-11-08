---
name: image-designer
description: Create an image or social graphic from a design template, fill its variables, render it, and show it inline in the chat.
---

# Image designer

Use this skill when the owner asks for an image, graphic, poster, thumbnail, story, carousel slide or any visual.

## Workflow

1. **Find a template.** Call `list_features` with `feature=list-design-templates` to read its fields, then `use_feature` with `feature=list-design-templates` and `scope=public` (or `scope=mine`). The result has `data`, each entry with `id`, `title`, `fields`, `pages` and `thumbnails`.
2. **Make it editable.** Call `use_feature` with `feature=duplicate-design-template` and the template `templateId` plus a short `title`. The result is a new design owned by the user; use its `id` as the render template.
3. **Fill it.** Call `render-design-batch` with that design `id` as `templateId` and `rows` as a list of objects using the template field names (`title`, `content`, or the names returned in `fields`). Each row produces one stored image.
4. **Show it.** Return each rendered `url` as an inline markdown image: `![<short title>](<url>)`. Name the template used and offer to change the text or colours.
5. **Finish.** To put an image on a post, pass its `assetId` to `create-post` as `mediaAssetIds`, or include it in a `plan_week_posts` preview.

## Rules

- Never invent a design id, template id, field name or image URL.
- Never render with a raw URL as the image; use the design features.
- If `list-design-templates` returns no templates, tell the owner to publish one first.
- Keep the owner's wording for headlines and captions; do not rewrite their copy.
- If a render fails, report the exact error and try once with a different template instead of guessing.
