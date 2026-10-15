# Rafeeq – Product Development Guide

Oct 13, 2026 · @haris

## Overview

This guide explains how to build Rafeeq (App 2), Bidec's marketplace where Saudi providers sell services and gifts to pilgrims and Bidec earns a commission. It follows the *Rafeeq Services Marketplace – Product & Features Spec*, including the features added from the Hajj Future Innovations Camp, and launches in Makkah first, then Madinah.

**MVP scope (decided 13 Oct):** the MVP includes every main feature — marketplace, baggage tracking, gifts shop, shopping places guide, Lost Companion and the elderly and accessibility guide — running on sample data, so the whole product can be demonstrated. Compliance work (licences, ZATCA, PDPL, live payments) comes after the MVP, before any real pilgrim or real money uses the app.

**What is in Rafeeq**

| Area | Contents |
| --- | --- |
| Service marketplace | Transport, certified guides, personal photography, luggage services, accessibility help |
| Baggage tracking | Tag on each bag, scan at every handover, live status, lost-bag reports |
| Elderly and disabled pilgrims | Accessibility mode, offline walking directions, companion and wheelchair booking, Lost Companion |
| Gifts shop | Makkah gifts, Madinah gifts and dates, delivered to the hotel or shipped home |
| Shopping places guide | Map of places to buy gifts and dates, linked to their online shops |
| Guide tab | Prayer times, Qibla, holy sites map, walking directions, shopping places |

**What is not in Rafeeq**

- **Zuyarah app** (already in progress): the trip after the rituals — heritage sites, tours and cultural experiences. Rafeeq's *Heritage tours* category links to it.
- **App 1** (heritage guide, pharmacy and childcare): built first; Rafeeq reuses its backend core (login, payments, maps, admin panel).
- **Out of scope:** full Umrah and Hajj packages, visas and flights, which need licensed Umrah companies and the Nusuk platform.

