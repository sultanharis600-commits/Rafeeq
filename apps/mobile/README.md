# Rafeeq mobile (Flutter)

One app for iOS and Android: the pilgrim app, and staff mode when a driver, guide, companion or luggage handler logs in.

| Area | Screens |
| --- | --- |
| Onboarding | Language (first), phone + OTP, city, hotel, travel dates, accessibility mode |
| Home | Search, categories, offers, next booking, **I'm lost** |
| Bookings | Upcoming, past, orders; booking details with driver on the map, bags and their timeline, invoice, cancel, review |
| Shop | Makkah gifts, Madinah gifts, dates; cart (one shop per order), hotel delivery or shipping home, gift wrap |
| Guide | Prayer times (computed on the phone), Qibla, map of holy sites, gates, lost-and-found, walking directions with voice, shopping places with *Shop online* |
| Profile | Language, accessibility mode and needs, location sharing (consent), travel group, emergency contacts, tracker tag guide, help, my data, delete account |
| Lost Companion | I'm lost (app or SMS with GPS), group map with last known locations, Bluetooth warmer/colder finder |
| Staff mode | Today's jobs, start/complete, live location to the pilgrim, bag scanner that works offline |

## First run

The platform folders (`android/`, `ios/`) are generated, not hand-written. Create them once, then add the permissions the app needs:

```bash
cd apps/mobile
flutter create . --project-name rafeeq --org sa.bidec --platforms android,ios
python3 tool/configure_platforms.py      # camera, location, Bluetooth, sms:/tel: links
flutter pub get
flutter gen-l10n
flutter run --dart-define=API_URL=http://10.0.2.2:3000     # Android emulator → API on your laptop
```

On a real phone use your laptop's address on the same Wi-Fi, e.g. `--dart-define=API_URL=http://192.168.1.20:3000`. Commit `android/` and `ios/` after the first run.

Build settings (`--dart-define`):

| Name | Default | Meaning |
| --- | --- | --- |
| `API_URL` | `http://10.0.2.2:3000` | API base URL, without `/v1` |
| `RAFEEQ_DEMO_MODE` | `true` | Shows the DEMO ribbon (the API decides sandbox payments) |
| `RAFEEQ_SMS_NUMBER` | `+966500000099` | Number that receives "RFQ LOST lat,lng" texts and forwards them to the API |

## Checks

```bash
flutter analyze
flutter test
```

## Text in six languages

All app text lives in [`tool/strings.py`](tool/strings.py), one line per string with Arabic, English, Urdu, Indonesian, Malay and Turkish. After editing it:

```bash
python3 tool/strings.py     # regenerates lib/l10n/app_<lang>.arb
```

CI fails if the ARB files don't match `strings.py`. The non-English text is a draft: a native speaker approves each language before launch.

## Working offline

- Bookings, orders, bags, the travel group and the city's map pack are cached on the phone; screens show "updated N min ago" when offline.
- Bag scans, location points and lost alerts made offline wait in a queue and are sent when the network returns, keeping the time they happened.
- Walking directions and the route drawing come from the map pack, so they work without network. The background map tiles (OpenStreetMap) need network; see `docs/decisions.md`.

## Known limits of the MVP

- Location is recorded while the app is open or in recent apps; recording with the app closed needs background-location setup (Android foreground service, iOS background mode) and store review notes.
- The Bluetooth finder needs two real phones; emulators have no Bluetooth. iOS advertises only while the app is in the foreground.
- No push notifications yet (in-app and outbox only), no chat, no Google/Apple sign-in.
