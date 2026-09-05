# MicroWorkout

An invite-only, offline-first workout planner and guided session tracker built with Next.js, Neon PostgreSQL, Better Auth, Drizzle, Dexie, and Serwist.

## Local development

```bash
npm install
npm run dev
```

Without credentials, development runs as a local-only demo. For authentication and synchronization, copy `.env.example` to `.env.local`, configure Neon and Google OAuth, then run:

```bash
npm run db:migrate
npm run dev
```

Set the Google callback URL to `http://localhost:3000/api/auth/callback/google`. Use the deployed equivalent in production.

## Checks

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Production requires every variable in `.env.example`. `OWNER_EMAIL` is the protected initial administrator.
