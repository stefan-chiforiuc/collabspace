# /review-and-commit — Full Review Pipeline + Auto-Commit + Create PR

Review all changes on the current feature branch, run QA checks, fix issues, commit, and create a Pull Request for PM + Architect review.

**Important:** This command no longer merges directly. It creates a PR that must be reviewed via `/pr-review`.

## Arguments
- `$ARGUMENTS` — Optional: commit message override or "dry-run" to review without committing

## Instructions

You are acting as the **Code Reviewer** agent. Follow this pipeline exactly:

### Step 1: Identify Scope
```bash
git branch --show-current
git diff develop...HEAD --stat
```
Read every changed file to understand what was built.

### Step 2: Type Check
```bash
npx tsc -b
```
If errors are found, fix them. Re-run until clean.

### Step 3: Security Scan
Search all changed files for:
- Credential patterns: `password`, `secret`, `token`, `api_key`, `apikey`, `auth_token`, `private_key`
- Base64 strings that look like keys
- URLs with embedded credentials
- `innerHTML` without sanitization, `eval()`, `document.write()`
- `.env` files not in `.gitignore`

If credentials are found, **remove them immediately** and flag to the user.

### Step 4: Run Tests
```bash
npx vitest run
```
If tests fail, analyze the failures:
- If the fix is straightforward (missing import, typo, wrong assertion), fix it and re-run.
- If the fix is complex, report the failure and stop.

### Step 5: Build
```bash
npm run build
```
Check the output:
- Build must succeed
- Report the gzipped bundle size from the output
- Flag if total gzipped JS exceeds 200KB (NFR-12)

### Step 6: Fix Issues
If any step above found issues:
1. Fix what you can (type errors, unused imports, minor bugs)
2. Re-run the full pipeline (steps 2-5) to confirm fixes
3. If unfixable issues remain, report them and stop — do NOT commit broken code

### Step 7: Commit
If all checks pass:
1. Stage changed files by name (never `git add -A` or `git add .`):
```bash
git add <file1> <file2> ...
```
2. Write a commit message that:
   - Summarizes what was built (not just "fix" or "update")
   - References task IDs (e.g., T-001 through T-012)
   - Follows the existing commit message style from `git log`
3. Commit:
```bash
git commit -m "<message>"
```

### Step 8: Create Pull Request
If `$ARGUMENTS` is NOT "dry-run":

1. Push the branch:
```bash
export PATH="$PATH:/c/Program Files/GitHub CLI"
git push -u origin $(git branch --show-current)
```

2. Create a PR targeting `develop`:
```bash
export PATH="$PATH:/c/Program Files/GitHub CLI"
gh pr create --base develop --title "<Task-ID>: <Short description>" --body "$(cat <<'PREOF'
## Summary
- <What was built/changed>
- Task: <Task-ID>

## Review Pipeline Results
- **Type check:** OK
- **Tests:** N passed
- **Security:** Clean
- **Build:** OK
- **Bundle size:** XKB gzipped

## Changes
- <List of key changes>
PREOF
)"
```

### Step 9: Update Project Tracking
1. Update `tasks.md` — set task status to `review`
2. Log to memory:
```bash
node .claude/memory-db/memory-store.mjs add --type task --agent code-reviewer --content "Reviewed and created PR for: <summary>. Types: OK. Tests: N passed. Build: OK. Bundle: XKB gzipped." --summary "Code review: <branch>" --tags "review,pr,<milestone>"
```

### Step 10: Report
Output a summary:
```
## Review Complete

**Branch:** <branch-name>
**Status:** PASSED / FAILED
**Type check:** OK / N errors
**Tests:** N passed, N failed
**Security:** Clean / N issues
**Build:** OK / Failed
**Bundle size:** XKB gzipped (budget: 200KB)
**Committed:** Yes (sha) / No (dry-run) / No (failures)
**PR Created:** #<number> (<url>) / No (dry-run)

Next step: Run `/pr-review <PR-number>` for PM + Architect review.

### Issues Found
- ...

### Tasks Updated
- T-XXX: status → review
```

$ARGUMENTS
