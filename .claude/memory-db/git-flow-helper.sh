#!/usr/bin/env bash
#
# CollabSpace v2 — Git Flow Helper for Agents
#
# Provides safe git-flow operations with built-in conflict detection,
# test execution, and security scanning before any merge.
#
# Usage:
#   bash .claude/memory-db/git-flow-helper.sh <command> [args]
#
# Commands:
#   start-feature <agent> <task-id> <description>  — Create feature branch
#   finish-feature <branch-name>                    — Merge feature to develop (with tests)
#   start-release <version>                         — Create release branch from develop
#   finish-release <version>                        — Merge release to main + develop
#   start-hotfix <version> <description>            — Create hotfix branch from main
#   finish-hotfix <version>                         — Merge hotfix to main + develop
#   status                                          — Show current branch status
#   sync                                            — Sync current branch with develop
#   check-conflicts <target-branch>                 — Preview merge conflicts
#   pre-merge-check <source> <target>               — Run full pre-merge validation
#   list-branches                                   — List all agent branches

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[INFO]${NC} $*"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

# ─── Branch naming convention ────────────────────────────────
# feature/<agent>/<task-id>-<short-description>
# e.g., feature/backend-expert/T-002-trystero-setup

make_branch_name() {
  local agent="$1"
  local task_id="$2"
  local desc="$3"
  # Sanitize description for branch name
  local clean_desc
  clean_desc=$(echo "$desc" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd 'a-z0-9-' | head -c 40)
  echo "feature/${agent}/${task_id}-${clean_desc}"
}

# ─── Commands ─────────────────────────────────────────────────

cmd_start_feature() {
  local agent="${1:?Agent name required}"
  local task_id="${2:?Task ID required}"
  local desc="${3:?Description required}"

  local branch
  branch=$(make_branch_name "$agent" "$task_id" "$desc")

  log_info "Creating feature branch: $branch"

  # Ensure we're on develop and up to date
  git checkout develop 2>/dev/null
  git pull 2>/dev/null || true

  git flow feature start "${branch#feature/}" 2>&1

  log_ok "Feature branch created: $branch"
  log_info "Agent '$agent' can now work on task $task_id"
  echo ""
  echo "Branch: $branch"
  echo "Agent: $agent"
  echo "Task: $task_id"
}

