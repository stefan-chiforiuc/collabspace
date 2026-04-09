# /pre-merge-check — Run Pre-Merge Validation

Run the full pre-merge validation suite before merging any branch.

## Arguments
- `$ARGUMENTS` — Source and target branch (e.g., "feature/backend-expert/T-002-trystero develop")

## Instructions

1. Parse source and target branches from arguments (default target: develop).

2. Run the pre-merge check script:
```bash
bash .claude/memory-db/git-flow-helper.sh pre-merge-check <source> <target>
```

This runs 5 automated checks:
- **[1/5] Conflict detection** — Trial merge to preview conflicts
- **[2/5] Credential scan** — Search changed files for secrets/tokens/keys
- **[3/5] Lint** — Run linter if configured
- **[4/5] Tests** — Run test suite if configured
- **[5/5] Build** — Verify the project builds

3. If any check fails, provide specific guidance:
   - **Conflicts**: List conflicted files, suggest `/resolve-conflicts`
   - **Credentials**: Identify the exact files and patterns, must be removed
   - **Lint failures**: Show errors, suggest fixes
   - **Test failures**: Show which tests failed and why
   - **Build failures**: Show build errors

4. Store the result in memory:
```bash
node .claude/memory-db/memory-store.mjs add --type task --agent system --content "Pre-merge check <source> -> <target>: PASSED/FAILED. Details: ..." --summary "Pre-merge check result" --tags "git,merge,validation"
```

5. Only proceed with merge if ALL checks pass.

Check: $ARGUMENTS
