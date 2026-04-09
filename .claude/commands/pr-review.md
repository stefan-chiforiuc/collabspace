# /pr-review — Review a Pull Request (PM + Architect)

Review a GitHub pull request as the **Project Manager** and **Architect** agents, then approve or request changes.

## Arguments
- `$ARGUMENTS` — PR number or URL (e.g., "42" or "https://github.com/owner/repo/pull/42")

## Instructions

You are performing a **dual-role review** as both the Project Manager and Architect.

### Step 1: Fetch PR Details
```bash
export PATH="$PATH:/c/Program Files/GitHub CLI"
gh pr view $ARGUMENTS --json title,body,files,additions,deletions,headRefName,baseRefName,author,state
gh pr diff $ARGUMENTS
```

### Step 2: Project Manager Review
Evaluate as the PM agent:
- [ ] Does this PR align with an existing task in `tasks.md`?
- [ ] Is the scope appropriate (no scope creep, no missing pieces)?
- [ ] Does it match the milestone priority (M1 > M2 > M3 > M4)?
- [ ] Are the changes complete enough to close the associated task?
- [ ] Is the commit message descriptive and references task IDs?

### Step 3: Architect Review
Evaluate as the Architect agent:
- [ ] No credentials, secrets, API keys, or tokens in code
- [ ] Architecture aligns with Trystero + Yjs + static site model
- [ ] No custom server-side code introduced
- [ ] User input is properly sanitized (XSS, injection)
- [ ] Bundle size impact is reasonable (< 200KB gzipped)
- [ ] No unnecessary dependencies added
- [ ] WebRTC DTLS encryption maintained
- [ ] No analytics, tracking, or cookies
- [ ] Hash-based routing preserved
- [ ] TypeScript types are correct and complete

### Step 4: Check CI Status
```bash
export PATH="$PATH:/c/Program Files/GitHub CLI"
gh pr checks $ARGUMENTS
```
All CI checks must pass before approving.

### Step 5: Decision

**If APPROVED:**
```bash
export PATH="$PATH:/c/Program Files/GitHub CLI"
gh pr review $ARGUMENTS --approve --body "$(cat <<'EOF'
## PM + Architect Review: APPROVED

### PM Assessment
- Task alignment: OK
- Scope: Appropriate
- Completeness: Ready to merge

### Architect Assessment
- Security: No credentials or vulnerabilities found
- Architecture: Compliant with static P2P model
- Bundle impact: Within budget

Approved for merge.
EOF
)"
gh pr merge $ARGUMENTS --merge --delete-branch
```

Then update tracking:
1. Update `tasks.md` — set related tasks to `done`
2. Update `release-notes.md` with what was delivered
3. Log to memory:
```bash
node .claude/memory-db/memory-store.mjs add --type decision --agent project-manager --content "Approved and merged PR #$ARGUMENTS. <summary of changes>" --summary "PR review: approved #$ARGUMENTS" --tags "review,pr,approved"
```

**If CHANGES REQUESTED:**
```bash
export PATH="$PATH:/c/Program Files/GitHub CLI"
gh pr review $ARGUMENTS --request-changes --body "$(cat <<'EOF'
## PM + Architect Review: CHANGES REQUESTED

### Issues Found
- <list specific issues>

### Required Changes
- <list what must be fixed>

Please address these issues and push new commits.
EOF
)"
```

Log to memory:
```bash
node .claude/memory-db/memory-store.mjs add --type feedback --agent project-manager --content "Requested changes on PR #$ARGUMENTS: <issues>" --summary "PR review: changes requested #$ARGUMENTS" --tags "review,pr,changes-requested"
```

### Step 6: Report
Output a summary:
```
## PR Review: #<number>

**Title:** <pr title>
**Branch:** <head> → <base>
**PM Verdict:** APPROVE / CHANGES REQUESTED
**Architect Verdict:** APPROVE / CHANGES REQUESTED
**CI Checks:** All passing / N failing
**Decision:** MERGED / CHANGES REQUESTED

### Details
- ...
```

$ARGUMENTS
