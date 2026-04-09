# /design-review — Review Implementation Against Design

Have the UI/UX Designer agent review the current implementation for design compliance.

## Arguments
- `$ARGUMENTS` — Component or page to review (optional)

## Instructions
1. Run the development server if not already running.
2. Review the specified component/page (or all implemented UI) against:
   - Design system tokens (colors, spacing, typography, border-radius)
   - Component specs (if defined in design docs)
   - Responsive behavior at 360px, 768px, 1024px, 1440px
   - Animation and transitions (smooth, purposeful, < 300ms)
   - Visual hierarchy and information architecture
   - Interactive element affordance (buttons look clickable, inputs look editable)
   - Dark/light mode consistency
   - WCAG AA color contrast
3. Provide specific, actionable feedback with exact CSS values where changes are needed.
4. Create tasks for the PM if significant design issues are found.

Review: $ARGUMENTS
