# /git-sync — Sync Current Branch with Develop

Rebase the current feature branch onto the latest develop to stay up to date.

## Instructions

1. Run:
```bash
bash .claude/memory-db/git-flow-helper.sh sync
```

2. If conflicts occur during rebase:
   - The rebase is aborted automatically
   - Run `/resolve-conflicts` to handle them manually
   - Then run `/git-sync` again

3. Agents should sync regularly (before finishing a feature) to minimize merge conflicts.

$ARGUMENTS