**Companion guide:** the [Lost Companion Feature – Development Guide](https://claude.ai/code/artifact/9c892bd5-556c-4fbf-b5f9-f87d2212e5fd) covers that feature in full; this guide only summarises it.

## Architecture

&#91;embedded content: Rafeeq architecture · 4 apps, 13 backend modules, 6 outside services\]

All four apps call the same backend through one API; the highlighted modules are the ones added for baggage tracking, Lost Companion, the gifts shop and the shopping guide. Auth, payments, maps and admin come from App 1's backend core.

## Team, tools and working setup

A team of about seven people can ship the MVP; the roles below are a suggestion to adjust to Bidec's staff.

| Role | Count | Owns |
| --- | --- | --- |
| Product manager | 1 | Spec, priorities, provider onboarding with operations |
| UI/UX designer | 1 | Screens in 6 languages, right-to-left layouts, accessibility mode |
| Mobile developers | 2 | Pilgrim app and staff app (shared codebase), native Bluetooth and SMS modules |
| Web developer | 1 | Provider dashboard and admin panel |
| Backend developer | 1–2 | API, payments, invoicing, tracking, integrations |
| QA engineer | 1 | Test plans, device matrix, field tests |

Bidec operations staff verify providers and handle support; they are not part of the build team but need the admin panel early.

**Building the MVP with AI:** one or two developers working with an AI coding assistant can replace most of the developer roles above (see the next section). Keep a human for design review, QA on real devices, and native-speaker checks of translations.

**Working setup**

- **Code:** one Git repository per app (pilgrim/staff mobile, web dashboard, backend), or one monorepo; protect the main branch, require a pull request with one review.
- **Environments:** *dev* (shared, daily deploys), *staging* (copy of production with test payments), *production* (Saudi region). Never use real pilgrim data outside production.
- **CI/CD:** run tests and linting on every pull request; deploy backend and web automatically to staging; ship mobile builds to TestFlight and Google Play internal testing.
- **Tracking work:** two-week sprints, a board per phase (see Build plan), a demo to stakeholders at the end of each sprint.
- **Design files:** one shared design system (colours, type, components) used by both mobile and web, from the branding in the spec: deep green or teal, sand and gold accents, IBM Plex Sans Arabic or Tajawal with Inter.
- **Documentation:** API described in OpenAPI and generated from the backend; one short README per repository on how to run it locally.

## Building the MVP with AI

The stack is fixed: **Flutter** for the pilgrim and staff app, **NestJS** for the backend, **Next.js** for the provider dashboard and admin panel. AI writes most of the code; you decide, review and test.

**Repository layout (one monorepo)**

```
rafeeq/
  apps/
    api/        NestJS backend (REST + WebSocket, OpenAPI docs)
    web/        Next.js: provider dashboard + admin panel
    mobile/     Flutter: pilgrim app + staff mode
  packages/
    shared/     TypeScript types and validation shared by api and web
  docs/         spec, this guide, API notes, decisions
  AI_RULES.md   rules the AI must follow (below)
```

The mobile app gets its API client generated from the backend's OpenAPI file, so Flutter and NestJS never drift apart.

**Suggested libraries**

| Part | Choice |
| --- | --- |
| NestJS | Prisma (database), `@nestjs/swagger` (OpenAPI), BullMQ on Redis (jobs: payouts, reminders, reconciliation), Socket.IO gateway (live status) |
| Next.js | App Router, Tailwind CSS with shadcn/ui, `next-intl` for Arabic and English with right-to-left |
| Flutter | Riverpod (state), `go_router` (navigation), `dio` + OpenAPI-generated client, `drift` (offline SQLite cache), `firebase_messaging` (push), `mobile_scanner` (bag QR codes), `flutter_localizations` for six languages |
| Payments | The chosen gateway's official Flutter SDK and server API; check it supports split payments before building |

**Rules file for the AI (`AI_RULES.md`)**

Give the AI the spec, this guide and a short rules file at the start of every task:

- Money in integer halalas, never floats; prices in SAR.
- Times stored in UTC, shown in Saudi time.
- No hard-coded text: every string in translation files; every screen works right-to-left.
- Every status change writes an event row.
- Never commit secrets; read them from environment variables.
- Write tests with each feature; don't change unrelated files.

**Build order (one feature per AI task, reviewed before the next)**

1. Scaffold the monorepo, CI (lint, tests), Docker for Postgres and Redis, staging deploy, seed script.
2. API: auth (phone OTP with test codes), users, roles, demo mode flag.
3. API: providers, catalogue, availability, bookings and statuses.
4. API: payments in the gateway sandbox, refunds, commission, payouts job.
5. Web: provider dashboard and admin panel.
6. Mobile: language choice, login, home, search, service details, booking, checkout, my bookings.
7. Baggage tracking: bag tags, staff scanner, bag timeline, lost-bag cases.
8. Elderly and accessibility: accessibility mode, assistance bookings, offline map with walking routes.
9. Lost Companion: travel groups, last known location, I'm lost with SMS, Bluetooth finder, tag setup guide.
10. Gifts shop and shopping places guide: products, cart, orders, delivery status, places map.
11. Load the sample data, run the demo script end to end, fix what breaks.

**Example task prompt**

```
Read docs/spec.md, docs/guide.md and AI_RULES.md.
In apps/api, build the bookings module: entities, statuses
(pending_payment → paid → accepted → in_progress → completed
→ paid_out, plus declined, cancelled, refunded, disputed),
slot capacity hold for 10 minutes during payment, and REST
endpoints with OpenAPI docs. Add unit tests for every status
change and the capacity hold. Don't touch other modules.
```

**Where AI needs extra human care**

- **Payments, refunds and payouts:** check every amount by hand on test cases; AI often gets rounding and edge cases wrong.
- **Security:** review permission checks on every endpoint (a pilgrim must never see another pilgrim's booking).
- **ZATCA invoicing and compliance:** follow ZATCA's documentation and a certified provider, not the AI's memory.
- **Native features** (Bluetooth, SMS, background location for Lost Companion): test on real phones; these break in ways the AI can't see.
- **Translations:** AI drafts, native speakers approve.
- **App store submissions:** review notes and permission texts written and checked by you.

## Backend: modules and data model

Build one backend (a modular monolith) with clear modules, not microservices: one team, one database, and modules that can be split out later if needed. Stack: NestJS, PostgreSQL, Redis, REST plus WebSockets for live updates.

**Modules**

| Module | Responsibility | Reused from App 1? |
| --- | --- | --- |
| Auth and users | Phone OTP, Google and Apple sign-in, profiles, roles | Yes |
| Providers | Onboarding, documents, verification status, staff, vehicles | New |
| Catalogue | Categories, services, options, prices, availability | New |
| Bookings | Booking lifecycle, assignment to staff, cancellations | New |
| Payments and payouts | Gateway, split payments, refunds, weekly payouts | Yes (extend for split payments) |
| Invoicing | ZATCA e-invoices with VAT | Yes (or Bidec ERP) |
| Shop | Products, stock, cart, orders, delivery and shipping | New |
| Baggage tracking | Tags, handover scans, bag status, lost-bag cases | New |
| Groups and safety | Travel groups, location points, lost alerts, SMS webhook | New |
| Places | Holy sites, shopping places, gates, lost-and-found points; offline map packs | Partly (maps) |
| Messaging | In-app chat with machine translation, push, SMS, email | Partly |
| Reviews | Ratings and reviews for services and shops | New |
| Admin and audit | Admin roles, every admin action logged | Yes |

**Core tables (simplified)**

| Table | Key fields |
| --- | --- |
| `users` | id, phone, name, language, nationality, role |
| `providers` | id, type (company / individual), cr\_number, status (pending / approved / suspended), iban, commission\_rate |
| `services` | id, provider\_id, category, title (per language), price\_sar, duration, options, languages\_spoken, service\_area |
| `availability_slots` | service\_id, start, end, capacity, booked |
| `bookings` | id, pilgrim\_id, service\_id, slot, options, total\_sar, status, assigned\_staff\_id |
| `payments` | id, booking\_id or order\_id, gateway\_ref, amount, status, refunded\_amount |
| `payouts` | id, provider\_id, period, gross, commission, net, status |
| `products` | id, shop\_id, category (Makkah gifts / Madinah gifts / dates), title, price\_sar, stock, weight\_g, ships\_abroad |
| `orders` and `order_items` | id, pilgrim\_id, delivery\_type (hotel / international), address, status, tracking\_number |
| `bags` and `bag_scans` | bag tag\_code, booking\_id, owner; scan: bag\_id, place, staff\_id, time, status |
| `travel_groups`, `group_members`, `location_points`, `lost_alerts` | as in the Lost Companion guide |
| `places` | id, type (holy site / shopping / gate / lost-and-found), name (per language), lat, lng, hours |
| `reviews` | id, target (service / shop), rating, text, language |

**Rules for the backend**

- Store money as integers in halalas, never as floats.
- Store translated text per language (`title_ar`, `title_en`… or a translations table); never translate prices or names on the fly.
- Every status change (booking, order, bag, alert) writes an event row, so support can see the full history.
- Times in UTC in the database; show Saudi time (UTC+3) in the apps.

## Pilgrim app: screens and build notes

One Flutter codebase for iOS and Android (plus a web version later), with six bottom tabs: Home, Bookings, Shop, Chat, Guide, Profile.

| Tab | Main screens | Build notes |
| --- | --- | --- |
| Home | Search, category icons, offers, "near you" providers | Large icons with labels; cache the home feed for weak networks |
| Bookings | Upcoming and past bookings, booking details, live driver tracking, bag status | WebSocket for live status; works read-only from cache offline |
| Shop | Makkah gifts, Madinah gifts, dates; product page; cart; checkout; order tracking | Separate cart from service bookings; one checkout and payment flow |
| Chat | Conversations with providers, auto-translated | Show original and translation; queue messages when offline |
| Guide | Prayer times, Qibla, holy sites map, walking directions, shopping places guide | Offline map pack per city; prayer times computed on the phone |
| Profile | Language, payment methods, travel group, emergency contacts, accessibility mode, help | Accessibility mode switches text size and simplifies screens app-wide |

The "I'm lost" button sits on the Home screen and as a lock-screen widget for group members (see Lost Companion).

**Onboarding (first launch)**

1. Choose language (first screen, before anything else).
2. Phone number and OTP, or Google or Apple sign-in.
3. Travel dates, city and hotel (from a list, with map pick as fallback).
4. Optional: join or create a travel group, turn on accessibility mode.

**Booking in three screens:** service details → options and date → pay. Show the full price, refund policy and verified badge before the pay button.

**Build notes**

- **State and caching:** keep bookings, orders, the group and the offline map on the phone so the app opens instantly near the Haram.
- **Deep links:** every booking, order and provider has a link, used in push, SMS and WhatsApp messages.
- **Analytics:** track the funnel search → service → booking started → paid; never log location or personal data in analytics.
- **Crash reporting:** Firebase Crashlytics or Sentry from the first internal build.

## Provider dashboard, staff app and admin panel

The two web tools share one Next.js codebase with role-based screens; the staff app is a mode of the pilgrim mobile app, opened with a staff login.

**Provider dashboard (web, Arabic and English)**

| Area | MVP | Added for new features |
| --- | --- | --- |
| Onboarding | Sign up, upload Commercial Registration or ID, licences, IBAN; wait for approval | Shops: product categories they sell, shipping options |
| Listings | Services with photos, SAR prices, options, languages, service area | Products: photos, price, stock, weight, ships abroad yes/no |
| Availability | Calendar, time slots, capacity, blocked dates | — |
| Bookings and orders | Accept or decline, assign to staff, status | Orders: pack, hand to courier, enter tracking number |
| Staff and fleet | Drivers, guides, vehicles | Luggage staff who scan bags |
| Payments | Earnings, commission, payouts, ZATCA invoices | Product sales in the same statement |
| Reviews and reports | Reply to reviews; bookings, revenue, cancellations | Bag scans and lost-bag cases for luggage providers |

**Staff app (mobile)**

- Today's jobs with navigation, start and complete job, chat with the pilgrim.
- **Bag scanner:** scan the bag tag with the camera (QR) or tap (NFC), pick the handover point, confirm. Works offline and syncs later.
- Assistance jobs: companion or wheelchair help, with the pilgrim's meeting point and accessibility notes.

**Admin panel (web)**

- Provider and shop verification, catalogue rules, suspensions.
- Bookings, orders and refunds; dispute and support tickets.
- Commission per category or provider; payout runs and reconciliation.
- Lost-bag cases and open lost-person alerts (counts and age; locations only when a family asks for help, every view logged).
- Places management: add or edit shopping places, gates and lost-and-found points; publish new offline map packs.
- Content: banners, offers, push campaigns, help articles, translations.
- Reports: bookings, gross booking value, commission, shop sales, active providers, top nationalities.
- Admin roles (operations, finance, support) and a full audit log.

## Bookings, payments and invoices

The pilgrim pays when booking or ordering, a licensed gateway holds the money, and the provider is paid only after delivery, minus Bidec's commission.

**Booking statuses**

`pending_payment` → `paid` → `accepted` → `in_progress` → `completed` → `paid_out`, with side exits `declined`, `cancelled`, `refunded`, `disputed`.

- If the provider declines or doesn't answer within the timeout (for example 30 minutes), offer the pilgrim another provider or a full refund automatically.
- Hold capacity on the slot during payment for a few minutes, then release it if payment fails.

**Shop order statuses**

`paid` → `packed` → `out_for_delivery` (hotel) or `shipped` (abroad, with tracking number) → `delivered`, with `cancelled` and `refunded`.

**Payments**

| Step | How |
| --- | --- |
| Methods | Card, mada, Apple Pay, STC Pay (from the spec) |
| Gateway | HyperPay, Moyasar or Tap, chosen for split-payment or marketplace support |
| Holding funds | The gateway holds funds; Bidec never keeps pilgrim money in its own account |
| Payouts | Weekly, to the provider's IBAN, for completed bookings and delivered orders |
| Commission | 10–20% per category, set in the admin panel; first 3 months free for early providers |
| Refunds | Follow each category's cancellation policy; back to the original payment method |
| Reconciliation | A daily job compares gateway reports with bookings, orders and payouts and flags mismatches |

**Invoices.** Every paid booking and order issues a ZATCA-compliant e-invoice with VAT, through Bidec ERP or a ZATCA-certified provider. Decide early who is the seller on the invoice (the provider, with Bidec invoicing its commission) and confirm it with a tax adviser.

## Baggage tracking

Every bag booked through a Rafeeq luggage service gets a tag, and every handover is scanned, so the pilgrim and the provider always know where the bag is and who holds it. This answers camp Challenge 4, *A baggage journey without loss*.

**How it works**

1. The pilgrim books a luggage service (storage, hotel-to-airport, shipping home) and enters the number of bags.
2. The provider's staff stick a pre-printed tag on each bag: a QR code, optionally with an NFC chip. Scanning it links the tag to the booking.
3. At every handover (hotel lobby, van, storage room, airport counter) the person receiving the bag scans it and picks the place; the app records who, where and when.
4. The pilgrim sees a timeline per bag: *Picked up at hotel 09:10 → In van 09:25 → At airport 11:40 → Checked in*.
5. If a bag misses an expected scan within a set time, or the pilgrim reports it, the system opens a **lost-bag case**: it shows the last scan, the person who held it, and alerts the provider and Bidec support.

**Build notes**

- **Tags:** QR stickers are cheap and enough for the MVP; NFC is faster to scan in crowds. Each tag holds only a random code, never personal data.
- **Scanning offline:** the staff app stores scans and syncs later; the scan keeps the time it happened, not the time it synced.
- **Chain of custody:** a scan by the receiving staff closes the previous holder's responsibility. Store it in `bag_scans`; never edit a scan, add a correction instead.
- **Pilgrim view:** a *Bags* section inside each luggage booking, plus push on each handover.
- **Provider view:** bags in their care, overdue scans, open lost-bag cases.
- **Later:** GPS tags for high-value bags, and links with airlines or airport systems if partners agree. Blockchain (as in the Ministry's opportunity list) is not needed: a signed, append-only scan log gives the same trust at far lower cost.

**Success measures (from the camp challenge):** lost-bag rate, time for bags to arrive, tracking accuracy (share of handovers with a scan).

## Accessibility help and Lost Companion

Elderly and disabled pilgrims get three things: an accessibility mode, bookable in-person help, and Lost Companion. This answers camp Challenge 1, *Arrival Compass*.

**Accessibility mode** (a switch in Profile and onboarding)

- Extra-large text and buttons, fewer items per screen, high contrast.
- Voice guidance for directions and key actions, in the user's language.
- Works with VoiceOver and TalkBack (screen readers) everywhere.

**Accessibility help category (marketplace)**

| Service | Booked by | Price model |
| --- | --- | --- |
| Companion for rituals or errands | Date, time, meeting point, language | Per hour |
| Wheelchair or electric cart help | Date, time, route (for example hotel to Haram gate) | Per trip |
| Accessible transport | Pick-up, drop-off, wheelchair space | Per trip |
| Tracker tag rental | Number of tags, hotel delivery | Per tag, with deposit |

Providers in this category need extra checks (identity, training, reviews), and the booking form carries the pilgrim's needs ("uses a wheelchair", "hard of hearing").

**Walking directions (Guide tab)**

- Offline map pack for Makkah and Madinah: Haram gates, hotels, gathering points, toilets, lost-and-found points, shopping places.
- Turn-by-turn walking directions that work without internet, with large arrows and voice, in six languages.
- Build on an offline-capable map SDK (for example Mapbox or MapLibre with downloaded tiles); Google Maps alone does not route offline in apps.
- Gate names and numbers must match the signs on site; check them on the ground before launch.

**Lost Companion** (summary; full detail in the [Lost Companion guide](https://claude.ai/code/artifact/9c892bd5-556c-4fbf-b5f9-f87d2212e5fd))

1. **Tracker tag** (AirTag or Google-network tag) for pilgrims who may not use a phone.
2. **Last known location**, recorded in the background and uploaded when data returns.
3. **GPS by SMS** when there is a signal but no data.
4. **Bluetooth nearby finder** when family is close and there is no network at all.

It adds the *travel group* and *emergency contacts* screens to Profile, and the "I'm lost" button to Home.

## Gifts shop and shopping places guide

The Shop tab sells Makkah gifts, Madinah gifts and dates from verified local shops, delivered to the pilgrim's hotel or shipped to their home country. The shopping places guide sends pilgrims to the same shops in person. Both support camp Challenge 7's goal of linking pilgrims with gifts and local products.

**Shop: how it works**

1. Shops onboard like other providers (Commercial Registration, IBAN), plus a food licence for dates and food items.
2. Shops list products with photos, price, stock, weight and whether they ship abroad.
3. The pilgrim browses three sections — *Makkah gifts*, *Madinah gifts*, *Dates* — adds to cart and pays.
4. Delivery options: **to the hotel** (shop's own driver or a Rafeeq transport provider) or **shipped home** (courier, with tracking number).
5. The pilgrim tracks the order in Bookings; the shop is paid after delivery, like services.

**Build notes**

- **Stock:** reserve stock when an order is paid, release on cancellation; shops set a low-stock alert.
- **Shipping prices:** charge by weight and country, with rates from the courier's API or a simple table per country zone; show the full price before payment.
- **Couriers:** start with one or two Saudi couriers that ship abroad (for example Aramex, SMSA or Saudi Post SPL); compare their APIs and rates before choosing.
- **Food rules abroad:** many countries restrict importing food. Mark dates and food items *ships abroad* only for countries the courier confirms, and tell pilgrims customs may apply.
- **Delivery before departure:** for hotel delivery, check the pilgrim's departure date and warn if the order may arrive too late.
- **Gift options:** gift wrap and a message card, a simple add-on in the first release.

**Shopping places guide (Guide tab)**

- A map and list of places to buy Makkah gifts, Madinah gifts and dates, filtered by city and type.
- Each place shows opening hours, languages spoken, price range, photos and walking directions (from the offline map).
- Places that sell on Rafeeq show a *Shop online* button linking to their store.
- Bidec's operations team visits and adds the places in the admin panel; the guide is free and helps bring shops onto the marketplace.

**Revenue:** commission on each product sale (set per category in the admin panel), and later featured placement for shops.

## Languages, accessibility and weak networks

Rafeeq's users are often older, don't read Arabic or English, and are in the most crowded mobile networks in the world, so these three rules apply to every screen.

**Languages**

- Launch with Arabic, English, Urdu, Indonesian, Malay and Turkish; add French, Bengali, Hausa and Persian later.
- All app text in translation files from day one; no text inside images.
- Arabic and Urdu use full right-to-left layouts; test every screen in both directions.
- Human-checked translations for app text, payment and refund wording; machine translation only for chat and reviews, marked as such.
- Provider listings: providers write in Arabic or English; machine-translate for display, with "show original".

**Accessibility**

- Body text at least 16 px, buttons at least 48 px tall, high contrast, icons always with labels (from the spec).
- Respect the phone's text-size setting; test at the largest size.
- Every control labelled for screen readers.

**Weak networks near the Haram**

- Cache bookings, orders, bag status, the group and maps on the phone; open instantly without network.
- Retry failed requests with backoff, and queue actions (messages, scans, location points) to send later.
- Keep API responses small; compress images and serve them from a CDN with Saudi edge locations.
- Show clearly when data is old ("updated 4 min ago") instead of spinners that never end.

## Security, privacy and compliance

Rafeeq handles payments, identity documents and live locations, so security and Saudi compliance are built in from the first sprint, not added before launch.

**Timing:** the compliance checklist below is scheduled after the MVP demo (see Build plan). Until it is done, the app runs only in demo mode: sandbox payments, sample data, test phone numbers and test accounts. Keep the security basics (HTTPS, permissions, no secrets in code) from day one, since they are hard to add later.

**Security**

- HTTPS everywhere; secrets in a vault, never in code.
- Role-based access in the API: pilgrims see only their data, providers only their bookings, admins by role.
- Provider documents and IBANs encrypted at rest; card data never touches Bidec servers (the gateway handles it).
- Rate limits on login, OTP, SMS and alerts; lock accounts after repeated failed OTPs.
- Audit log of every admin action; daily backups with a tested restore.
- A penetration test before launch.

**Privacy**

- Consent screens for location sharing and marketing, in the user's language.
- Location shared only within the user's travel group; deleted 7 days after the trip.
- Users can download and delete their data from Profile.

**Compliance checklist (from the spec, plus the new features)**

- [ ] Personal Data Protection Law (PDPL): consent, privacy policy, data stored in Saudi Arabia
- [ ] ZATCA e-invoicing and VAT on every booking and order
- [ ] Licensed payment gateway; Bidec does not hold pilgrim funds
- [ ] Ministry of Tourism: check whether the marketplace or tours and guides need a licence
- [ ] Provider licences per category (transport permits, licensed guides)
- [ ] Food licences for shops selling dates and food; export rules for shipping food abroad
- [ ] E-commerce rules for the gifts shop (seller details, returns policy shown to buyers)
- [ ] Register on Nusuk Business and confirm what may link to Nusuk
- [ ] App store policies for background location and SMS (see the Lost Companion guide)

## Testing and release

Each phase ends with a staging release that passes automated tests, a manual test run on real devices, and a demo; only then does it go to production.

**Testing**

| Type | What | Who |
| --- | --- | --- |
| Unit and API tests | Booking states, payment and refund maths, commission, stock, bag scans | Developers, in CI on every pull request |
| End-to-end tests | Sign-up, book and pay, order and deliver, provider accept, payout | QA, automated on staging |
| Payment tests | Gateway sandbox: success, failure, refund, partial refund, timeout | QA and backend |
| Device matrix | Old and new iPhone; Samsung; Xiaomi or Oppo; a low-cost Android | QA |
| Languages and RTL | Every screen in all six launch languages | QA and native speakers |
| Network tests | Slow 3G, offline, network switching | QA |
| Field tests | Bookings, bag tracking and Lost Companion with real providers and testers in Makkah | Whole team |

**Release**

1. **Internal:** TestFlight and Google Play internal testing for the team.
2. **Closed beta:** 10–20 trusted providers and a few hundred pilgrims through partner Umrah groups.
3. **Store review:** prepare review notes and demo accounts for background location and the staff mode.
4. **Launch in Makkah,** then Madinah once the metrics gate is passed.

**Running it**

- Monitoring and alerts on API errors, payment failures, slow responses and SMS delivery.
- An on-call rota during Ramadan and the Hajj season, when traffic peaks.
- Support playbooks for refunds, lost bags and lost-person alerts.

## MVP scope and sample data

The MVP shows the whole product working end to end on sample data: every feature is real code, but providers, products, places and pilgrims are made up, and nothing touches real money.

**What is in the MVP**

| Feature | In the MVP | Simulated or left for later |
| --- | --- | --- |
| Marketplace | 5 service categories plus accessibility help; search, book, pay, provider accepts, staff completes, review | Payments in gateway sandbox only; payouts calculated but not sent |
| Provider dashboard and admin | Onboarding, listings, calendar, bookings, earnings; verification, refunds, commission, audit log | Document checks done by hand on sample files |
| Baggage tracking | QR bag tags, staff scanner, bag timeline for the pilgrim, overdue-scan alerts, lost-bag case | QR only (no NFC); tags printed from the admin panel |
| Gifts shop | Makkah gifts, Madinah gifts, dates; cart, checkout, order status, hotel delivery and shipping home | Courier tracking numbers entered by hand; no real shipping |
| Shopping places guide | Map and list of sample places with hours, languages, directions, *Shop online* link | Places are sample entries, not visited yet |
| Elderly and accessibility guide | Accessibility mode, voice prompts, assistance bookings, walking routes on a downloaded map | 10 sample routes instead of the full city |
| Lost Companion | Travel groups, last known location, I'm lost with SMS, Bluetooth finder, tag setup guide | SMS to test numbers; tags shown with a real AirTag in Find My |
| Invoices | Sample PDF invoice per booking | ZATCA e-invoicing after the MVP |

**Sample data (loaded by a seed script)**

Keep it in JSON files in `apps/api/prisma/seed/` and load it with one command (`npm run seed`), so the demo can be reset in seconds. Mark every record as sample so it can never mix with real data.

| Data | Amount | Examples |
| --- | --- | --- |
| Providers | 12 (8 services, 4 shops) | Sample Transport Co., Sample Guides Makkah, Sample Luggage Services, Sample Dates House |
| Services | 30 across 6 categories | Airport to hotel (van), 2-hour heritage tour in Urdu, wheelchair help hotel to Haram gate |
| Products | 40 across 3 sections | Prayer mat, misbaha, attar set, Makkah gift box, Madinah dates 1 kg box |
| Places | 25 | Haram gates, gathering points, lost-and-found points, 10 shopping places in Makkah and Madinah |
| Pilgrims | 6 demo accounts, one per launch language | Ahmed (Indonesian), Fatima (Urdu), Mehmet (Turkish), plus an elderly user with accessibility mode on |
| Travel groups | 2 | A family of 4 with an elderly parent; a group of 6 with a leader |
| Bookings and orders | 20 bookings, 10 orders in mixed statuses | Upcoming, in progress, completed, cancelled, refunded |
| Bags | 8 bags on 3 luggage bookings | One delivered, one in transit, one overdue (opens a lost-bag case) |
| Staff | 6 | Drivers, a guide, luggage staff with the scanner |

All prices and names in the sample data are invented for the demo; replace them with real providers before launch. Use real coordinates for the Haram (about 21.4225, 39.8262) and the Prophet's Mosque (about 24.4672, 39.6111) so maps look right.

**Demo accounts:** one login per role (pilgrim, elderly pilgrim, group leader, provider owner, staff, admin), all using test OTP codes, listed in `docs/demo-accounts.md`.

**Demo script (about 15 minutes)**

1. Ahmed picks Indonesian, logs in, books an airport-to-hotel transfer and pays (sandbox card).
2. The provider accepts on the dashboard and assigns a driver; Ahmed sees the driver on the map.
3. Ahmed books luggage shipping; staff scan his bags at the hotel and the van; the timeline updates. One bag is overdue and a lost-bag case opens in the admin panel.
4. Ahmed orders a Madinah dates box for hotel delivery; the shop packs it and marks it delivered.
5. He opens the shopping places guide, finds a gift shop, and taps *Shop online*.
6. Switch to the elderly user: accessibility mode, a voice-guided walking route to a Haram gate, a wheelchair-help booking.
7. The elderly user presses I'm lost with mobile data off: the SMS goes to the group leader, the leader's map shows the last location, and the Bluetooth finder leads to them.
8. Admin panel: bookings, orders, bags, open alerts and commission for the day.

## Build plan

&#91;embedded content: Rafeeq roadmap · 4 MVP phases, 1 gate, then compliance\]

The MVP builds every feature in about 12 weeks and ends with a full demo on sample data; compliance and the real launch come after it. The weeks are an estimate for one or two developers building with AI help; review them after the setup phase.

| Phase | Done when |
| --- | --- |
| Setup (weeks 1–2) | Monorepo and CI running, design system ready, seed script loads sample data, gateway sandbox connected |
| Marketplace (weeks 3–6) | Pilgrims book and pay (sandbox) for all service categories; providers accept and complete; admin sees everything |
| Bags and safety (weeks 7–9) | Bags scanned at every handover with a lost-bag case; accessibility mode and walking routes work; Lost Companion works with data off |
| Gifts, guide, demo (weeks 10–12) | Shop orders reach delivered; places guide links to shops; the demo script runs end to end |
| Compliance and launch (after the MVP) | Licences, ZATCA e-invoicing, PDPL, live payments and a penetration test done; Makkah pilot with real providers, then Madinah |

**For the camp (4 virtual days):** the full MVP takes longer than the camp, so pitch the whole product with the architecture and demo script, and demo one finished slice live: Lost Companion (QR group join, SMS with real GPS in airplane mode, Bluetooth warmer/colder) or bag tracking (scan a QR tag at three handovers and show the timeline).

## Open questions

- [ ] Stack decided (13 Oct): Flutter for mobile, NestJS for the backend, Next.js for the web tools, built with AI help.
- [ ] Which payment gateway supports split payments for both services and products?
- [ ] Who is the seller on the invoice: the provider or Bidec? (Tax adviser.)
- [ ] Does the marketplace, or do tours and guides, need a Ministry of Tourism licence?
- [ ] Which courier for international shipping of gifts, and which countries accept dates?
- [ ] Which offline map SDK, and who checks gate names and numbers on site?
- [ ] How much of App 1's backend is ready to reuse, and when is App 1 live?
- [ ] How does Rafeeq link to Zuyarah: a deep link only, or shared login and bookings?
