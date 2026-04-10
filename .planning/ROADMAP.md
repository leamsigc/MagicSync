# Roadmap: Knowledge Base Explorer

## Overview

This roadmap delivers a Claude Code-inspired exploration layer for the existing RAG application. Starting with folder schema and APIs, then document-folder integration, followed by the ingestion UI, and finally building out the suite of KB exploration tools (ls, tree, grep, glob, read) culminating in an explorer sub-agent that orchestrates them all. The agent will be able to navigate, search, and read a hierarchical knowledge base just like Claude Code explores codebases.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Folder Schema & Core APIs** - Database foundation for nested folders with global/per-user support and CRUD endpoints
- [ ] **Phase 2: Document-Folder Integration** - Connect documents to folders, store full markdown, enable file and folder moves
- [ ] **Phase 3: Ingestion UI** - Folder tree visualization with CRUD controls and folder-targeted uploads
- [ ] **Phase 4: Navigation Tools** - ls and tree tools for browsing folder structure
- [ ] **Phase 5: Search Tools** - grep and glob tools for content and filename searching
- [ ] **Phase 6: Read Tool** - Full document and line-range reading capability
- [ ] **Phase 7: Explorer Sub-Agent** - Orchestration agent with access to all KB tools

## Phase Details

### Phase 1: Folder Schema & Core APIs
**Goal**: Users and agents have a folder structure to organize documents into
**Depends on**: Nothing (first phase)
**Requirements**: FOLDER-01, FOLDER-02, FOLDER-03, FOLDER-05
**Success Criteria** (what must be TRUE):
  1. User can create a folder at any nesting depth via API
  2. User can rename an existing folder via API
  3. User can delete a folder (and its contents cascade delete) via API
  4. Global folders are visible to all users; per-user folders are private to their owner
  5. RLS policies enforce folder visibility rules
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Database schema: folders table with adjacency list, RLS policies
- [x] 01-02-PLAN.md — FastAPI CRUD endpoints for folder management

### Phase 2: Document-Folder Integration
**Goal**: Documents live inside folders and can be moved around; full markdown stored for grep/read
**Depends on**: Phase 1
**Requirements**: FOLDER-04, DOC-01, DOC-02, DOC-03
**Success Criteria** (what must be TRUE):
  1. User can upload a file into a specific folder (API accepts folder_id)
  2. User can move a document from one folder to another via API
  3. User can move a folder (with all contents) to a different parent via API
  4. Full extracted markdown is stored alongside chunks for each document
**Plans**: 4 plans

Plans:
- [ ] 02-01-PLAN.md — Database schema: folder_id column, full_markdown column, cycle prevention trigger
- [ ] 02-02-PLAN.md — Upload endpoint modification with folder targeting
- [ ] 02-03-PLAN.md — Ingestion service stores full markdown during processing
- [ ] 02-04-PLAN.md — Move endpoints for documents and folders

### Phase 3: Ingestion UI
**Goal**: Users can visually manage their folder hierarchy and upload files to specific folders
**Depends on**: Phase 2
**Requirements**: UI-01, UI-02, UI-03, UI-04
**Success Criteria** (what must be TRUE):
  1. Ingestion interface displays a navigable folder tree
  2. Global folders are visually distinguished from per-user folders (icon, color, or label)
  3. User can create, rename, and delete folders directly from the UI
  4. File upload targets the currently selected folder
**Plans**: 3 plans

Plans:
- [ ] 03-01-PLAN.md — Foundation: shadcn UI components, Folder type, and API functions
- [ ] 03-02-PLAN.md — Folder tree components: FolderTree, FolderNode, context menu, inline edit
- [ ] 03-03-PLAN.md — Integration: DocumentUpload with folder targeting, DocumentsPage layout

### Phase 4: Navigation Tools
**Goal**: Agent can browse the folder structure like a filesystem
**Depends on**: Phase 1 (folder schema)
**Requirements**: TOOL-01, TOOL-02
**Success Criteria** (what must be TRUE):
  1. Agent can call ls(path) and receive a list of files and subfolders in that path
  2. Agent can call tree(path, depth, limit) and receive hierarchical structure with truncation
  3. Tool outputs respect RLS (users only see their folders + global)
**Plans**: 2 plans

Plans:
- [ ] 04-01-PLAN.md — Database function and Python service for ls/tree navigation
- [ ] 04-02-PLAN.md — Tool definitions and executor integration for agent access

### Phase 5: Search Tools
**Goal**: Agent can search for documents by content patterns and filename patterns
**Depends on**: Phase 2 (full markdown stored), Phase 4 (folder schema)
**Requirements**: TOOL-03, TOOL-04
**Success Criteria** (what must be TRUE):
  1. Agent can call grep(pattern, path?) and receive matching document names
  2. Agent can call glob(pattern) and receive documents matching filename pattern
  3. grep searches the full extracted markdown content, not raw files
  4. glob supports patterns like *.pdf and reports/**/*
**Plans**: 2 plans

Plans:
- [ ] 05-01-PLAN.md — grep and glob backend service functions
- [ ] 05-02-PLAN.md — Tool definitions and executor integration for agent access

### Phase 6: Read Tool
**Goal**: Agent can read document content in full or by line range
**Depends on**: Phase 2 (full markdown stored)
**Requirements**: TOOL-05, TOOL-06
**Success Criteria** (what must be TRUE):
  1. Agent can call read(document_id) and receive full document markdown
  2. Agent can call read(document_id, start_line, end_line) and receive specific lines
  3. Line numbers are based on newline splits in the extracted markdown
**Plans**: 2 plans

Plans:
- [ ] 06-01-PLAN.md — Backend execute_read function in folder_navigation.py
- [ ] 06-02-PLAN.md — Tool definition and executor integration for agent access

### Phase 7: Explorer Sub-Agent
**Goal**: A sub-agent that orchestrates KB exploration for complex research tasks
**Depends on**: Phase 4, Phase 5, Phase 6 (all KB tools)
**Requirements**: AGENT-01, AGENT-02, AGENT-03
**Success Criteria** (what must be TRUE):
  1. Explorer sub-agent has access to ls, tree, grep, glob, and read tools
  2. Explorer sub-agent can invoke the existing document analysis sub-agent for deep analysis
  3. Explorer sub-agent returns synthesized findings, not raw tool output
  4. Main agent can delegate KB exploration tasks to explorer sub-agent
**Plans**: 3 plans

Plans:
- [ ] 07-01-PLAN.md — Explorer agent service with internal tool loop and streaming events
- [ ] 07-02-PLAN.md — Tool definition and executor integration for main agent access
- [ ] 07-03-PLAN.md — Gap closure: Chat router handling for explorer events

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Folder Schema & Core APIs | 0/2 | Not started | - |
| 2. Document-Folder Integration | 0/4 | Not started | - |
| 3. Ingestion UI | 0/3 | Not started | - |
| 4. Navigation Tools | 0/2 | Not started | - |
| 5. Search Tools | 0/2 | Not started | - |
| 6. Read Tool | 0/2 | Not started | - |
| 7. Explorer Sub-Agent | 0/3 | Not started | - |

---
*Roadmap created: 2026-02-04*
*Depth: standard (7 phases)*
*Coverage: 21/21 v1 requirements mapped*
