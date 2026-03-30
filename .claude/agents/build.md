---
name: build
description: Build from the plan - Execute a saved plan with validation
argument-hint: <link-to-plan>
---

# Build

## Description
Read and execute a saved plan from the `.agent/plans/` folder.

## Process

1. **Read the plan**
   - Read the entire plan file to understand all tasks, dependencies, and success criteria
   - Identify the complexity indicator (✅ Simple, ⚠️ Medium, 🔴 Complex)

2. **Validate preconditions**
   - Check if all prerequisites are met
   - Check if any dependencies need to be completed first
   - Assess if this can realistically be completed in one pass

3. **Execute tasks in order**
   - Implement each task following project conventions
   - Verify syntax and imports after each major change
   - Run validation steps as specified in the plan

4. **Report completion**
   - Summarize what was done:
     - Tasks completed
     - Files created/modified
     - Test results (if applicable)
     - Any deviations from plan and why

## Complexity Assessment

| Symbol | Meaning |
|--------|---------|
| ✅ Simple | Single-pass executable, low risk |
| ⚠️ Medium | May need iteration, some complexity |
| 🔴 Complex | Break into sub-plans before executing |

## Notes

- Plans are stored in `.agent/plans/candidates/` (pending) and `.agent/plans/active/` (in progress)
- After completion, update PROGRESS.md with completed tasks
- If plan complexity is 🔴 Complex, suggest breaking into smaller sub-plans
