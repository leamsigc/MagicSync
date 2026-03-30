# Reference

## Dependency Categories

### 1. Vertical
Feature spans multiple layers: UI → API → Service → External
- Example: Post creation flow
- Best solved by: Deep module consolidating all layers

### 2. Horizontal
Shared types or concepts across different features
- Example: User ID used in auth and scheduling
- Best solved by: Clear type definitions, shared interfaces

### 3. Cross-cutting
Affects multiple features simultaneously
- Example: API → Service coupling across all routes
- Best solved by: Facades, shared utilities

### 4. Temporal
Dependencies that change over time
- Example: OAuth tokens expire
- Best solved by: Refresh mechanisms, caching

---

## RFC Issue Template

```markdown
## RFC: [Title]

### Summary
One paragraph explaining what this refactor accomplishes.

### Problem
Why is this needed? What's the current friction?

### Proposed Solution
High-level approach.

### Interface

```typescript
// New interface signatures
```

### Trade-offs
What are we trading off? What do we lose?

### Implementation Plan
Rough phases:
1. 
2. 
3. 

### Related
- Candidates: #
- Issues: 
```

---

## Module Depth Principles

From "A Philosophy of Software Design" by John Ousterhout:

- **Deep module**: Small interface hiding large implementation
- **Shallow module**: Interface nearly as complex as implementation
- **Deep = testable**: Test at boundary, not inside
- **Deep = AI-navigable**: One file to understand, not ten

### Signs of Shallow Modules
- Many small files for one concept
- Need to bounce between files to understand feature
- Each file has simple logic but complex interactions

### Signs of Deep Modules
- Single entry point for complex feature
- Rich functionality behind simple interface
- Easy to test at boundary
