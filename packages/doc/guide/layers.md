# Project Layers

The MagicSync monorepo is organized into several distinct layers, each responsible for a specific part of the application.

## App Layer (`packages/app`)
The main Nuxt application. It handles the frontend user interface, routing, and client-side logic.
- **Framework**: Nuxt 4
- **UI Library**: Shadcn Vue, Tailwind CSS
- **State Management**: Pinia

## Server Layer (`packages/server`)
(Note: In this monorepo, server code might be integrated into the app or separate packages like `packages/db`, `packages/auth`, etc. Based on the structure, `packages/scheduler` contains server services.)

## Scheduler Layer (`packages/scheduler`)
Handles background jobs and scheduling for social media posts.
- **Core Functionality**: Scheduling posts, managing queues.
- **Plugins**: Platform-specific implementations (e.g., Twitter, LinkedIn).

## Documentation Layer (`packages/doc`)
This documentation site, built with VitePress.
- **Purpose**: Project documentation, guides, and API references.
