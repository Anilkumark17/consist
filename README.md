# Consist

Consist is a meeting-to-execution system. A transcript is not a summary artifact. It is intake for a project: people, decisions, and tasks are extracted, a human approves them, then work lives on a shared board whose completion rolls up to project progress.

The product invariant is simple: **a project is the aggregate root**. Meetings, collaborators, and tasks never exist in isolation. Assignment cannot happen until the owner is on that project’s team.

## Why it exists

Most meeting tools stop at notes. Follow-through fails because ownership is inferred, not confirmed, and because people, tasks, and status live in different places. Consist inserts a human-in-the-loop gate between extraction and assignment, then keeps every downstream view derived from the same project records.

---

## Architecture

### System context

```
┌────────────┐     cookie session      ┌─────────────────────┐
│  Browser   │  ─────────────────────▶ │  Vite / React SPA   │
│            │                         │  :5173  (proxy /api)│
└────────────┘                         └──────────┬──────────┘
                                                  │ HTTP + httpOnly JWT
                                                  ▼
                                       ┌─────────────────────┐
                                       │  Express API        │
                                       │  :3001  /api/*      │
                                       └──────────┬──────────┘
                         ┌────────────────────────┼────────────────────────┐
                         ▼                        ▼                        ▼
                ┌─────────────────┐     ┌─────────────────┐      ┌─────────────────┐
                │ Neon Postgres   │     │ Groq Chat API   │      │ bcrypt / JWT    │
                │ Drizzle ORM     │     │ meeting writer  │      │ consist_token   │
                └─────────────────┘     └─────────────────┘      └─────────────────┘
```

The SPA never talks to Groq or Postgres. The API owns extraction, persistence, authorization, and assignment. The frontend is a view over that state, with technical errors mapped to human copy before they reach the UI.

### Runtime topology

| Process | Role | Default |
| --- | --- | --- |
| `frontend/` Vite | React 19 SPA, React Router, `/api` proxy | `http://localhost:5173` |
| `backend/` Express 5 | Auth, domain API, agents | `http://localhost:3001` |
| Neon PostgreSQL | Source of truth | `DATABASE_URL` |
| Groq | Optional LLM writer for task copy | `GROQ_API_KEY` |

If Groq is missing or fails, the meeting agent falls back to transcript heuristics. Persistence and HITL still run.

### Domain model

```
users 1───N projects (owner)
users 1───N project_members (linked account, nullable)
projects 1───N project_members
projects 1───N meetings
projects 1───N actions
meetings 1───N decisions
meetings 1───N actions
users 1───N actions (assignee, nullable)
```

| Entity | Responsibility |
| --- | --- |
| **User** | Authenticated person. Matched to transcript names by exact name (`ilike`). |
| **Project** | Aggregate root. Owns team, meetings, board, and progress. |
| **Project member** | Collaborator on a project. May exist as a name-only placeholder until an account is linked. |
| **Meeting** | Transcript intake. `pending_review` until a human confirms, then `confirmed`. |
| **Decision** | Declarative outcome extracted from the transcript. Not assignable work. |
| **Action** | A task. Drafted as `review_status=pending`, published to the board only after `confirmed`. |

Two status axes on an action are intentional:

| Field | Values | Meaning |
| --- | --- | --- |
| `review_status` | `pending` → `confirmed` \| `rejected` | HITL gate. Unconfirmed rows never appear on the board. |
| `status` | `backlog` → `assigned` → `in_progress` → `review` → `completed` | Team workflow after approval. |
| `priority` | `low` \| `medium` \| `high` | Extracted or edited during review. |

Progress is not stored. It is derived: `completed / confirmed actions` on that project.

### Consistency rules

These are enforced in the API, not only in the UI.

1. **Project first.** `POST /api/meetings` requires `projectId`. The caller must already belong to that project.
2. **Same project on every child.** New meetings write `project_id` onto the meeting and onto every drafted action.
3. **No assignment without membership.** Confirm rejects kept tasks whose owner is not on `project_members`.
4. **Account vs placeholder.** If the member has a `user_id`, the action is `assigned` with `assignee_id`. If they are name-only, the action stays `backlog` until they register or are linked.
5. **Claim on identity.** Register and login call `claimWorkForUser`: matching pending members get `user_id`, and matching confirmed backlog tasks get `assignee_id` and move to `assigned`.
6. **Board writes are scoped.** Status changes require the user to be the assignee, the meeting author, the project owner, or a project member.
7. **Completed is sticky.** Claiming an account never rewinds a completed task.

