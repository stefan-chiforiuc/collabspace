# /bug-report — File a Bug Report

Create a structured bug report and notify the Project Manager.

## Arguments
- `$ARGUMENTS` — Brief description of the bug

## Instructions
1. Gather bug details:
   - **Title:** Clear, concise bug title
   - **Severity:** Critical / Major / Minor / Low
   - **Feature:** Which requirement area (FR-01 through FR-07, or NFR)
   - **Description:** What's wrong
   - **Steps to Reproduce:** Numbered steps
   - **Expected:** What should happen
   - **Actual:** What actually happens
   - **Environment:** Browser, viewport, OS if relevant
2. Create a task in `tasks.md` via the PM with severity prefix:
   - Critical: `[BUG-CRIT]`
   - Major: `[BUG-MAJOR]`
   - Minor: `[BUG-MINOR]`
   - Low: `[BUG-LOW]`
3. If the bug is Critical, flag it immediately for the PM's attention.

Bug: $ARGUMENTS
