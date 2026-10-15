# Rafeeq

Bidec's marketplace where Saudi providers sell services and gifts to pilgrims. See [`docs/guide.md`](docs/guide.md) for the product and build guide, and [`AI_RULES.md`](AI_RULES.md) for the rules every change follows.

| Folder | What | Stack |
| --- | --- | --- |
| `apps/api` | Backend: REST + WebSocket, OpenAPI docs | NestJS 12, Drizzle ORM, PostgreSQL 16, Redis |
| `apps/web` | Provider dashboard and admin panel (Arabic, English) | Next.js 16, Tailwind CSS 4, next-intl |
| `apps/mobile` | Pilgrim app and staff mode (6 languages) | Flutter |
| `packages/shared` | Types, status machines, money helpers, design tokens | TypeScript |
| `docs` | Guide, decisions, demo accounts | |

## Run it locally

Needs Node 22+, Docker, and Flutter (stable) for the mobile app.

```bash
npm install
npm run db:up                      # Postgres + Redis in Docker
cp apps/api/.env.example apps/api/.env
npm run build -w packages/shared
npm run db:migrate                 # create tables
npm run seed                       # load the sample data (resets the demo in ~2 s)
npm run dev:api                    # http://localhost:3000 · docs at /docs
npm run dev:web                    # http://localhost:3001
```

Mobile: see [`apps/mobile/README.md`](apps/mobile/README.md).

Demo logins are in [`docs/demo-accounts.md`](docs/demo-accounts.md). For testing, log in with just a phone number or email, no code (`QUICK_LOGIN`, on by default in demo mode and refused without it). The 15-minute demo, screen by screen, is in [`docs/demo-script.md`](docs/demo-script.md); `apps/api/test/demo-script.e2e-spec.ts` runs the same steps automatically.

## What's in the MVP

All features from the guide's MVP table, on sample data: the services marketplace (6 categories, sandbox payments, refunds, commission, weekly payouts, sample invoices), provider dashboard and admin panel (Arabic and English), baggage tracking with QR tags and lost-bag cases, the gifts shop with hotel delivery and shipping home, the shopping places guide, accessibility mode with step-free walking routes and voice, and Lost Companion (travel groups, last known location, I'm lost by app or SMS, Bluetooth finder, tracker tag guide). Compliance work (licences, ZATCA, PDPL, live payments) comes next; see the guide and [`docs/decisions.md`](docs/decisions.md).

## Checks

```bash
npm run lint
npm run typecheck
npm test                           # unit tests
npm run test:e2e -w apps/api       # integration tests (needs Postgres)
```

CI runs all of these on every pull request, plus `flutter analyze` and `flutter test`, and fails if the database schema or `openapi.json` changed without being regenerated.

## Database changes

Edit `apps/api/src/db/schema.ts`, then:

```bash
npm run db:generate -w apps/api    # writes a SQL migration to apps/api/drizzle/
npm run db:migrate
```

Commit the migration with the schema change.

## Demo mode

The app runs in demo mode (sandbox payments, sample data, test phone numbers) until the compliance checklist in the guide is done. The seed refuses to run in production, without `DEMO_MODE=true`, or on a database holding non-sample users.
