# Episode 2: Knowledge Base Explorer — Roadmap

## Overview

Delivers a Claude Code-inspired exploration layer for the existing RAG application. Starting with folder schema and APIs, then document-folder integration, followed by the ingestion UI, and finally building out the suite of KB exploration tools (ls, tree, grep, glob, read) culminating in an explorer sub-agent.

## Phases

- [ ] **Phase 1: Folder Schema & Core APIs** — Database foundation for nested folders with global/per-user support and CRUD endpoints
- [ ] **Phase 2: Document-Folder Integration** — Connect documents to folders, store full markdown, enable file and folder moves
- [ ] **Phase 3: Ingestion UI** — Folder tree visualization with CRUD controls and folder-targeted uploads
- [ ] **Phase 4: Navigation Tools** — `kb_ls` and `kb_tree` tools for browsing folder structure
- [ ] **Phase 5: Search Tools** — `kb_grep` and `kb_glob` tools for content and filename searching
- [ ] **Phase 6: Read Tool** — `kb_read` for full document and line-range reading
- [ ] **Phase 7: Explorer Sub-Agent** — Orchestration agent with access to all KB tools

## Phase Details

### Phase 1: Folder Schema & Core APIs
**Goal**: Users and agents have a folder structure to organize documents into
**Depends on**: Nothing (first phase)
**Requirements**: FOLDER-01, FOLDER-02, FOLDER-03, FOLDER-05
**Success Criteria**:
  1. User can create a folder at any nesting depth via API
  2. User can rename an existing folder via API
  3. User can delete a folder (and its contents cascade delete) via API
  4. Global folders are visible to all users; per-user folders are private
  5. All folder operations scoped by user_id for security

**Tasks**:
- [ ] TDD: Write tests for knowledge_folders CRUD service
- [ ] Create `knowledge_folders` Drizzle schema (id, userId, name, parentId, isGlobal, path, createdAt, updatedAt)
- [ ] Add adjacency list with self-referencing parentId
- [ ] Add path column for efficient subtree queries (materialized path pattern)
- [ ] Create `folderService` in `packages/db/server/services/`
- [ ] Create API routes in `packages/ai-tools/server/api/ai-tools/kb/folders/`
- [ ] Run tests, verify all pass

### Phase 2: Document-Folder Integration
**Goal**: Documents live inside folders and can be moved around; full markdown stored for grep/read
**Depends on**: Phase 1
**Requirements**: FOLDER-04, DOC-01, DOC-02, DOC-03
**Success Criteria**:
  1. User can upload a file into a specific folder (API accepts folder_id)
  2. User can move a document from one folder to another via API
  3. User can move a folder (with all contents) to a different parent via API
  4. Full extracted markdown is stored alongside chunks for each document

**Tasks**:
- [ ] TDD: Write tests for folder_id on documents, move operations
- [ ] Add nullable `folderId` column to documents table (migration)
- [ ] Add `fullMarkdown` column to documents table for grep/read
- [ ] Update upload endpoint to accept folder_id
- [ ] Create move endpoints for documents and folders
- [ ] Update ingestion pipeline to store full extracted markdown
- [ ] Run tests, verify all pass

### Phase 3: Ingestion UI
**Goal**: Users can visually manage their folder hierarchy and upload files to specific folders
**Depends on**: Phase 2
**Requirements**: UI-01, UI-02, UI-03, UI-04
**Success Criteria**:
  1. Knowledge base page displays a navigable folder tree
  2. Global folders are visually distinguished from per-user folders
  3. User can create, rename, and delete folders directly from the UI
  4. File upload targets the currently selected folder

**Tasks**:
- [ ] TDD: Write component tests for folder tree
- [ ] Create `FolderTree.vue` component (recursive tree rendering)
- [ ] Create `FolderNode.vue` component (individual folder with expand/collapse, context menu)
- [ ] Create folder CRUD UI (create dialog, rename inline, delete confirmation)
- [ ] Update document upload to pass folder_id
- [ ] Create KB page at `packages/ai-tools/app/pages/app/ai-tools/knowledge/`
- [ ] Run tests, verify all pass

