# /arch-review — Architecture Compliance Review

Review recent code changes for architectural compliance with CollabSpace v2 requirements.

## Arguments
- `$ARGUMENTS` — Specific files or features to review (optional, defaults to recent changes)

## Instructions
1. Read `requirements-v2.md` for the architecture spec.
2. Review the specified code (or recent git changes) against:
   - [ ] Static site only — no server-side code
   - [ ] Trystero for signaling — no custom signaling server
   - [ ] Yjs for all shared state — no separate state management for synced data
   - [ ] Yjs document structure matches the spec
   - [ ] Hash-based routing (server never sees room IDs)
   - [ ] No analytics, tracking, or cookies
   - [ ] Bundle size impact reasonable
   - [ ] Dependencies are justified and tree-shakeable
   - [ ] WebRTC DTLS encryption maintained
3. Report any violations with specific file locations and recommended fixes.
4. If the code passes review, confirm compliance.

Review: $ARGUMENTS
