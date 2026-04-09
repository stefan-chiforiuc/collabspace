# /test-live — Test the Live Deployed App

Open and test the live GitHub Pages deployment of CollabSpace.

## Arguments
- `$ARGUMENTS` — Optional: specific feature to test (e.g., "chat", "polls", "poker", "timer", "notes", "p2p-sync", "all")

## Instructions

### Step 1: Get Live URL
```bash
export PATH="$PATH:/c/Program Files/GitHub CLI"
gh api repos/{owner}/{repo}/pages --jq '.html_url'
```
If no Pages URL, check `git remote -v` to determine the repo and construct: `https://<owner>.github.io/<repo>/`

### Step 2: Check Deployment Status
```bash
export PATH="$PATH:/c/Program Files/GitHub CLI"
gh run list --workflow=deploy.yml --limit 1
```
Ensure the latest deploy was successful. If not, report the failure.

### Step 3: Test Plan
Based on `$ARGUMENTS` (default: "all"), generate a test checklist:

#### Core P2P Sync Test (ALWAYS run this)
1. Open the live URL in a browser tab — create a room
2. Copy the room URL (including hash fragment)
3. Open a second browser tab/window with the same URL
4. Verify both tabs show each other in the participant list
5. Send a chat message from Tab 1 — verify it appears in Tab 2
6. Send a chat message from Tab 2 — verify it appears in Tab 1

#### Feature Tests (based on argument)
- **chat**: Send messages, verify delivery, check markdown rendering, test emoji
- **polls**: Create a poll, vote from both tabs, verify results sync
- **poker**: Start a round, vote from both tabs, reveal, verify results
- **timer**: Start a timer, verify both tabs show countdown, test pause/resume
- **notes**: Type in notepad from Tab 1, verify text appears in Tab 2
- **p2p-sync**: Full sync test — create content in all features, verify Tab 2 sees everything

#### Non-Functional Tests
- **Mobile**: Test responsive layout at 360px viewport
- **PWA**: Check if install prompt works, verify service worker registration
- **Performance**: Check page load time (should be < 2s FMP on 4G)

### Step 4: Report Results
```
## Live Test Results

**URL:** <live-url>
**Tested:** <date>
**Features tested:** <list>

### Results
| Test | Status | Notes |
|------|--------|-------|
| Room creation | PASS/FAIL | ... |
| P2P sync | PASS/FAIL | ... |
| Chat | PASS/FAIL | ... |
| ... | ... | ... |

### Issues Found
- <list any bugs discovered>

### Recommendations
- <next steps>
```

### Step 5: File Bugs
For each issue found:
```bash
node .claude/memory-db/memory-store.mjs add --type bug --agent qa-agent --content "<bug description>" --summary "<short summary>" --tags "live-test,<feature>"
```

$ARGUMENTS
