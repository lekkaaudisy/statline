# Statline

A whole-life quest app. See `CLAUDE.md` for the rules and `docs/BUILD_PLAN.md` for the build order.

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
- `supabase/migrations/` — database changes (from Slice 1)
- `public/icons/` — placeholder app icons