### Request path (happy path)

```
Login
  → GET /api/projects                         dashboard, progress per project
  → GET /api/projects/:id                     workspace: overview, board, meetings, team
  → POST /api/meetings                        extract (Groq + heuristics) → pending_review
  → GET /api/meetings/:id                     HITL payload (draft tasks + collaborator state)
  → POST /api/projects/:id/members            add missing people (optional)
  → POST /api/meetings/:id/confirm            membership check → publish to board
  → PATCH /api/actions/:id                    move column
  → GET /api/projects/:id                     progress recomputed from confirmed tasks
```

### Backend layers

```
routes/          HTTP, validation, authn/authz, transaction-shaped writes
lib/             access control, board normalization, name matching
agents/          transcript → structured work (no HTTP, no cookies)
middleware/      JWT cookie session
db/              Drizzle schema + Neon HTTP client
```

| Module | What it owns |
| --- | --- |
| `routes/auth.js` | Register, login, logout, session. Password hashing. Claims work on identity events. |
| `routes/projects.js` | Project list with rollups, workspace aggregate, add collaborator. |
| `routes/meetings.js` | Extract, load review, confirm. The HITL write path. |
| `routes/actions.js` | Personal task list and board column updates. |
| `lib/access.js` | Project visibility: owner or linked member. |
| `lib/board.js` | Canonical columns, legacy `open`/`done` mapping, progress helper. |
| `lib/matching.js` | Name → user, claim pending members and unassigned tasks. |
| `agents/meetingAgent.js` | Groq JSON writer + heuristic fallback. Tasks, people, deadlines, priority, decisions. |
| `agents/followUpAgent.js` | Stable `Owner → Task · Deadline` display string. |
| `middleware/auth.js` | `consist_token` httpOnly cookie. |

Unhandled exceptions are logged server-side and returned as `{ error: "Something went wrong" }`. Route handlers catch domain failures and return stable, product-safe strings. The SPA maps those (and any leak of SQL/ORM text) through `friendlyMessage` in `frontend/src/api.js`.

### Frontend layers

```
auth.jsx              session bootstrap via GET /api/auth/me
api.js                fetch wrapper, credentials, error sanitization
pages/                route-level screens
components/           Nav, TaskCard
```

| Route | Screen |
| --- | --- |
| `/` | Marketing landing |
| `/login`, `/register` | Auth |
| `/app` | All projects (create + progress cards) |
| `/app/projects/:id` | Workspace tabs: Overview, Tasks, Meetings, Team |
| `/app/projects/:id/meetings/new` | Meeting intake |
| `/app/projects/:id/meetings/:id` | Human review |

Protected routes wait on session load, then redirect to `/login` if there is no user. The landing page does not flash signed-out CTAs while session is resolving.

### Authn and authz

- Passwords are bcrypt hashes. JWT is signed with `JWT_SECRET` and stored in an httpOnly cookie (`consist_token`), `credentials: 'include'` on every API call.
- CORS is origin-locked to `CLIENT_ORIGIN` with credentials enabled.
- Authorization is project-scoped: list and get only return projects the user owns or is a linked member of. Confirm is restricted to the meeting author. Board moves are restricted as above.

There is no public extraction endpoint. Groq is only invoked after a valid session and a permitted `projectId`.

### Extraction pipeline

```
transcript
  → runMeetingAgent
       ├─ Groq (json_object): members, decisions, actions{owner,task,detail,deadline,priority}
       └─ fallback: speaker/action/decision regex heuristics
  → followUpAgent (display string)
  → INSERT meeting status=pending_review
  → INSERT decisions, actions review_status=pending, status=backlog
  → review UI (edit / keep / skip / add person)
  → confirm
       ├─ upsert project_members
       ├─ reject if kept owner is not on the team
       ├─ confirmed + assignee_id? assigned : backlog
       └─ rejected rows stay off the board
```

