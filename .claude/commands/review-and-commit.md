# /review-and-commit — Full Review Pipeline + Auto-Commit

Review all changes on the current feature branch, run QA checks, fix issues, and commit + merge to develop if everything passes.

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

### Step 8: Pre-Merge Check
```bash
bash .claude/memory-db/git-flow-helper.sh sync
bash .claude/memory-db/git-flow-helper.sh pre-merge-check
```
If pre-merge fails, fix and retry.

### Step 9: Finish Feature
If `$ARGUMENTS` is NOT "dry-run":
```bash
bash .claude/memory-db/git-flow-helper.sh finish-feature $(git branch --show-current)
```

### Step 10: Update Project Tracking
1. Update `tasks.md` — set completed tasks to `done`
2. Update `release-notes.md` — add entry for what was delivered
3. Log to memory:
```bash
node .claude/memory-db/memory-store.mjs add --type task --agent code-reviewer --content "Reviewed and merged: <summary>. Types: OK. Tests: N passed. Build: OK. Bundle: XKB gzipped." --summary "Code review: <branch>" --tags "review,merge,<milestone>"
```

### Step 11: Report
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
**Merged to develop:** Yes / No

### Issues Found
- ...

### Tasks Completed
- T-XXX: ...
```

$ARGUMENTS
