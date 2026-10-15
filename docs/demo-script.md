# Demo script (about 15 minutes)

The guide's demo, step by step, with the screens to open. The same steps run automatically in `apps/api/test/demo-script.e2e-spec.ts`, so if CI is green the backend side of every step works.

## Before you start

```bash
npm run seed                      # resets all sample data in ~2 seconds
npm run dev:api                   # API on :3000
npm run dev:web                   # dashboard and admin on :3001
cd apps/mobile && flutter run --dart-define=API_URL=http://<your-laptop-ip>:3000
```

- Two phones (or an emulator and a phone): **A** as Ahmed, **B** as Siti, plus a laptop with the web tools.
- Log in by typing the account's phone number or email; no code is asked (testing login). Accounts are in [`demo-accounts.md`](demo-accounts.md).
- Sandbox card: **4111 1111 1111 1111** (pays), **4000 0000 0000 0002** (declined).
- Re-run `npm run seed` between rehearsals.

## Steps

| # | Who and where | What to do | What the audience sees |
| --- | --- | --- | --- |
| 1 | Phone A, Ahmed | Pick **Bahasa Indonesia**, log in with +966500000050, Home › Transportasi › *Bandara Jeddah ke hotel Makkah* › choose a time › pay with the sandbox card | App in Indonesian; full price, refund policy and verified badge before paying; booking shows *Dibayar* |
| 2 | Laptop, Faisal (Sample Transport Co.) | `/ar/provider/bookings` › accept › assign Khalid. On Khalid's phone (staff login +966500000030) open the job | Ahmed's booking turns *Dikonfirmasi*; driver card and map with the van |
| 3 | Phone A, then staff phone | Ahmed books *Kirim koper ke tanah air* for 2 bags. Turki (luggage owner) accepts and assigns Saeed. Saeed (+966500000033) › Scan bags › scan two printed tags at *Hotel lobby*, then one at *Van*. In the admin panel open **Bags › Check overdue bags**, pick *1 hour from now (demo)* and press **Check now** (in real use a 5-minute job does this) | Timeline per bag: *Diambil di hotel → Dalam van*. The second bag misses the van: a lost-bag case appears in `/admin/bags` |
| 4 | Phone A, then laptop as Sample Dates House | Shop › Kurma › *Madinah dates 1 kg box* › cart › *Hotel saya* › pay. Dashboard › Orders › Pack › Out for delivery › Delivered | Delivery fee for Madinah→Makkah shown before paying; order reaches *Diterima* |
| 5 | Phone A | Guide › *Tempat beli oleh-oleh dan kurma* › a shop › **Belanja online** | Opens the shop tab filtered to that shop |
| 6 | Phone B, Siti (+966500000056) | Already in accessibility mode. Guide › walking route *Hotel → King Abdulaziz Gate (1)* (voice reads each step). Home › Bantuan lansia › wheelchair help › book and pay | Extra-large text; step-free route with large arrows and voice; booking carries "uses a wheelchair" to the provider |
| 7 | Phone B with **mobile data off**, then Phone A | Siti presses **Saya tersesat**. The app opens a ready SMS to Ahmed and the Rafeeq number; press send. On Phone A: Profile › Rombongan › alert › **Cari di dekat** and walk towards Phone B | Leader gets the SMS with a map link and sees her last location; Bluetooth finder shows *Makin dekat* / *Makin jauh* with no network |
| 8 | Laptop, admin (+966500000001) | `/en/admin` | Today's bookings, orders, commission, open bag cases and lost alerts |

## Notes for the presenter

- **Step 7 without an SMS gateway:** in demo mode the inbound "RFQ LOST …" text has to reach the API webhook. With a real SMS number connected it arrives by itself; otherwise post it from the laptop:
  ```bash
  curl -X POST localhost:3000/v1/sms/inbound -H 'content-type: application/json' \
    -H 'x-rafeeq-sms-secret: dev-sms-secret' \
    -d '{"from":"+966500000056","body":"RFQ LOST 21.42150,39.82580 25"}'
  ```
  The SMS from Siti's phone to Ahmed's phone is a real SMS and needs no server.
- **Outbound SMS and push** are recorded, not sent, in demo mode. Show them in `/admin/outbox`.
- **Bluetooth finder** needs two real phones; emulators have no Bluetooth.
- **Camp version (4 virtual days):** demo step 7 live, or step 3 with three printed tags. See the guide's Build plan.