cmd_finish_feature() {
  local branch="${1:?Branch name required}"

  # If just the suffix is passed, prepend feature/
  if [[ "$branch" != feature/* ]]; then
    branch="feature/$branch"
  fi

  log_info "Finishing feature branch: $branch"

  # Step 1: Check for uncommitted changes
  if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
    log_error "Uncommitted changes detected. Commit or stash before finishing."
    git status --short
    exit 1
  fi

  # Step 2: Switch to the feature branch
  git checkout "$branch" 2>/dev/null

  # Step 3: Run pre-merge checks
  log_info "Running pre-merge validation..."
  if ! cmd_pre_merge_check "$branch" "develop"; then
    log_error "Pre-merge checks FAILED. Fix issues before finishing."
    exit 1
  fi

  # Step 4: Attempt merge to develop
  git checkout develop 2>/dev/null
  git pull 2>/dev/null || true

  log_info "Merging $branch into develop..."
  if git merge --no-ff "$branch" -m "Merge $branch into develop" 2>&1; then
    log_ok "Feature merged successfully into develop"
    # Delete feature branch
    git branch -d "$branch" 2>/dev/null || true
  else
    log_error "Merge conflicts detected!"
    echo ""
    echo "CONFLICTED FILES:"
    git diff --name-only --diff-filter=U 2>/dev/null
    echo ""
    log_warn "Run '/resolve-conflicts' to resolve them, then retry."
    # Abort the failed merge
    git merge --abort 2>/dev/null || true
    git checkout "$branch" 2>/dev/null
    exit 1
  fi
}

cmd_start_release() {
  local version="${1:?Version required (e.g., 0.1.0)}"

  log_info "Creating release branch: release/$version"
  git checkout develop 2>/dev/null
  git pull 2>/dev/null || true
  git flow release start "$version" 2>&1
  log_ok "Release branch created: release/$version"
}

cmd_finish_release() {
  local version="${1:?Version required}"

  log_info "Finishing release: $version"

  # Pre-merge check against main
  cmd_pre_merge_check "release/$version" "main"

  git flow release finish -m "Release $version" "$version" 2>&1
  log_ok "Release $version merged to main and develop, tagged"
}

cmd_start_hotfix() {
  local version="${1:?Version required}"
  local desc="${2:-hotfix}"

  log_info "Creating hotfix branch: hotfix/$version"
  git checkout main 2>/dev/null
  git pull 2>/dev/null || true
  git flow hotfix start "$version" 2>&1
  log_ok "Hotfix branch created: hotfix/$version"
}

cmd_finish_hotfix() {
  local version="${1:?Version required}"

  log_info "Finishing hotfix: $version"
  cmd_pre_merge_check "hotfix/$version" "main"

  git flow hotfix finish -m "Hotfix $version" "$version" 2>&1
  log_ok "Hotfix $version merged to main and develop, tagged"
}

cmd_status() {
  echo "=== Git Flow Status ==="
  echo ""
  echo "Current branch: $(git branch --show-current)"
  echo ""
  echo "Branches:"
  git branch -a --format='  %(refname:short) %(upstream:short) %(upstream:track)' 2>/dev/null
  echo ""
  echo "Recent commits on current branch:"
  git log --oneline -5
  echo ""
  echo "Working tree status:"
  git status --short
}

cmd_sync() {
  local current
  current=$(git branch --show-current)

  if [[ "$current" == "main" || "$current" == "develop" ]]; then
    log_warn "On $current — pulling latest"
    git pull 2>/dev/null || true
    return
  fi

  log_info "Syncing $current with develop..."

  # Rebase current branch onto latest develop
  git fetch 2>/dev/null || true
  git checkout develop 2>/dev/null
  git pull 2>/dev/null || true
  git checkout "$current" 2>/dev/null

  if git rebase develop 2>&1; then
    log_ok "Branch $current synced with develop"
  else
    log_error "Rebase conflicts detected!"
    echo ""
    echo "CONFLICTED FILES:"
    git diff --name-only --diff-filter=U 2>/dev/null
    echo ""
    log_warn "Resolve conflicts, then run 'git rebase --continue'"
    git rebase --abort 2>/dev/null
    exit 1
  fi
}

cmd_check_conflicts() {
  local target="${1:-develop}"
  local current
  current=$(git branch --show-current)

  log_info "Checking for merge conflicts: $current -> $target"

  # Do a trial merge without committing
  git stash 2>/dev/null || true

  local tmp_branch="tmp-conflict-check-$$"
  git checkout -b "$tmp_branch" "$target" 2>/dev/null

  if git merge --no-commit --no-ff "$current" 2>/dev/null; then
    log_ok "No conflicts detected! Clean merge possible."
    git merge --abort 2>/dev/null || true
  else
    log_warn "CONFLICTS detected in:"
    git diff --name-only --diff-filter=U 2>/dev/null
    git merge --abort 2>/dev/null || true
  fi

  git checkout "$current" 2>/dev/null
  git branch -D "$tmp_branch" 2>/dev/null
  git stash pop 2>/dev/null || true
}

cmd_pre_merge_check() {
  local source="${1:?Source branch required}"
  local target="${2:-develop}"

  echo ""
  echo "╔══════════════════════════════════════════════════╗"
  echo "║          PRE-MERGE VALIDATION CHECK              ║"
  echo "╠══════════════════════════════════════════════════╣"
  echo "║  Source: $(printf '%-39s' "$source") ║"
  echo "║  Target: $(printf '%-39s' "$target") ║"
  echo "╚══════════════════════════════════════════════════╝"
  echo ""

  local failed=0

  # Check 1: Conflict detection
  log_info "[1/5] Checking for merge conflicts..."
  local tmp_branch="tmp-premerge-$$"
  git stash 2>/dev/null || true
  git checkout -b "$tmp_branch" "$target" 2>/dev/null

  if git merge --no-commit --no-ff "$source" 2>/dev/null; then
    log_ok "No merge conflicts"
    git merge --abort 2>/dev/null || true
  else
    log_error "MERGE CONFLICTS DETECTED"
    git diff --name-only --diff-filter=U 2>/dev/null
    git merge --abort 2>/dev/null || true
    failed=1
  fi

  git checkout "$source" 2>/dev/null
  git branch -D "$tmp_branch" 2>/dev/null
  git stash pop 2>/dev/null || true

  # Check 2: Security scan for credentials
  log_info "[2/5] Scanning for credentials and secrets..."
  local cred_found=0

  # Check changed files only
  local changed_files
  changed_files=$(git diff --name-only "$target"..."$source" 2>/dev/null || echo "")

  if [ -n "$changed_files" ]; then
    for pattern in "password" "secret" "api_key" "apikey" "token" "private_key" "credential" "BEGIN PRIVATE" "BEGIN RSA"; do
      local matches
      matches=$(echo "$changed_files" | xargs grep -li "$pattern" 2>/dev/null || true)
      if [ -n "$matches" ]; then
        log_error "Potential credential found (pattern: '$pattern') in:"
        echo "$matches" | sed 's/^/    /'
        cred_found=1
      fi
    done

    # Check for .env files
    if echo "$changed_files" | grep -q '\.env'; then
      log_error ".env file detected in changes!"
      cred_found=1
    fi
  fi

  if [ "$cred_found" -eq 0 ]; then
    log_ok "No credentials or secrets found"
  else
    failed=1
  fi

  # Check 3: Lint/syntax check (if applicable)
  log_info "[3/5] Checking for syntax errors..."
  if [ -f "package.json" ] && command -v npx &>/dev/null; then
    if grep -q '"lint"' package.json 2>/dev/null; then
      if npm run lint 2>&1; then
        log_ok "Lint passed"
      else
        log_error "Lint failed"
        failed=1
      fi
    else
      log_ok "No lint script configured (skipped)"
    fi
  else
    log_ok "No lint available (skipped)"
  fi

  # Check 4: Run tests (if available)
  log_info "[4/5] Running tests..."
  if [ -f "package.json" ] && command -v npx &>/dev/null; then
    if grep -q '"test"' package.json 2>/dev/null; then
      if npm test 2>&1; then
        log_ok "All tests passed"
      else
        log_error "Tests FAILED"
        failed=1
      fi
    else
      log_ok "No test script configured (skipped)"
    fi
  else
    log_ok "No tests available (skipped)"
  fi

  # Check 5: Build check (if available)
  log_info "[5/5] Checking build..."
  if [ -f "package.json" ] && command -v npx &>/dev/null; then
    if grep -q '"build"' package.json 2>/dev/null; then
      if npm run build 2>&1; then
        log_ok "Build succeeded"
      else
        log_error "Build FAILED"
        failed=1
      fi
    else
      log_ok "No build script configured (skipped)"
    fi
  else
    log_ok "No build available (skipped)"
  fi

  echo ""
  if [ "$failed" -eq 0 ]; then
    echo "╔══════════════════════════════════════════════════╗"
    echo "║          ✓ ALL PRE-MERGE CHECKS PASSED          ║"
    echo "╚══════════════════════════════════════════════════╝"
    return 0
  else
    echo "╔══════════════════════════════════════════════════╗"
    echo "║          ✗ PRE-MERGE CHECKS FAILED              ║"
    echo "╚══════════════════════════════════════════════════╝"
    return 1
  fi
}

cmd_list_branches() {
  echo "=== Agent Feature Branches ==="
  echo ""

  for agent in project-manager architect backend-expert frontend-expert uiux-designer qa-agent; do
    local branches
    branches=$(git branch --list "feature/${agent}/*" 2>/dev/null)
    if [ -n "$branches" ]; then
      echo "[$agent]"
      echo "$branches" | sed 's/^/  /'
      echo ""
    fi
  done

  echo "=== Release/Hotfix Branches ==="
  git branch --list "release/*" "hotfix/*" 2>/dev/null | sed 's/^/  /'
  echo ""
  echo "Current: $(git branch --show-current)"
}

# ─── Main ─────────────────────────────────────────────────────

case "${1:-help}" in
  start-feature)    shift; cmd_start_feature "$@" ;;
  finish-feature)   shift; cmd_finish_feature "$@" ;;
  start-release)    shift; cmd_start_release "$@" ;;
  finish-release)   shift; cmd_finish_release "$@" ;;
  start-hotfix)     shift; cmd_start_hotfix "$@" ;;
  finish-hotfix)    shift; cmd_finish_hotfix "$@" ;;
  status)           cmd_status ;;
  sync)             cmd_sync ;;
  check-conflicts)  shift; cmd_check_conflicts "$@" ;;
  pre-merge-check)  shift; cmd_pre_merge_check "$@" ;;
  list-branches)    cmd_list_branches ;;
  help|*)
    echo "CollabSpace v2 — Git Flow Helper"
    echo ""
    echo "Usage: bash .claude/memory-db/git-flow-helper.sh <command> [args]"
    echo ""
    echo "Commands:"
    echo "  start-feature <agent> <task-id> <desc>   Create feature branch for agent"
    echo "  finish-feature <branch>                  Merge feature to develop (with checks)"
    echo "  start-release <version>                  Create release branch"
    echo "  finish-release <version>                 Finish release (merge to main+develop)"
    echo "  start-hotfix <version> [desc]            Create hotfix from main"
    echo "  finish-hotfix <version>                  Finish hotfix"
    echo "  status                                   Show branch status"
    echo "  sync                                     Sync current branch with develop"
    echo "  check-conflicts [target]                 Preview merge conflicts"
    echo "  pre-merge-check <source> <target>        Full pre-merge validation"
    echo "  list-branches                            List all agent branches"
    ;;
esac
