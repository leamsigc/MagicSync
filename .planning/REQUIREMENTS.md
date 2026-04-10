# Requirements: Knowledge Base Explorer

**Defined:** 2026-02-04
**Core Value:** The agent can explore the knowledge base the same way Claude Code explores codebases

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

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

- [ ] **TOOL-01**: Agent can use `ls(path)` to list files and subfolders in a folder
- [ ] **TOOL-02**: Agent can use `tree(path, depth?, limit?)` to get hierarchical structure with depth limit and truncation
- [ ] **TOOL-03**: Agent can use `grep(pattern, path?)` to regex search content, returns matching document names
- [ ] **TOOL-04**: Agent can use `glob(pattern)` to match filenames by pattern (e.g., `*.pdf`, `reports/**/*`)
- [ ] **TOOL-05**: Agent can use `read(document_id)` to read full document content
- [ ] **TOOL-06**: Agent can use `read(document_id, start_line, end_line)` to read specific line range

### Explorer Sub-Agent

- [ ] **AGENT-01**: Explorer sub-agent has access to all KB tools (ls, tree, grep, glob, read)
- [ ] **AGENT-02**: Explorer sub-agent can invoke document analysis sub-agent for deep document analysis
- [ ] **AGENT-03**: Explorer sub-agent returns synthesized findings, not raw tool output

### Ingestion Interface

- [ ] **UI-01**: Ingestion interface displays folder tree with navigable hierarchy
- [ ] **UI-02**: Folder tree visually distinguishes global folders from per-user folders
- [ ] **UI-03**: User can create, rename, and delete folders via UI
- [ ] **UI-04**: File upload targets the currently selected folder

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhanced Folder Management

- **FOLDER-06**: User can drag-and-drop to reorder folders
- **FOLDER-07**: User can create folders from templates/presets

### Enhanced Document Management

- **DOC-04**: User can bulk-move multiple files at once
- **DOC-05**: User can copy files to another folder (not just move)

### Enhanced KB Tools

- **TOOL-07**: Agent can use `head(document_id, n)` to read first n lines
- **TOOL-08**: Agent can use `tail(document_id, n)` to read last n lines
- **TOOL-09**: `ls` includes content preview for each file

### Enhanced Explorer

- **AGENT-04**: Explorer sub-agent caches exploration state across calls

### Enhanced UI

- **UI-05**: User can search within the folder tree
- **UI-06**: User can navigate folder tree with keyboard shortcuts

### Automatic Import

- **IMPORT-01**: User can select a local folder for automatic import
- **IMPORT-02**: System recursively imports all files from local folder maintaining structure

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Automatic local folder scanning | Phase II feature, adds significant complexity |
| Team-based folder sharing | Adds permission complexity; global + private sufficient for v1 |
| Folder-level permissions | Global = all users, per-user = private only |
| Real-time collaboration on folders | Not needed for current use case |
| Searching raw uploaded files | Only extracted markdown is searchable (Docling pipeline required) |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOLDER-01 | Phase 1 | Pending |
| FOLDER-02 | Phase 1 | Pending |
| FOLDER-03 | Phase 1 | Pending |
| FOLDER-04 | Phase 2 | Complete |
| FOLDER-05 | Phase 1 | Pending |
| DOC-01 | Phase 2 | Complete |
| DOC-02 | Phase 2 | Complete |
| DOC-03 | Phase 2 | Complete |
| TOOL-01 | Phase 4 | Complete |
| TOOL-02 | Phase 4 | Complete |
| TOOL-03 | Phase 5 | Complete |
| TOOL-04 | Phase 5 | Complete |
| TOOL-05 | Phase 6 | Complete |
| TOOL-06 | Phase 6 | Complete |
| AGENT-01 | Phase 7 | Complete |
| AGENT-02 | Phase 7 | Complete |
| AGENT-03 | Phase 7 | Complete |
| UI-01 | Phase 3 | Pending |
| UI-02 | Phase 3 | Pending |
| UI-03 | Phase 3 | Pending |
| UI-04 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0

---
*Requirements defined: 2026-02-04*
*Last updated: 2026-02-04 after roadmap creation*
