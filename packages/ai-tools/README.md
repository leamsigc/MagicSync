# @local-monorepo/ai-tools

AI Tools Layer — AI-powered growth strategy and content pipeline tools for social media content generation.

## Overview

This layer contains all AI-related tools and their user interfaces for the social media scheduling platform. It is consumed as a **Nuxt layer** by the main site package.

---

## Features

### 🎯 Growth Strategy (`/app/ai-tools/growth-stratergy`)

A tabbed dashboard to plan and track your social media growth roadmap.

| Tab | Description |
|-----|-------------|
| **Next Steps** | Today / This Week / This Month interactive checklists rendered via Comark MDC |
| **Key Principles** | 5 core rules for consistent growth |
| **Action Plan** | Editable 7 / 30 / 90-day markdown plans with `localStorage` persistence |

**Composable:** `useGrowthStrategy` — manages action plan state, editing (edit/save/cancel/reset per section), and `localStorage` persistence.

---

### 🚀 Content Pipeline (`/app/ai-tools/growth-stratergy/create`)

A full content production workflow from idea to published post.

**Step 1 — Script & Hook**
- Brainstorm ideas in the Idea Bank
- Select from 4 built-in hook variations (Negative, Curiosity Gap, Contrarian, Listicle) or add a custom hook
- Write/edit your script with the hook pre-filled as a template

**AI Hook Health Check**
- POST `/api/v1/growth-strategy/hook-health` — calls **Gemini 2.0 Flash** with structured JSON schema
- Returns: overall score, hook strength / topic relevance / retention metrics, feedback, suggested adjustments, improved script, and top 3 alternative hooks with predicted retention
- Accept improved script or use an alternative version with one click

**Step 2 — Record (Teleprompter)**
- Select aspect ratio: 16:9 / 9:16 / 1:1
- Enter **Focus Mode** — fullscreen overlay with camera feed (via `getUserMedia`)
- Large word-by-word teleprompter display with: speed slider (0.5×–2.5×), ↑↓ line navigation, auto-scroll
- Start/Stop recording via `MediaRecorder` — post-record video preview with clear option

**Step 3 — Edit Checklist**
- Hook, Value delivery, and CTA checkboxes

**Step 4 — Upload**
- Video URL input + "Mark as Published"

**Composables:**
- `useContentPipeline` — all reactive state (ideas, topic, hooks, script, recording, timer, teleprompter)
- `useContentPipelineManagement` — API calls with toast error/success handling

---

### 📊 Data Analytics (`/app/ai-tools/growth-stratergy/data`)

Algorithmic diagnostics for the latest published content.

- Input: Views, CTR (%), Watch Time (%), Engagement Rate (%)
- Output: Reactive diagnostic panel — `LOW CTR`, `LOW RETENTION`, `LOW ENGAGEMENT`, or `ON TRACK` with fast-action suggestions

---

### Social Media Post Generation

- **Post Generation**: Auto-generate posts for social media based on user prompts or business details
- **Content Preview**: UI for previewing generated posts before publishing
- **Chat Interface**: Interactive chat interface for AI tools
- **Business Context Integration**: Uses business name, description, and user profile for personalized content

---

## Server API Routes

All routes are under `/api/v1/growth-strategy/`:

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/v1/growth-strategy` | List saved drafts |
| `POST` | `/api/v1/growth-strategy` | Save draft (Zod validated) |
| `POST` | `/api/v1/growth-strategy/hook-health` | AI hook health check via Gemini (Zod validated) |

**Service:** `server/utils/growth-strategy.ts` — Gemini REST API integration, auto-imported by Nuxt.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes (for AI features) | Google Gemini API key for hook health analysis |

---

## File Structure

```
app/
├── composables/
│   ├── useGrowthStrategy.ts            # Action plan state + localStorage
│   ├── useContentPipeline.ts           # Content pipeline reactive state
│   └── useContentPipelineManagement.ts # API calls + toast handling
└── pages/app/ai-tools/
    └── growth-stratergy/
        ├── index.vue        # Growth Strategy (3 Comark tabs)
        ├── index.json       # Translations
        ├── create.vue       # Content Pipeline
        ├── create.json      # Translations
        ├── data.vue         # Data analytics
        └── data.json        # Translations

server/
├── api/v1/growth-strategy/
│   ├── index.ts             # GET  — list drafts
│   ├── index.post.ts        # POST — save draft
│   └── hook-health.post.ts  # POST — AI analysis
└── utils/
    └── growth-strategy.ts   # Gemini service (auto-imported)
```

---

## Setup

Make sure to install the dependencies:

```bash
pnpm install
```

Add the required environment variable to `.env`:

```env
GEMINI_API_KEY=your_google_gemini_api_key
```

## Development

Start the development server:

```bash
pnpm dev
```

## Scripts

- `pnpm dev` - Start development server with playground
- `pnpm build` - Build the layer
- `pnpm lint` - Run ESLint
