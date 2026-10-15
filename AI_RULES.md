# AI_RULES.md

Rules every AI coding task in this repository must follow. Read `docs/guide.md` and this file before starting any task.

## Data

- Money is stored as integers in **halalas** (1 SAR = 100 halalas), never as floats. Prices are in SAR. Field names end in `_halalas` (database) or `Halalas` (TypeScript/Dart).
- Times are stored in **UTC**. Apps show **Saudi time (UTC+3, `Asia/Riyadh`)**.
- Translated text is stored per language (`title` as a JSON object keyed by language code: `ar`, `en`, `ur`, `id`, `ms`, `tr`). Never translate prices or names on the fly.
- Every status change (booking, order, bag, alert, provider) writes a row to `status_events`. Never update a status without it.
- Sample data has `isSample = true`. Code that touches real data in production must ignore sample rows.
- Bag scans are append-only: never edit or delete a scan; add a correction scan instead.

## Text and layout

- No hard-coded user-facing text. Every string goes in translation files (`apps/web/messages/*.json`, `apps/mobile/lib/l10n/*.arb`, API error codes in `packages/shared`).
- Every screen works right-to-left (Arabic, Urdu). Use logical properties (`start`/`end`), never `left`/`right`.
- Body text at least 16 px, buttons at least 48 px tall, icons always with labels.

## Security

- Never commit secrets. Read them from environment variables (see `.env.example`).
- Every endpoint declares its roles. A pilgrim must never see another pilgrim's data; a provider only their own bookings and orders.
- Never log phone numbers, locations or personal data.

## Working

- One feature per task. Don't change unrelated files.
- Write tests with each feature: every status transition, every money calculation.
- Keep API responses small; paginate lists.
- Describe every endpoint in OpenAPI (`@nestjs/swagger` decorators).
