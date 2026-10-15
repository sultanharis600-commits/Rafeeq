# Demo accounts

All accounts are sample data loaded by `npm run seed`.

**Testing login (no code):** while `QUICK_LOGIN` is on (the default in demo mode), type an account's **phone number or email** and you are in; no code is asked. Any other phone number or email creates a new pilgrim account. Every sample account's email is its key at `rafeeq.test`, for example `ahmed@rafeeq.test` or `admin-ops@rafeeq.test`.

With `QUICK_LOGIN=false` the apps go back to phone + code; in demo mode the code is always **123456**. Quick login can never be on with `DEMO_MODE=false`: the API refuses to start.

## One login per role

| Role | Name | Phone | Email | Use it for |
| --- | --- | --- | --- | --- |
| Pilgrim | Ahmed Wijaya (Indonesian) | +966500000050 | `ahmed@rafeeq.test` | Demo script steps 1–5; leader of the Wijaya family group |
| Elderly pilgrim | Siti Aminah (Indonesian, accessibility mode on, wheelchair) | +966500000056 | `siti@rafeeq.test` | Demo steps 6–7: accessibility mode, wheelchair booking, I'm lost |
| Group leader | Imran Qureshi (Urdu) | +966500000060 | `imran@rafeeq.test` | Leader of the Qureshi Umrah group (6 people) |
| Provider owner | Faisal Al-Harbi — Sample Transport Co. | +966500000010 | `owner-transport@rafeeq.test` | Accept bookings, assign drivers |
| Provider owner (luggage) | Turki Al-Zahrani — Sample Luggage Services | +966500000014 | `owner-luggage@rafeeq.test` | Bags, overdue scans, lost-bag case |
| Provider owner (shop) | Abdulrahman Al-Ansari — Sample Dates House | +966500000018 | `owner-dates-house@rafeeq.test` | Pack and deliver orders |
| Staff (luggage scanner) | Saeed | +966500000033 | `saeed@rafeeq.test` | Scan bag tags at handovers |
| Staff (driver) | Khalid | +966500000030 | `khalid@rafeeq.test` | Today's jobs, live location |
| Admin (operations) | Bidec Operations | +966500000001 | `admin-ops@rafeeq.test` | Verification, bookings, bags, alerts |
| Admin (finance) | Bidec Finance | +966500000002 | `admin-finance@rafeeq.test` | Commission, payouts, refunds |
| Admin (support) | Bidec Support | +966500000003 | `admin-support@rafeeq.test` | Tickets, disputes |

## Other sample pilgrims (one per launch language)

| Name | Language | Phone | Email |
| --- | --- | --- | --- |
| Fatima Khan | Urdu | +966500000051 | `fatima@rafeeq.test` |
| Mehmet Yılmaz | Turkish | +966500000052 | `mehmet@rafeeq.test` |
| Aisyah Rahman | Malay | +966500000053 | `aisyah@rafeeq.test` |
| Sarah Ahmed | English | +966500000054 | `sarah@rafeeq.test` |
| Abdullah Mostafa | Arabic | +966500000055 | `abdullah@rafeeq.test` |

## What is already in the sample data

- **Bookings:** 20 in mixed statuses. Ahmed's bag-shipping booking (`b02`) has three tagged bags: one delivered, one in transit, one **overdue with an open lost-bag case**. Aisyah has a driver on the way today (`b11`).
- **Orders:** 10, from paid to delivered, one cancelled and one refunded; Sarah's international order has a tracking number.
- **Groups:** Wijaya family (join code `WJY-4821`, Siti carries an AirTag) and Qureshi Umrah group (`QRS-7360`). Siti's last known location is near King Abdulaziz Gate, 18 minutes ago.
- **Places:** 25, including 10 shopping places; 10 walking routes with steps in all six languages.

IDs are derived from the sample keys, so they are the same after every reset.
