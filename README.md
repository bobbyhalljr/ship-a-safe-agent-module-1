# Ship a Safe Agent: Module 1, the loop

Free starter for Module 1 of **Ship a Safe Agent**, a project-based course on building a production agent harness in TypeScript.

Lesson: https://bhjr.dev/courses/ship-a-safe-agent/module-1

You build one agent loop with:

- a tool registry with allow / ask / deny permissions
- skills that load into context only when the task needs them
- a fake model that only reads the context
- a step budget and an event log, enforced by the harness

```bash
npm install
npx tsx agent.ts
```

Fake model. No API key. No network. MIT, by Bobby Hall Jr.
