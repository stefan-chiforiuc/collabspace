# /memory-search — Semantic Search in Vector DB

Search the project memory using natural language. Returns the most semantically relevant memories.

## Arguments
- `$ARGUMENTS` — Natural language query

## Instructions
1. Run semantic search:
```bash
node .claude/memory-db/memory-store.mjs search --query "<query>" --limit 5
```

2. Optional filters can be added:
   - `--type <type>` — Filter by memory type
   - `--agent <agent>` — Filter by agent
   - `--status <status>` — Filter by status

3. Display the results with their relevance scores, summaries, and key content.

Search: $ARGUMENTS
