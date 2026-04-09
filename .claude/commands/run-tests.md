# /run-tests — Execute Test Suite

Run the full test suite and report results.

## Arguments
- `$ARGUMENTS` — Optional: "unit", "e2e", "all", or specific test file path

## Instructions
1. Determine which tests to run based on arguments (default: all).
2. Execute:
   - Unit tests: `npx vitest run`
   - E2E tests: `npx playwright test`
   - Specific file: `npx vitest run <path>` or `npx playwright test <path>`
3. Report results:
   - Total tests: passed / failed / skipped
   - Failed test details with error messages
   - Coverage summary if available
4. If tests fail, create bug reports and notify the PM for task creation.

Run: $ARGUMENTS
