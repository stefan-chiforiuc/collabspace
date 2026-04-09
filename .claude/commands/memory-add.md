# /memory-add — Store a Memory in the Vector DB

Add a new memory to the local vector database with semantic embeddings.

## Arguments
- `$ARGUMENTS` — Memory content to store

## Instructions
1. Parse the user's input to determine:
   - **type**: decision, task, bug, design, security, architecture, feedback, requirement, release, context
   - **agent**: which agent is storing this (project-manager, architect, backend-expert, frontend-expert, uiux-designer, qa-agent, system)
   - **content**: the full memory text
   - **summary**: a short 1-line summary
   - **tags**: relevant tags (comma-separated)
   - **related_tasks**: any task IDs this relates to (e.g., T-001,T-005)

2. Run the command:
```bash
node .claude/memory-db/memory-store.mjs add --type <type> --agent <agent> --content "<content>" --summary "<summary>" --tags "<tags>" --related_tasks "<tasks>"
```

3. Confirm the memory was stored with its ID.

Store: $ARGUMENTS
