# /resolve-conflicts — Intelligent Merge Conflict Resolution

Resolve git merge conflicts safely by understanding both sides, preserving functionality, and validating the result.

## Arguments
- `$ARGUMENTS` — Optional: target branch (defaults to develop), or "rebase" for rebase conflicts

## Instructions

### Step 1: Identify Conflicts
```bash
git diff --name-only --diff-filter=U
```
List all conflicted files.

### Step 2: For EACH Conflicted File

1. **Read the file** to see the conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`).
2. **Understand both sides:**
   - `<<<<<<< HEAD` (or `<<<<<<< ours`) = the target branch version (develop/main)
   - `>>>>>>> feature/...` (or `>>>>>>> theirs`) = the incoming feature branch version
3. **Read the surrounding context** — understand what each side was trying to do.
4. **Check the requirements** — reference `requirements-v2.md` to understand the intended behavior.
5. **Search memory** for relevant context:
   ```bash
   node .claude/memory-db/memory-store.mjs search --query "<description of conflicted area>"
   ```
6. **Resolve the conflict** by:
   - **Combining both changes** if they modify different aspects (most common)
   - **Choosing the feature branch** if it adds new functionality that doesn't break existing
   - **Choosing the target branch** if the feature branch reverts important fixes
   - **Rewriting the section** if both sides are partially correct
   - **NEVER** blindly accept one side — always understand what both sides do

### Step 3: Validate Resolution

After resolving ALL conflicts:

1. **Check syntax** — Ensure the resolved files have valid syntax:
   ```bash
   # For TypeScript/JavaScript
   npx tsc --noEmit 2>&1 || true
   ```

2. **Run tests** if available:
   ```bash
   npm test 2>&1 || true
   ```

3. **Run build** if available:
   ```bash
   npm run build 2>&1 || true
   ```

4. **Verify no conflict markers remain:**
   ```bash
   grep -rn "<<<<<<< \|======= \|>>>>>>> " --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.css" --include="*.json" --include="*.md" . || echo "No conflict markers found - clean!"
   ```

### Step 4: Complete the Merge/Rebase

If resolving a **merge**:
```bash
git add <resolved-files>
git commit -m "Resolve merge conflicts: <summary of what was resolved>"
```

If resolving a **rebase**:
```bash
git add <resolved-files>
git rebase --continue
```

### Step 5: Store Memory

```bash
node .claude/memory-db/memory-store.mjs add --type task --agent <agent> --content "Resolved merge conflicts between <source> and <target>. Files: <list>. Resolution: <what was done>." --summary "Resolved merge conflicts" --tags "git,conflicts"
```

## Conflict Resolution Rules

1. **NEVER delete functionality** — if the feature branch adds new code and develop has other new code, keep BOTH.
2. **Imports**: Keep all imports from both sides, remove duplicates.
3. **Function additions**: If both sides add different functions, keep both.
4. **Function modifications**: If both sides modify the same function differently, combine the changes or consult the relevant agent.
5. **Config files** (package.json, tsconfig, etc.): Merge carefully — keep all dependencies from both sides, resolve version conflicts by using the newer version.
6. **Test files**: Keep all tests from both sides.
7. **When in doubt**: Ask the Project Manager to consult the relevant agent who wrote the conflicting code.

## Red Flags — Stop and Escalate

- Both sides fundamentally redesign the same component differently
- Conflict in architecture-critical files (Yjs document structure, Trystero config)
- More than 5 files with complex conflicts
- Test files conflict in a way that suggests incompatible assumptions

In these cases, report to the Project Manager for a decision.

Resolve: $ARGUMENTS
