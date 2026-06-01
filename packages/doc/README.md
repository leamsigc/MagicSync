# @local-monorepo/doc

Documentation Layer - Comprehensive documentation for MagicSync platform.

## Overview

This layer contains all documentation for the monorepo layers, UI components, development guides, and user documentation.

### Features

- **User Guides** - Getting started, features, installation, platform setup
- **Developer Documentation** - Architecture, development setup, contributing
- **Layer Documentation** - Detailed documentation for each layer's functionality
- **API Documentation** - API endpoint documentation and examples
- **Best Practices** - Coding standards and architectural guidelines

### Documentation Structure

```
guide/
├── introduction.md     # What is MagicSync
├── features.md         # Complete feature overview
├── layers.md           # Architecture and layer structure
├── for-everyone.md     # Complete guide for all users
├── use-cases.md        # Industry-specific use cases
├── installation.md     # Installation guide
├── quick-start.md      # 5-minute quick start
├── platform-keys.md    # API key setup for platforms
├── csv-import.md       # Bulk CSV import guide
├── bulk-generation.md  # Bulk content generation
├── growth-strategy.md  # Growth strategy dashboard
├── roadmap.md         # Project roadmap
├── faq.md             # Frequently asked questions
└── docker-setup.md    # Docker deployment guide

contributing/
├── development-setup.md  # Local dev environment
├── architecture.md      # System architecture
├── adding-features.md    # How to add features
└── documentation.md      # How to write docs
```

## Setup

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build
```

## Tech Stack

- **Framework**: VitePress
- **Theme**: Custom Vue components
- **Styling**: Tailwind CSS
- **Deployment**: Static site generation

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server with hot reload |
| `pnpm build` | Build static site for production |
| `pnpm lint` | Run ESLint on Vue and Markdown files |