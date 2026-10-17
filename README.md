# Statline

A whole-life quest app. See `CLAUDE.md` for the rules and `docs/BUILD_PLAN.md` for the build order.

## Environment variables

Copy `.env.example` to `.env.local` and fill in the two values from Supabase
(Project Settings > Data API for the URL, Project Settings > API Keys for the
publishable key). Add the same two variables in Vercel under Settings >
Environment Variables. Never use the secret or service_role key, and never
commit `.env.local`.

## Database

Migrations live in `supabase/migrations/`. Apply a new one by pasting the whole
file into Supabase > SQL Editor > New query and clicking Run, once.

## Run it

```bash
npm install
npm run dev     # open http://localhost:3000
npm test        # run the unit tests
npm run lint    # check code style
npm run build   # production build (what Vercel runs)
```

## Folders

- `app/` — screens (Next.js App Router)
- `lib/game/` — pure game logic, with tests. Tunable numbers go in `lib/game/constants.ts`.
- `lib/supabase/` — Supabase connections (server and proxy)
- `lib/auth/` — which pages need a login, with tests
- `supabase/migrations/` — database changes
- `public/icons/` — placeholder app icons
