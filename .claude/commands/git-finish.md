# /git-finish — Finish a Feature Branch by Creating a Pull Request

Push a completed feature branch and create a GitHub Pull Request for PM + Architect review.

**Important:** Features are NO LONGER merged directly. All merges happen via reviewed PRs.

## Arguments
- `$ARGUMENTS` — Branch name or task ID to finish

## Instructions

### Pre-Push Validation (MANDATORY)
Before pushing, run local checks:

1. **Type check** — `npx tsc -b`
2. **Tests** — `npx vitest run`
3. **Build** — `npm run build`
4. **Credential scan** — Search changed files for passwords, API keys, tokens, secrets

If ANY check fails, fix it first. Do NOT create a PR with failing checks.

### Steps

1. Ensure all changes are committed on the feature branch.

2. Sync with develop:
```bash
bash .claude/memory-db/git-flow-helper.sh sync
```

3. Run local validation:
```bash
npx tsc -b && npx vitest run && npm run build
```

4. Push the branch to GitHub:
```bash
export PATH="$PATH:/c/Program Files/GitHub CLI"
git push -u origin $(git branch --show-current)
```

5. Create a Pull Request targeting `develop`:
```bash
export PATH="$PATH:/c/Program Files/GitHub CLI"
gh pr create --base develop --title "<Task-ID>: <Short description>" --body "$(cat <<'PREOF'
## Summary
- <What was built/changed and why>
- Task: <Task-ID>

## Changes
- <List of key changes>

## Testing
- [ ] Type check passes
- [ ] Unit tests pass
- [ ] Build succeeds
- [ ] Manual testing done

## Checklist
- [ ] No credentials or secrets in code
- [ ] Architecture follows static P2P model
- [ ] User input sanitized
- [ ] Bundle size within budget
PREOF
)"
```

6. Report the PR URL and request review:
```
## PR Created

**PR:** <url>
**Branch:** <feature-branch> → develop
**Task:** <task-id>

Ready for PM + Architect review. Run `/pr-review <PR-number>` to review.
```

7. Store memory:
```bash
node .claude/memory-db/memory-store.mjs add --type task --agent <agent> --content "Created PR for <task-id>: <summary>. Awaiting PM + Architect review." --summary "PR created for <task-id>" --tags "pr,review,<task-id>"
```

**Note:** The PR will be reviewed by running `/pr-review <number>`. The reviewer (PM + Architect) will either approve and merge, or request changes.

Finish: $ARGUMENTS
