# /assign — Assign a Task to an Agent

Assign a task from the task board to a specific agent for execution.

## Arguments
- `$ARGUMENTS` — Task ID and agent name (e.g., "T-005 frontend-expert")

## Instructions
1. Read `tasks.md` to find the specified task.
2. Update the task's agent field and set status to `working:<agent-name>`.
3. Prepare a clear brief for the assigned agent with:
   - Task description and acceptance criteria
   - Relevant requirement IDs from `requirements-v2.md`
   - Any dependencies on other tasks
   - Expected deliverables
4. Launch the appropriate agent with the brief.

Available agents:
- `architect` — Architecture and security oversight
- `backend-expert` — P2P networking, Yjs state, service worker
- `frontend-expert` — UI components, responsive layout
- `uiux-designer` — Design specs, visual QA
- `qa-agent` — Testing, bug reports

Assign: $ARGUMENTS
