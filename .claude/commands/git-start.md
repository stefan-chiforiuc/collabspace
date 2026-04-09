# /git-start — Start a Feature Branch for an Agent

Create a new git-flow feature branch for an agent to work on a task.

## Arguments
- `$ARGUMENTS` — Agent name, task ID, and description (e.g., "backend-expert T-002 trystero setup")

## Instructions

1. Parse the arguments to extract agent name, task ID, and description.
2. Run the git-flow helper:
```bash
bash .claude/memory-db/git-flow-helper.sh start-feature <agent> <task-id> "<description>"
```

3. The branch will be named: `feature/<agent>/<task-id>-<description>`
4. Update `tasks.md` to set the task status to `working:<agent>`.
5. Store a memory in the vector DB:
```bash
node .claude/memory-db/memory-store.mjs add --type task --agent <agent> --content "Started work on <task-id>: <description>. Branch: feature/<agent>/<task-id>-<desc>" --summary "Started <task-id> on feature branch" --related_tasks "<task-id>"
```

Valid agents: project-manager, architect, backend-expert, frontend-expert, uiux-designer, qa-agent

Start: $ARGUMENTS
