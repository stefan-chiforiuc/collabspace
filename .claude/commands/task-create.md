# /task-create — Create a New Task

Create a new task entry in `tasks.md` at the project root.

## Arguments
- `$ARGUMENTS` — Task title and description

## Instructions
1. Read the current `tasks.md` file.
2. Determine the next task ID (T-NNN format, incrementing).
3. Ask for or infer: title, description, priority (must/should/could), milestone (M1-M4), and suggested agent.
4. Append the new task row to the table in `tasks.md` with status `new`.
5. Confirm the task was created with its ID.

Create this task: $ARGUMENTS
