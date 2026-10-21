# GroupGetter

Find things to do around Ohio State, and people to do them with.

**Live site:** https://cse-5914.vercel.app

GroupGetter pulls upcoming concerts, games, shows and other events near campus from Ticketmaster, recommends them based on each student's interests, and lets students form groups and RSVP together. Built by an OSU CSE 5914 team.

## Features

- **Personalized home page**: an AI assistant ("What are you doing this week?") plus events picked from your interests
- **Events**: browse by category, search and filter by location, create your own events, RSVP
- **Groups**: open or approval-based groups, member roles, group events
- **Profiles**: interests, free times, event size and travel distance shape your recommendations
- **Always fresh**: Ticketmaster events sync automatically every day

## Tech stack

| Part | Tech |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| Backend | Python 3.12, FastAPI |
| Database & storage | Supabase (Postgres) |
| AI assistant | OpenAI |
| Event data | Ticketmaster Discovery API |
| Hosting | Vercel (frontend + FastAPI as a serverless function) |
| Scheduled jobs | GitHub Actions |

## How it fits together

```
Browser ──► Vercel
             ├─ /         React app (frontend/)
             └─ /api/*    FastAPI (api/index.py → backend/main.py)
                              │
                              ▼
                          Supabase Postgres ◄── GitHub Action (daily 5am ET)
                                                 backend/utils/sync_events.py
                                                 ◄── Ticketmaster API
```

## Running it locally

You need [uv](https://docs.astral.sh/uv/getting-started/installation/) and Node.js 20+.

1. **Install dependencies**
   ```bash
   uv sync
   cd frontend && npm install
   ```
2. **Add environment files** (ask a teammate for the values; never commit them):
   - `backend/.env`
     - Database: `DB_USER`, `PASSWORD`, `HOST`, `PORT`, `DB_NAME` (use Supabase's **Session pooler** connection)
     - Supabase: `SUPABASE_URL`, `SUPABASE_KEY`
     - Auth: `JWT_SECRET` (random, 32+ characters; the API won't start without it), `ENCRYPTION_KEY`
     - Email (verification): `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM`, `MAIL_PORT`, `MAIL_SERVER`, `MAIL_FROM_NAME`
     - APIs: `TICKETMASTER_API_KEY`, `OPENAI_API_KEY`
     - `WEBSITE_URL` (where the frontend runs, e.g. `http://localhost:5173`)
   - `frontend/.env.local`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
3. **Start the backend** (port 8000):
   ```bash
   source .venv/bin/activate
   cd backend && fastapi dev main.py
   ```
4. **Start the frontend** (port 5173, proxies `/api` to the backend):
   ```bash
   cd frontend && npm run dev
   ```

To run only the frontend against the live API instead, add `VITE_WEBSITE_URL=https://cse-5914.vercel.app` to `frontend/.env.local`.

## Event sync

`backend/utils/sync_events.py` pulls up to 1,000 Ticketmaster events within 30 miles of campus and upserts them into `event_options`.

- **Automatic:** `.github/workflows/sync-events.yml` runs it every day at 5am Columbus time. It uses these repo secrets: `TICKETMASTER_API_KEY`, `DB_USER`, `PASSWORD`, `HOST`, `PORT`, `DB_NAME`.
- **Manual:** GitHub → **Actions** → **Sync Ticketmaster events** → **Run workflow**, or locally:
  ```bash
  python backend/utils/sync_events.py
  ```
- GitHub pauses scheduled workflows after 60 days without commits. Re-enable it from the Actions tab if that happens.

## Categories

Events use 8 categories built around Ticketmaster's data: **Concerts, Nightlife & DJs, Sports, Musicals, Plays & Dance, Comedy & Shows, Family & Holiday, Other**. `map_category` in `backend/utils/ticketMaster.py` maps Ticketmaster's segment, genre and subgenre to them. The category list lives in the `categories` table (see `backend/migrations/`).

## Project structure

```
api/            Vercel entry point for the FastAPI app
backend/        FastAPI routers (events, groups, accounts, chat, preferences)
  sql_queries/  SQL used by the routers
  utils/        DB, auth, rate limits, Ticketmaster sync
  migrations/   One-off SQL migrations
frontend/       React app
  src/Screens/  Pages
  src/components/  Shared UI, event and group components
  src/styles/   CSS (Midnight dark theme tokens in variables.css)
.github/workflows/  Daily event sync
```

## Team

Built for CSE 5914 at The Ohio State University by
[@Aaron-Dhillon](https://github.com/Aaron-Dhillon),
[@guipiacsek](https://github.com/guipiacsek),
[@Mattwike](https://github.com/Mattwike),
[@langenbahn-11](https://github.com/langenbahn-11),
[@benvarkey222](https://github.com/benvarkey222) and
[@huangxuyan1](https://github.com/huangxuyan1).
