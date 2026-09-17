# Consist

Consist turns meeting transcripts into owned project work. A project holds the team, meetings, and task board together, so assignments and progress stay consistent.

## Why it exists

Most meeting tools stop at a summary. Consist is built for follow-through: a transcript is reviewed by a human, people are added to the project if they are missing, then tasks land on a board that rolls up to project progress.

## How it works

```
Login
  → Dashboard (all projects)
  → Project workspace (Overview | Tasks | Meetings | Team)
  → Add meeting (title, date, participants, transcript)
  → AI extract (tasks, people, deadlines, priority, decisions)
  → Human review and edits
  → Collaborator check (add anyone who is not on the team)
  → Approve
  → Task board (Backlog → Assigned → In progress → Review → Completed)
  → Project progress
```

1. **Project** — Everything belongs to a project. Create one from the dashboard, then open its workspace.
2. **Meeting** — Add a transcript inside that project. Consist drafts tasks, people, deadlines, priority, and decisions.
3. **Review** — Keep, skip, or edit each item. If an owner is not on the team, add them before you can approve.
4. **Board** — Approved work is created on the project board. People with accounts go to Assigned; people still joining stay in Backlog until they sign in.
5. **Progress** — Moving a task to Completed updates the project’s progress.

Unlinked names stay on the team as pending collaborators. When that person later registers or signs in with a matching name, Consist claims their open work.

## Features

- Email/password authentication with httpOnly session cookies
- Project-first workspace with overview, board, meetings, and team
- Meeting intake with title, date, participants, and transcript
- Groq-powered extraction of tasks, people, deadlines, priority, and decisions
- Human-in-the-loop review with edits before anything is assigned
- Collaborator check: existing teammates are ready to assign; missing people are added first
- Task board shared by the whole project
- Project progress derived from completed tasks

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | React 19, Vite, React Router |
| Backend | Node.js, Express 5 |
| ORM | Drizzle |
| Database | PostgreSQL (Neon) |
| Auth | bcrypt password hashes, JWT in httpOnly cookies |

## Getting started

### Prerequisites

- Node.js 20 or later
- A PostgreSQL database (Neon is already configured for local development via `backend/.env`)

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

Open the Vite URL (usually `http://localhost:5173`). The frontend proxies `/api` to the Express server.

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
| `POST` | `/api/auth/register` | Create an account |
| `POST` | `/api/auth/login` | Sign in |
| `POST` | `/api/auth/logout` | Sign out |
| `GET` | `/api/auth/me` | Current session |
| `GET` | `/api/projects` | Projects you own or belong to, with progress |
| `POST` | `/api/projects` | Create a project and join as owner |
| `GET` | `/api/projects/:id` | Project members, meetings, board, and progress |
| `POST` | `/api/projects/:id/members` | Add a collaborator |
| `POST` | `/api/meetings` | Extract a transcript into pending review (requires `projectId`) |
| `GET` | `/api/meetings/:id` | Load a review |
| `POST` | `/api/meetings/:id/confirm` | Approve tasks after collaborators are on the team |
| `GET` | `/api/actions` | Confirmed tasks assigned to you |
| `PATCH` | `/api/actions/:id` | Move a task on the board |

## Repository layout

```
Consist/
├── backend/          Express API, Drizzle schema, agents
│   ├── agents/       Meeting + follow-up extraction
│   ├── db/           Drizzle client and schema
│   └── routes/       Auth, meetings, projects, actions
└── frontend/         React workspace (landing, projects, review, board)
```

## License

Private project. All rights reserved.
