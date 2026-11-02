# Baton Task Manager

Full-stack task management app: tasks with required skills, skill-restricted
assignment, nested subtasks, and automatic skill tagging via an LLM.

## Stack
- Client: TypeScript + React (SPA), in `client/`
- Server: TypeScript + Node.js, in `server/`
- Database: PostgreSQL, schema changes via migrations only
- Containerised with Docker; everything runs via `docker compose up`

## Commands (update once scaffolded)
- Run everything: `docker compose up --build`
- Database only: `docker compose up -d db`
- Server tests: `cd server && npm test`
- Client tests: `cd client && npm test`
- Lint / typecheck: `npm run lint` / `npm run typecheck` (in each package)
- Run migrations: `cd server && npm run migrate` (needs `docker compose up -d db`; reads the repo-root `.env`)

## How we work
- Plan first: propose an approach and wait for approval before editing.
- Keep changes small and reviewable. One logical change per commit.
- Commit messages: imperative and scoped, e.g.
  `api: add task assignment endpoint with skill validation`.
- Never edit a migration after it is committed. Add a new one.
- Keep business rules in a service layer, not in route handlers or UI.

## Business rules (must be covered by tests)
- A task can only be assigned to a developer who has ALL skills the task
  requires. Enforced in the server, not just the UI.
- Tasks can be created without an assignee.
- Task status can be changed (e.g. To-do, In progress, Done).
- A task can only be set to Done if all its subtasks are Done. Subtasks
  have the same properties as tasks and can nest up to 3 levels deep
  (task, subtask, sub-subtask). The cap is enforced where tasks are
  created (API and creation form); the schema and the rules work at any
  depth.
- When a task is set to To-do or In progress, every Done ancestor is
  reopened to In progress (upward cascade). Ancestors that are To-do or
  In progress are left alone, and setting a task to Done never cascades.
  Together with the Done rule, a Done task never has unfinished subtasks.
- Tasks and subtasks created without skills get skills from the LLM
  automatically on the server. Validate LLM output against known skills,
  and a failed LLM call must never block task creation.

## Database and seed data
- Use unique constraints (developer name, skill name, join-table pairs).
- The seed script must be safe to run repeatedly: insert only if missing,
  so restarts never create duplicates.
- Seed: Alice (Frontend), Bob (Backend), Carol (Frontend + Backend),
  Dave (Backend).

## Docker
- `docker compose up` must work on a clean machine: it runs migrations,
  seeds data, and serves both server and client.
- Inside Docker, services reach each other by service name (e.g. `db`),
  not `localhost`. The server waits for the database healthcheck.
- Keep `.dockerignore` files so `node_modules` and `.env` stay out of images.

## Code standards
- TypeScript strict mode, no `any` without a comment explaining why.
- Validate all API input at the boundary. Return clear error messages and
  correct HTTP status codes.
- Prefer a few well-chosen libraries over many; justify each in the README.
- Components small and typed. Keep API calls out of presentational components.

## Secrets
- Never commit API keys. Use `.env` (gitignored) and keep `.env.example`
  up to date with placeholder values.

## When unsure
Ask instead of guessing, and list any assumption made so it can go in the README.
