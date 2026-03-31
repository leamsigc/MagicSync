# Episode 2: Knowledge Base Explorer — Requirements

**Defined:** 2026-03-31
**Core Value:** The agent can explore the knowledge base the same way Claude Code explores codebases

## v1 Requirements

### Folder Structure

- [ ] **FOLDER-01**: User can create folders with unlimited nesting depth
- [ ] **FOLDER-02**: User can rename existing folders
- [ ] **FOLDER-03**: User can delete folders (cascades to contents)
- [ ] **FOLDER-04**: User can move folders to a different parent folder
- [ ] **FOLDER-05**: System supports global folders (visible to all users) and per-user folders (private)

### Document Management

- [ ] **DOC-01**: User can upload files into a specific folder
- [ ] **DOC-02**: User can move files between folders
- [ ] **DOC-03**: System stores full extracted markdown alongside chunks for each document

### KB Exploration Tools

- [ ] **TOOL-01**: Agent can use `kb_ls(path)` to list files and subfolders in a folder
- [ ] **TOOL-02**: Agent can use `kb_tree(path, depth?, limit?)` to get hierarchical structure with depth limit and truncation
- [ ] **TOOL-03**: Agent can use `kb_grep(pattern, path?)` to regex search content, returns matching document names
- [ ] **TOOL-04**: Agent can use `kb_glob(pattern)` to match filenames by pattern (e.g., `*.pdf`, `reports/**/*`)
- [ ] **TOOL-05**: Agent can use `kb_read(document_id)` to read full document content
- [ ] **TOOL-06**: Agent can use `kb_read(document_id, start_line, end_line)` to read specific line range

### Explorer Sub-Agent

- [ ] **AGENT-01**: Explorer sub-agent has access to all KB tools (ls, tree, grep, glob, read)
- [ ] **AGENT-02**: Explorer sub-agent can invoke the existing sub-agent system for deep document analysis
- [ ] **AGENT-03**: Explorer sub-agent returns synthesized findings, not raw tool output

### Ingestion Interface

- [ ] **UI-01**: Knowledge base page displays folder tree with navigable hierarchy
- [ ] **UI-02**: Folder tree visually distinguishes global folders from per-user folders
- [ ] **UI-03**: User can create, rename, and delete folders via UI
- [ ] **UI-04**: File upload targets the currently selected folder

## v2 Requirements (Deferred)

### Enhanced Folder Management
- **FOLDER-06**: Drag-and-drop to reorder folders
- **FOLDER-07**: Create folders from templates/presets

### Enhanced Document Management
- **DOC-04**: Bulk-move multiple files at once
- **DOC-05**: Copy files to another folder (not just move)

### Enhanced KB Tools
- **TOOL-07**: `kb_head(document_id, n)` — read first n lines
- **TOOL-08**: `kb_tail(document_id, n)` — read last n lines
- **TOOL-09**: `kb_ls` includes content preview for each file

### Enhanced UI
- **UI-05**: Search within the folder tree
- **UI-06**: Keyboard shortcuts for folder navigation

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOLDER-01 | Phase 1 | Pending |
| FOLDER-02 | Phase 1 | Pending |
| FOLDER-03 | Phase 1 | Pending |
| FOLDER-04 | Phase 2 | Pending |
| FOLDER-05 | Phase 1 | Pending |
| DOC-01 | Phase 2 | Pending |
| DOC-02 | Phase 2 | Pending |
| DOC-03 | Phase 2 | Pending |
| TOOL-01 | Phase 4 | Pending |
| TOOL-02 | Phase 4 | Pending |
| TOOL-03 | Phase 5 | Pending |
| TOOL-04 | Phase 5 | Pending |
| TOOL-05 | Phase 6 | Pending |
| TOOL-06 | Phase 6 | Pending |
| AGENT-01 | Phase 7 | Pending |
| AGENT-02 | Phase 7 | Pending |
| AGENT-03 | Phase 7 | Pending |
| UI-01 | Phase 3 | Pending |
| UI-02 | Phase 3 | Pending |
| UI-03 | Phase 3 | Pending |
| UI-04 | Phase 3 | Pending |

**Coverage:** 21/21 v1 requirements mapped to phases

---
*Requirements defined: 2026-03-31*