### Phase 4: Navigation Tools
**Goal**: Agent can browse the folder structure like a filesystem
**Depends on**: Phase 1
**Requirements**: TOOL-01, TOOL-02
**Success Criteria**:
  1. Agent can call `kb_ls(path)` and receive a list of files and subfolders
  2. Agent can call `kb_tree(path, depth, limit)` and receive hierarchical structure with truncation
  3. Tool outputs respect user scoping

**Tasks**:
- [ ] TDD: Write tests for kb_ls and kb_tree service functions
- [ ] Create `packages/python-backend/app/services/kb/navigation.py` with execute_ls, execute_tree
- [ ] Register kb_ls and kb_tree as agent tools in tool registry
- [ ] Create API endpoints for tool execution
- [ ] Run tests, verify all pass

### Phase 5: Search Tools
**Goal**: Agent can search for documents by content patterns and filename patterns
**Depends on**: Phase 2 (full markdown stored), Phase 4
**Requirements**: TOOL-03, TOOL-04
**Success Criteria**:
  1. Agent can call `kb_grep(pattern, path?)` and receive matching document names
  2. Agent can call `kb_glob(pattern)` and receive documents matching filename pattern
  3. grep searches the full extracted markdown content
  4. glob supports patterns like `*.pdf` and `reports/**/*`

**Tasks**:
- [ ] TDD: Write tests for kb_grep and kb_glob
- [ ] Implement grep using FTS5 (existing infrastructure from Module 6) or regex on fullMarkdown
- [ ] Implement glob using filename pattern matching
- [ ] Register kb_grep and kb_glob as agent tools
- [ ] Run tests, verify all pass

### Phase 6: Read Tool
**Goal**: Agent can read document content in full or by line range
**Depends on**: Phase 2 (full markdown stored)
**Requirements**: TOOL-05, TOOL-06
**Success Criteria**:
  1. Agent can call `kb_read(document_id)` and receive full document markdown
  2. Agent can call `kb_read(document_id, start_line, end_line)` and receive specific lines
  3. Line numbers are based on newline splits in the extracted markdown

**Tasks**:
- [ ] TDD: Write tests for kb_read with full and line-range modes
- [ ] Implement execute_read in navigation.py
- [ ] Register kb_read as agent tool
- [ ] Run tests, verify all pass

### Phase 7: Explorer Sub-Agent
**Goal**: A sub-agent that orchestrates KB exploration for complex research tasks
**Depends on**: Phase 4, 5, 6 (all KB tools)
**Requirements**: AGENT-01, AGENT-02, AGENT-03
**Success Criteria**:
  1. Explorer sub-agent has access to ls, tree, grep, glob, and read tools
  2. Explorer sub-agent can invoke the existing sub-agent system for deep analysis
  3. Explorer sub-agent returns synthesized findings, not raw tool output
  4. Main agent can delegate KB exploration tasks to explorer sub-agent

**Tasks**:
- [ ] TDD: Write tests for explorer agent service
- [ ] Create ExplorerAgent class in Python backend with internal tool loop
- [ ] Register explorer as a sub-agent type in the orchestrator
- [ ] Wire explorer events into the SSE stream
- [ ] Run tests, verify all pass

## Progress

| Phase | Tasks Complete | Status |
|-------|---------------|--------|
| 1. Folder Schema & APIs | 0/7 | Not started |
| 2. Document-Folder Integration | 0/7 | Not started |
| 3. Ingestion UI | 0/6 | Not started |
| 4. Navigation Tools | 0/5 | Not started |
| 5. Search Tools | 0/5 | Not started |
| 6. Read Tool | 0/4 | Not started |
| 7. Explorer Sub-Agent | 0/5 | Not started |

---
*Roadmap created: 2026-03-31*
