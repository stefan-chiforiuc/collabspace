# /git-finish — Finish a Feature Branch with Pre-Merge Validation

Merge a completed feature branch back to develop after running all checks.

## Arguments
- `$ARGUMENTS` — Branch name or task ID to finish

## Instructions

### Pre-Merge Validation (MANDATORY)
Before merging, the following checks run automatically:

1. **Conflict detection** — Trial merge to find conflicts before committing
2. **Credential scan** — Check all changed files for passwords, API keys, tokens, secrets
3. **Lint check** — Run `npm run lint` if available
4. **Test execution** — Run `npm test` if available
5. **Build verification** — Run `npm run build` if available

### Steps

1. Ensure all changes are committed on the feature branch.
2. Run the finish command:
```bash
bash .claude/memory-db/git-flow-helper.sh finish-feature <branch-name>
```

3. If ALL checks pass:
   - Branch is merged into `develop` with `--no-ff` (preserves history)
   - Feature branch is deleted
   - Update `tasks.md` status to `done`
   - Update `release-notes.md`
   - Store completion memory:
   ```bash
   node .claude/memory-db/memory-store.mjs add --type release --agent <agent> --content "Completed <task-id>. Merged <branch> to develop." --summary "Finished <task-id>" --related_tasks "<task-id>"
   ```

4. If checks FAIL:
   - Merge is aborted (no changes to develop)
   - Display which checks failed
   - If conflicts: run `/resolve-conflicts`
   - If tests fail: fix and retry
   - If credentials found: remove them immediately

Finish: $ARGUMENTS
