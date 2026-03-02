# Growth Strategy & Content Pipeline

A complete AI-powered system for planning, scripting, recording, and publishing your social media content.

## Overview

The Growth Strategy tools are part of the `@local-monorepo/ai-tools` layer and are accessible under `/app/ai-tools/growth-stratergy/`. They provide a structured workflow to grow your audience consistently and measure what works.

---

## Pages

### Growth Strategy Dashboard

**Route:** `/app/ai-tools/growth-stratergy`

Three tabs rendered using Comark (MDC):

| Tab | Content |
|-----|---------|
| 🎯 Next Steps | Today / This Week / This Month interactive checklists |
| 🔥 Key Principles | 5 core growth rules always visible |
| 📅 Action Plan | Editable 7 / 30 / 90-day plans |

**Action Plan editing:**
1. Click **Edit** on any section (7 Days, 30 Days, 90 Days)
2. Modify the markdown in the textarea
3. Click **Save** — changes persist to `localStorage`
4. Click **Reset to default** to restore the original plan

---

### Content Pipeline

**Route:** `/app/ai-tools/growth-stratergy/create`

#### Step 1 — Script & Hook

1. Fill in the **Idea Bank** with brainstormed topics
2. Enter a **Topic / Keyword** (e.g., "Nuxt 3 performance tips")
3. Select a **Hook Variation**:

| Hook | Template | Avg. Win Rate |
|------|----------|---------------|
| The Negative Hook | Stop doing [X] if you want [Y] | 82% |
| The Curiosity Gap | I tried [X] for 30 days and... | 75% |
| The Contrarian | Why [X] is actually terrible for you | 88% |
| The Listicle | 3 reasons why your [X] is failing | 68% |

4. Add a **Custom Hook** using the `+ Custom Hook` button
5. Write your **Script Content** — the selected hook template is pre-filled

#### AI Hook Health Check

Click **Check Hook Health** (requires `GEMINI_API_KEY` in `.env`):

- **Overall Score**: 0–100 composite health score
- **Metrics**:
  - Hook Strength
  - Topic Relevance
  - Estimated Retention (>90% is the goal)
- **Analysis**: Written feedback on script quality
- **Suggested Adjustments**: Bullet points to improve
- **AI Improved Script**: Rewritten version applying all adjustments — click **Accept & Replace Script**
- **Alternative Hooks**: Top 3 other hook types with predicted retention — click **Use This Version**

#### Step 2 — Record (Teleprompter)

1. Select **Aspect Ratio**: 16:9 (YouTube), 9:16 (TikTok/Reels), 1:1 (Instagram)
2. Click **Enter Focus Mode** — activates camera via `getUserMedia`
3. In focus mode:
   - The teleprompter shows ~8 words per line, with the current word highlighted
   - Use **↑ / ↓** to navigate lines manually
   - Drag the **Speed** slider (0.5× to 2.5×) to set auto-scroll pace
   - Click ▶ / ⏸ to toggle auto-scroll (only active while recording)
4. Click **Start Recording** — timer begins, auto-scroll starts
5. Click **Stop Recording** — video preview appears below

#### Step 3 — Edit Checklist

Before publishing, verify:

- [ ] Hook: Is the first 3 seconds engaging?
- [ ] Value: Did I deliver on the hook's promise?
- [ ] Call to Action: Is there a clear next step?

#### Step 4 — Upload

- Paste the **Video URL** after uploading to YouTube/TikTok/etc.
- Click **Mark as Published**

---

### Data Analytics

**Route:** `/app/ai-tools/growth-stratergy/data`

Input your latest post stats to get a live diagnostic:

| Input | Threshold | Diagnosis |
|-------|-----------|-----------|
| CTR (%) | < 2% | `LOW CTR` → Change thumbnail |
| Watch Time (%) | < 30% | `LOW RETENTION` → Cut intro |
| Engagement Rate (%) | < 1% | `LOW ENGAGEMENT` → Reply to comments |
| All above thresholds | — | `ON TRACK` → Repurpose content |

---

## Composables

### `useGrowthStrategy`

Manages action plan state with persistence.

```ts
const {
  actionPlan,        // { day7, day30, day90 } — markdown strings
  editingSection,    // ref<'day7' | 'day30' | 'day90' | null>
  editBuffer,        // ref<string> — current edit content
  startEditing,      // (section) => void
  saveEditing,       // () => void — saves to localStorage
  cancelEditing,     // () => void
  resetSection,      // (section) => void — resets to default
} = useGrowthStrategy()
```

### `useContentPipeline`

All reactive UI state for the create page.

```ts
const {
  ideas, topic, hooks, selectedHook, scriptContent,
  isAddingHook, newHook,
  hookHealth, aspectRatio, isFocusMode, isRecording,
  previewUrl, timer, currentWordIndex, isAutoScroll, speedMultiplier,
  editChecklist, videoUrl, words, lines,
  handleHookSelect, handleAddCustomHook, acceptImprovedScript,
} = useContentPipeline()
```

### `useContentPipelineManagement`

API calls with toast notifications.

```ts
const {
  isCheckingHealth, isSaving, isPublishing,
  checkHookHealth,   // async (topic, hook, hooks, script) => HookHealthResult | null
  saveDraft,         // async ({ topic, script, hook, ideas }) => void
  markAsPublished,   // async (videoUrl) => void
} = useContentPipelineManagement()
```

---

## Server API

### `POST /api/v1/growth-strategy/hook-health`

Analyzes a script against a hook using Gemini 2.0 Flash.

**Request body:**
```ts
{
  topic: string        // Content topic/keyword
  hookName: string     // Selected hook name
  hooks: { name: string, template: string }[]  // All available hooks
  script: string       // Full script content
}
```

**Response:**
```ts
{
  overallScore: number
  metrics: { hookStrength: number, relevance: number, retention: number }
  feedback: string
  adjustments: string[]
  improvedScript: string
  alternativeVersions: {
    hookName: string
    predictedRetention: number
    reasoning: string
    script: string
  }[]
}
```

### `GET /api/v1/growth-strategy`

Returns paginated list of saved drafts.

### `POST /api/v1/growth-strategy`

Saves a content draft.

**Request body:**
```ts
{
  topic: string
  script: string
  hook: string
  ideas?: string
}
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes (for AI) | Google Gemini API key |
