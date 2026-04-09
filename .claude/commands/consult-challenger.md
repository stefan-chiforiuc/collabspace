# /consult-challenger — Consult the Devil's Advocate

Present a decision or plan to the Devil's Advocate agent for critical review.

## Arguments
- `$ARGUMENTS` — The decision or plan to challenge

## Instructions
1. Invoke the Devil's Advocate agent (`.claude/agents/devils-advocate.md`).
2. Present the decision clearly: what is being proposed, why, and what alternatives were considered.
3. The Devil's Advocate will respond with:
   - Alignment and simplicity scores
   - Risk assessment
   - Specific challenges with alternatives
   - Final recommendation (APPROVE / APPROVE WITH CONCERNS / CHALLENGE)
4. Summarize the outcome and proceed with the PM's final decision.

Decision to review: $ARGUMENTS
