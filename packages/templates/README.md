# @local-monorepo/ai-tools

AI Tools Layer - All related AI-powered tools for social media content generation.

## Overview

This layer contains all AI-related tools and their user interfaces for the social media scheduling platform.

### Features

- **Social Media Post Generation**: Auto-generate posts for social media based on user prompts or business details
- **Content Preview**: UI for previewing generated posts before publishing
- **Chat Interface**: Interactive chat interface for AI tools
- **Business Context Integration**: Uses business name, description, and user profile for personalized content

### Capabilities

- User can ask for a new social media post based on user prompt
- User can re-generate social media posts based on current content
- All posts are generated and formatted to be ready for social media
- Content includes properly formatted text + hashtags

## Setup

Make sure to install the dependencies:

```bash
pnpm install
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
