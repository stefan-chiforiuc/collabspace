---
name: CollabSpace v2 Multi-Agent System
description: Project uses 7 custom agents (PM, Devil's Advocate, Architect, Backend, Frontend, UI/UX, QA) with task board and release notes workflow
type: project
---

CollabSpace v2 uses a multi-agent system with 7 agents defined in `.claude/agents/`. The PM agent coordinates all work, always consults the Devil's Advocate before major decisions, and tracks tasks in `tasks.md`. Release notes go in `release-notes.md`. 30 initial tasks are defined across 4 milestones (M1-M4).

**Why:** User wants structured, autonomous agent coordination where agents have clear roles, report to PM, and maintain project documentation.

**How to apply:** When working on this project, use the agent system. Start with the PM agent for coordination. Always consult Devil's Advocate on non-trivial decisions. Keep tasks.md and release-notes.md up to date.
