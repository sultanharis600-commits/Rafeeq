# Decisions

Short records of choices that differ from, or add to, the guide. Newest first.

## 2026-10-15 · Testing login without a code

For testing, the web tools and the app log in with just a phone number or email (`POST /v1/auth/quick-login`), with no code. It is controlled by `QUICK_LOGIN`, which follows `DEMO_MODE` and cannot be on without it (the API refuses to start). Anyone who can reach a server with it on can log in as any account, admins included, so keep test servers private and set `QUICK_LOGIN=false` (or `DEMO_MODE=false`) on anything shared outside the team. Role checks are unchanged: a pilgrim still can't open admin pages. Phone + code login stays in place and comes back automatically when quick login is off. Users gained an optional, unique `email` column.

## 2026-10-13 · Things to check before launch (from building the MVP)

- **Map tiles:** the app draws OpenStreetMap tiles for the demo. OSM's tile servers are not for production app traffic, and tiles don't work offline. Places, walking routes and the route drawing already come from the offline map pack, so lists and directions work without network; before launch, switch the map widget to MapLibre (or Mapbox) with downloaded tiles, as the guide says.
- **Bluetooth library licence:** the finder uses `flutter_blue_plus` (scanning) and `flutter_ble_peripheral` (advertising). Newer `flutter_blue_plus` releases changed their licence terms for commercial use; check the licence of the version you ship, or pin a version whose licence fits.
- **Bluetooth manufacturer ID:** Android advertises the rotating ID under manufacturer ID `0xFFFF`, which is reserved for testing. Register a Bluetooth SIG company ID (or move the ID into service data) before launch.
- **Background location:** the app records the last known location while it is open or in recent apps. Recording with the app fully closed needs Android foreground-service and iOS background-mode setup and store review notes (see the Lost Companion guide).
- **Emergency numbers** on the Help screen (911 unified emergency, 997 Red Crescent): confirm with the Ministry before launch.
- **Translations:** all non-English app text is a draft in `apps/mobile/tool/strings.py` and `apps/web/messages/`. Native speakers approve each language.

## 2026-10-13 · Not in the MVP

- **Chat with providers:** the Chat tab is left out of the MVP (it is not in the guide's MVP table). Pilgrims call the driver or provider from the booking; staff call the pilgrim from the job.
- **Google and Apple sign-in:** phone OTP only for the MVP.
- **Push notifications:** notifications are stored in-app, sent over the WebSocket, and recorded in the outbox (`/admin/outbox`). Firebase push is wired in after the MVP.
- **Real SMS:** outbound SMS are recorded in the outbox in demo mode; the inbound webhook (`POST /v1/sms/inbound`) is ready for the SMS provider.

## 2026-10-13 · Scheduled jobs run inside the API, not BullMQ

The guide suggests BullMQ on Redis. The MVP runs its jobs with `@nestjs/schedule` inside the API process: payment holds and acceptance timeouts (every minute), overdue bags (every 5 minutes), daily reconciliation, weekly payouts (Monday 03:00 Riyadh time) and location deletion. Jobs are switched off with `JOBS_ENABLED=false` (tests). With more than one API instance, move them to BullMQ so each runs once; Redis is already in `docker-compose.yml`.

## 2026-10-13 · Staging deploy target still open

CI builds and publishes API and web images to GitHub Container Registry on every push to `main` (`.github/workflows/staging.yml`). The deploy step itself is a placeholder until the hosting provider in the Saudi region is chosen (needed for PDPL data residency).

## 2026-10-13 · Drizzle ORM instead of Prisma

The guide suggests Prisma. We use Drizzle ORM because Prisma needs engine binaries downloaded from `binaries.prisma.sh` at install time, which the build environment could not reach, so nothing could be migrated or tested. Drizzle is pure TypeScript, has no binary downloads, generates plain SQL migrations (`apps/api/drizzle/`), and keeps the same data model. Switching back later means porting `src/db/schema.ts` to a Prisma schema; the tables and columns stay the same.

## 2026-10-13 · API is an ES module; tests use Vitest

NestJS 12 ships as ES modules. The API follows NestJS's ESM template: `"type": "module"`, `.js` extensions on relative imports, and Vitest instead of Jest (Jest cannot load the ESM NestJS packages on Node 22).

## 2026-10-13 · Sample data location

The guide puts seed files in `apps/api/prisma/seed/`. With Drizzle they live in `apps/api/src/db/seed/data/*.json`, loaded by `npm run seed`. Every row is flagged `is_sample`, and IDs are derived from each record's key so demo links stay stable.

## 2026-10-13 · Money and translations

- Money columns end in `_halalas` and are integers. Commission rates are basis points (`1500` = 15%), rounded half-up so commission + provider net always equals the gross.
- Translated text is a JSON object per language (`{ en, ar, ur, id, ms, tr }`). English is required; the apps fall back to English for a missing language. Sample translations are drafts for native-speaker review.
