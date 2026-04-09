# /git-release — Create or Finish a Release

Manage release branches for milestone deliveries.

## Arguments
- `$ARGUMENTS` — "start <version>" or "finish <version>" (e.g., "start 0.1.0")

## Instructions

### Start a Release
```bash
bash .claude/memory-db/git-flow-helper.sh start-release <version>
```
- Creates `release/<version>` from develop
- Only bug fixes and release prep allowed on this branch
- No new features

### Finish a Release
```bash
bash .claude/memory-db/git-flow-helper.sh finish-release <version>
```
- Runs full pre-merge validation against main
- Merges to main AND develop
- Creates a git tag with the version
- Update `release-notes.md` with the release summary

Release: $ARGUMENTS
