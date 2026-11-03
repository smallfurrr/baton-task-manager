# Baton: skill-based task assignment

A task manager where tasks need skills and can only go to developers who have all of them. Tasks can have nested subtasks, and an LLM tags tasks that are created without skills.

- Skill-restricted assignment, enforced on the server.
- Subtasks up to 3 levels deep. A task is Done only when all its subtasks are Done.
- Leave skills empty and Gemini picks them from the title.
- Starts the database, API and app with a single `docker compose up --build`.

| Task list | Create task |
| --- | --- |
| ![Task list](docs/screenshots/task-list.png) | ![Create task](docs/screenshots/create-task.png) |

## Quick start

Requires Docker with Compose.

```bash
cp .env.example .env     # then add your GEMINI_API_KEY
docker compose up --build
```

Open **http://localhost:8080**. On start the server runs the migrations, seeds the data (Alice, Bob, Carol, Dave; Frontend, Backend) and starts the API. The seed is safe to repeat. `docker compose down -v` resets the data.

| Service | Port | Notes |
| --- | --- | --- |
| `client` | 8080 | nginx serves the React app and proxies `/api` |
| `server` | 3000 (internal) | Express API |
| `db` | 5432 | PostgreSQL 18 |

## Configuration

Set these in `.env`.

| Variable | Purpose |
| --- | --- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Database credentials |
| `PORT` | API port (3000) |
| `DATABASE_URL` | Database URL when running the server outside Docker |
| `GEMINI_API_KEY` | Key for skill tagging. Without it the app still works; tasks just stay untagged |
| `GEMINI_MODEL` | Default `gemini-3.5-flash-lite` |

A variable already set in your shell overrides `.env`.

## Local development

```bash
docker compose up -d db
cd server && npm install && npm run migrate && npm run seed && npm run dev   # :3000
cd client && npm install && npm run dev                                      # :5173, proxies /api
```

In each package: `npm test`, `npm run lint`, `npm run typecheck`. Server tests need the database running. They create their own `baton_test` database and refuse to wipe any database not ending in `_test`.

## Testing

- **Server:** Vitest and supertest against a real PostgreSQL test database. A fake classifier stands in for the LLM, so no test calls Gemini.
- **Client:** Vitest and React Testing Library.
- Every business rule below has tests.