AI output is a draft. The database does not treat it as assigned work until confirm.

### Task board state machine

```
                  confirm
pending draft ─────────────► backlog          (on team, no account)
                             assigned         (on team, has account)
                                │
                                ▼
                           in_progress
                                │
                                ▼
                             review
                                │
                                ▼
                           completed  ──► project.progress.percent
```

Moving to `assigned` / `in_progress` / `review` requires `assignee_id`. Completed does not.

---

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | React 19, Vite, React Router | Fast SPA with cookie-aware proxy to the API |
| Backend | Node.js, Express 5, ESM | Thin HTTP layer over domain routes |
| ORM | Drizzle | Typed schema, `drizzle-kit push` to Neon |
| Database | PostgreSQL (Neon) | Shared source of truth |
| Auth | bcrypt + JWT httpOnly cookie | Browser session without exposing tokens to JS |
| LLM | Groq OpenAI-compatible chat | Optional writer; heuristics keep the pipeline offline-capable |

---

## Getting started

### Prerequisites

- Node.js 20 or later
- A PostgreSQL database (Neon is configured locally via `backend/.env`)

### 1. Install dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 2. Configure the API

Copy `backend/.env.example` to `backend/.env` and set:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET` | Secret used to sign session cookies |
| `PORT` | API port (defaults to `3001`) |
| `CLIENT_ORIGIN` | Frontend origin for CORS |
| `GROQ_API_KEY` | Groq key used to understand transcripts and write task copy |
| `GROQ_MODEL` | Optional. Defaults to `openai/gpt-oss-120b` |

### 3. Push the schema

```bash
cd backend
npm run db:push
```

### 4. Run the app

Terminal 1:

```bash
cd backend
npm run dev
```

Terminal 2:

```bash
cd frontend
npm run dev
```

Open the Vite URL (usually `http://localhost:5173`). The frontend proxies `/api` to Express, so cookies stay first-party in development.

## Using Consist

1. Create an account. Use the same first name that appears in transcripts if you want auto-linking (for example, `Anil`).
2. Create a project from the dashboard and open it.
3. Add teammates, or add them during review if the transcript names someone new.
4. Open **Meetings → Add meeting**, paste a transcript, and extract tasks.
5. Edit the draft, add missing people, then **Approve**. Work appears on the project board.
6. Move tasks across Backlog, Assigned, In progress, Review, and Completed. Overview shows project progress.

A sample transcript is included on the new-meeting page.

## API surface

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness |
| `POST` | `/api/auth/register` | Create an account, set session, claim matching work |
| `POST` | `/api/auth/login` | Sign in, claim matching work |
| `POST` | `/api/auth/logout` | Clear session cookie |
| `GET` | `/api/auth/me` | Current session |
| `GET` | `/api/projects` | Projects you own or belong to, with progress |
| `POST` | `/api/projects` | Create a project and join as owner |
| `GET` | `/api/projects/:id` | Workspace aggregate: members, meetings, board, progress |
| `POST` | `/api/projects/:id/members` | Add or link a collaborator |
| `POST` | `/api/meetings` | Extract a transcript into `pending_review` (`projectId` required) |
| `GET` | `/api/meetings/:id` | Load HITL review (draft + collaborator state) |
| `POST` | `/api/meetings/:id/confirm` | Approve after team membership is complete |
| `GET` | `/api/actions` | Confirmed tasks assigned to the current user |
| `PATCH` | `/api/actions/:id` | Move a task on the board |
| `GET` | `/api/users` | Directory used for name matching |

## Repository layout

```
Consist/
├── backend/
│   ├── agents/            Meeting writer + follow-up formatter
│   ├── db/                Drizzle schema and Neon client
│   ├── lib/               Access, board status, identity matching
│   ├── middleware/        JWT cookie auth
│   ├── routes/            Auth, projects, meetings, actions
│   ├── drizzle.config.js
│   └── index.js           HTTP bootstrap
└── frontend/
    └── src/
        ├── api.js         Fetch + sanitized errors
        ├── auth.jsx       Session provider
        ├── pages/         Landing, dashboard, workspace, intake, review
        └── components/    Nav, TaskCard
```

## License

Private project. All rights reserved.
