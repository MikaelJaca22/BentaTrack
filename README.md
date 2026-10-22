# BentaTrack

**General Retail Sales & Supply Coordination System** — a point-of-sale, inventory, and supplier restock coordination system for small general retail stores.

Two roles, three apps, one backend:

| Role | What they do |
| --- | --- |
| **Store Owner** | Records cash sales, manages products and stock, receives low-stock alerts, creates restock requests, verifies deliveries, generates reports |
| **Supplier** | Receives restock requests, accepts or declines, delivers goods, resolves discrepancies |

| App | Stack | Folder |
| --- | --- | --- |
| REST API backend | Node.js + Express + SQLite (better-sqlite3) + JWT/bcryptjs + zod | `backend/` |
| Web client | React 18 (Vite) + Tailwind CSS + lucide-react + React Router + axios | `frontend/` |
| Mobile client | React Native (Expo SDK 52) + NativeWind + lucide-react-native + React Navigation + expo-secure-store/print/sharing/asset | `mobile/` |

Hard rules respected throughout: **cash-only** payments, **no barcode/QR/camera scanning** (search by name/code only), **no email anywhere**, **no seed data** (the database starts completely empty — every list shows an empty state until the user creates data), and a strict **black/white/gray monotone** design (status is communicated with icons, text, fills and borders — never color; no emojis in UI, Lucide icons only). Currency is the Philippine peso (₱), set by a single constant per client (`backend` stores numbers only; `frontend/src/config.js` and `mobile/src/config.js` each define `CURRENCY_SYMBOL`).

---

## Folder structure

```
BentaTrack/
├── backend/
│   ├── src/
│   │   ├── config/env.js
│   │   ├── db/connection.js, db/migrate.js      # tables only, zero inserts
│   │   ├── db/seed.js                           # opt-in sample products, never auto-run
│   │   ├── middleware/auth.js, validate.js, errorHandler.js
│   │   ├── utils/receipt.js, notify.js, money.js, query.js
│   │   ├── controllers/auth|products|sales|suppliers|restock|reports|notifications.controller.js
│   │   ├── routes/*.routes.js
│   │   ├── app.js
│   │   └── server.js
│   ├── scripts/dev.js, scripts/smoke.mjs         # dev launcher (used by nodemon) + end-to-end smoke test
│   ├── .env                                      # gitignored — create it yourself, see step 1
│   └── package.json                              # npm run dev / start / seed / smoke
├── frontend/
│   ├── src/
│   │   ├── api/client.js                         # axios + token + 401 handling
│   │   ├── context/AuthContext.jsx, components/*.jsx
│   │   ├── routes/ProtectedRoute.jsx
│   │   ├── pages/auth/                           # Login, CreateAccount
│   │   ├── pages/owner/                          # Dashboard, NewSale, Receipt, Products, Restock, RestockDetail, Suppliers, Reports, Notifications
│   │   ├── pages/supplier/                       # Dashboard, Requests, RequestDetail, History, Notifications
│   │   ├── App.jsx, main.jsx, config.js, index.css
│   └── package.json                              # npm run dev / build / preview
└── mobile/
    ├── src/
    │   ├── api/client.js, tokenStore.js          # expo-secure-store + in-memory token
    │   ├── components/                           # Button, Input, Badge, EmptyState, Skeleton, Card, Toast, TopHeader
    │   ├── context/AuthContext.js
    │   ├── navigation/                           # Root, Owner (5 tabs), Supplier (4 tabs)
    │   ├── screens/auth/                         # LoginScreen, CreateAccountScreen
    │   ├── screens/owner/                        # Dashboard, NewSale, Products, Restock, RestockDetail, Suppliers, Receipt, Reports, Notifications, More
    │   └── screens/supplier/                     # Dashboard, Requests, RequestDetail, History, Notifications
    ├── App.js, app.json, babel.config.js, metro.config.js, tailwind.config.js
    ├── .env                                          # gitignored — create it yourself, see step 3
    └── package.json                              # npm run dev (Expo)
```

---

## Prerequisites

- **Node.js 18+** (the project is verified on Node 20/24; `better-sqlite3` ^12 ships prebuilt binaries for modern Node, so no Visual Studio build tools are required)
- **Git** (optional)
- For the mobile app: the **Expo Go** app on your phone, or an Android/iOS emulator

## 1. Backend

```bash
cd backend
npm install
npm run dev                 # http://localhost:4000
```

Create `backend/.env` first — it is gitignored and **not** shipped with the repo:

```bash
# Windows PowerShell
@"
NODE_ENV=development
PORT=4000
JWT_SECRET=$([Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(64)))
DB_PATH=./data/bentatrack.db
CORS_ORIGINS=http://localhost:3000,http://localhost:8081,exp://localhost:8081
"@ | Set-Content .env

# macOS / Linux (or Git Bash)
printf 'NODE_ENV=development\nPORT=4000\nJWT_SECRET=%s\nDB_PATH=./data/bentatrack.db\nCORS_ORIGINS=http://localhost:3000,http://localhost:8081,exp://localhost:8081\n' \
  "$(openssl rand -base64 64 | tr '+/' '-_')" > .env
```

Or generate the secret on its own and paste it in — 64 random bytes is the right size for the HS256 signing key:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('base64url'))"
# 3y0RNUUjK9L-iIP-wZNjkIbITDnTiUpyCBJsM6LBmL1I3ZVZ1fpYZP9vnZtr_0Gx3p-kvkjhdAkjwPA8mMeQ7Q
```

| Variable | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | no | `development` (default) or `production` |
| `PORT` | no | Defaults to `4000` |
| `JWT_SECRET` | **yes** | Random string, min 32 chars. Must be the *same* value for every running instance or existing tokens stop verifying |
| `DB_PATH` | no | Defaults to `backend/data/bentatrack.db` |
| `CORS_ORIGINS` | **yes in production** | Comma-separated list of every client origin. An empty value would mean "allow any origin", so production refuses to start without one |
| `TRUST_PROXY` | no | Number of reverse-proxy hops in front of the app (`1` for a single nginx), or `true`/`false`. Unset by default, which is the safe choice — without it every client behind a proxy shares one rate-limit bucket. Only set this when something actually sets `X-Forwarded-For` |

### Money is stored as integer minor units

Prices, costs, totals and change are stored in SQLite as **INTEGER centavos**, never as `REAL`. A `REAL` column cannot represent `0.1` exactly and SQLite has no decimal type, so sums drift (`0.1 + 0.1 + 0.1 = 0.30000000000000004`) and a `REAL` column silently accepts `Infinity`.

`migrate()` converts an existing database automatically: it detects `REAL` money columns and rebuilds those three tables in a single transaction, multiplying each value by 100. It runs only when needed, so a fresh database skips it and re-running `migrate()` is a no-op.

The JSON API is unchanged — clients still send and receive pesos (`15.50`), and the conversion happens at the server boundary in `src/utils/money.js`.

Notes:
- On first start, `migrate.js` creates all tables (users, products, sales, sale_items, store_suppliers, restock_requests, restock_items, restock_events, notifications) in `data/bentatrack.db`. **No rows are inserted** — the system starts empty by design.
- With `NODE_ENV=production` the server **refuses to start** if `JWT_SECRET` is missing, shorter than 32 characters, or still a known placeholder. `CORS_ORIGINS` is likewise required — an empty value would let any website make authenticated calls to the API. In development only, a clearly-marked fallback keeps a fresh clone runnable.
- `POST /api/auth/login` is rate limited to 10 attempts per IP per 15 minutes; registration allows 20. Other routes require a valid token and are not limited.
- **List endpoints are paginated.** `GET /api/sales`, `GET /api/notifications` and `GET /api/restock` accept `?limit=` (default 50, max 200) and `?offset=`, and return a `pagination: { total, limit, offset, hasMore }` block alongside the rows. Out-of-range or malformed values fall back to the default rather than erroring. `GET /api/notifications` also returns `unreadCount`, a count over all unread rows rather than the length of the current page. The `receipts` array inside the sales report is capped at 200; the summary totals above it still cover the whole date range.
- Query parameters are parsed leniently in `src/utils/query.js`: dates must be `YYYY-MM-DD` or are ignored, `LIKE` wildcards in search terms are escaped (so searching `%` does not return every row), and `restock` `status` is checked against the known values.
- Rotating `JWT_SECRET` invalidates every issued token and signs all users out.
- `CORS_ORIGINS` must list every client origin (Vite dev server, preview, Expo).

### Optional: loading sample products

The empty-by-default rule is not weakened by an opt-in developer script that only runs when you ask for it. `src/db/seed.js` is **never** imported by `server.js` or `migrate.js` — booting the API never seeds anything.

```bash
npm run seed                    # creates dev accounts + a 32-item product catalogue
```

It creates (or reuses) two accounts — store owner `kaeljaca` (password `kael1234`) and supplier `jasmine` (password `jasmine1234`) — links the supplier to the owner, and inserts 32 catalogue products (brand + name, e.g. "NESTEA Apple") with zero price, cost, stock and reorder level. It is idempotent: existing usernames and product names are skipped rather than duplicated. It takes no username argument and does not validate against the product zod schema (values are inserted directly).

To get back to a truly empty database, stop the backend and delete `backend/data/`.

### Optional: end-to-end smoke test

```bash
npm run smoke                   # boots the API on port 4010, runs, exits 0/1
```

`scripts/smoke.mjs` spawns the real server against a throwaway database in the system temp folder (never `backend/data/`), waits for `/api/health`, then drives the whole system over HTTP: registration and bad-login rejection, supplier linking, product creation with validation, a sale with receipt numbering and totals, insufficient-stock and short-tender rejection, the low-stock notification, the full restock flow including discrepancy and re-delivery, the resend guard, report totals, and the notifications pagination shape. It prints `PASS`/`FAIL` per assertion, kills the server, deletes the temp database, and exits non-zero on any failure. Useful as a pre-push check — it needs no test framework and no running backend.

## 2. Web frontend

```bash
cd frontend
npm install
npm run dev                 # http://localhost:3000
npm run build && npm run preview   # production check
```

Optional — create `frontend/.env` (gitignored, not shipped) only to point the client at a different API:

```
VITE_API_URL=http://localhost:4000/api
```

Defaults to `http://localhost:4000/api`, so most setups need no file.

## 3. Mobile app (Expo Go)

Requirements:

- Expo Go installed on the phone. This project targets **Expo SDK 57**; use the current Expo Go from the Play Store on Android (the iOS App Store build can lag behind SDK 57).
- Phone and computer on the same Wi-Fi network.
- Backend running on port 4000.

Start the backend first, then the mobile app:

```bash
cd backend
npm install
npm run dev                 # API on http://localhost:4000

cd ../mobile
npm install
npx expo start              # npm run dev also works
```

Scan the QR code printed in the terminal with Expo Go. No `.env` is required: the app automatically uses the host Metro is served from (your computer's LAN IP) and connects to port 4000, so it keeps working when the IP changes.

Optional override — create `mobile/.env` (gitignored, not shipped) only if the API runs on a different machine, port, or tunnel:

```
EXPO_PUBLIC_API_URL=http://192.168.1.42:4000/api
```

Restart with `npx expo start --clear` after editing it.

**If the phone cannot connect:**

- Confirm both devices are on the same Wi-Fi and the backend is running.
- Allow Node.js through Windows Firewall for the active network profile (Private/Public).
- If the computer has multiple adapters or a VPN, force the correct LAN interface before starting Expo (PowerShell):
  `$env:REACT_NATIVE_PACKAGER_HOSTNAME='192.168.1.42'; npx expo start`
- If Metro loads but API calls fail, set `EXPO_PUBLIC_API_URL` in `mobile/.env` to `http://<LAN-IP>:4000/api` and restart with `--clear`.

---

## API surface (summary)

All routes are under `/api`, require `Authorization: Bearer <jwt>` (except register/login), are zod-validated, role- and ownership-scoped, and return errors as `{ "error": { "message", "field?" } }`.

- `POST /api/auth/register` · `POST /api/auth/login` · `GET /api/auth/me`
- `GET|POST /api/products` · `GET|PUT|DELETE /api/products/:id` · `PATCH /api/products/:id/stock` · query `?search=`, `?lowStock=true`
- `POST /api/sales` (transactional: totals recomputed, stock deducted, receipt `BT-YYYYMMDD-0001` numbered per store/day, low-stock alerts raised) · `GET /api/sales` (paginated) · `GET /api/sales/:id`
- `GET /api/suppliers/search?q=` · `GET /api/suppliers/linked` · `POST /api/suppliers/link` · `DELETE /api/suppliers/link/:id`
- `POST /api/restock` · `GET /api/restock?status=` (paginated) · `GET /api/restock/:id` · `POST /api/restock/:id/accept|decline|deliver|verify|discrepancy|resend`
- `GET /api/reports/sales|inventory|restock?from=&to=&format=csv`
- `GET /api/notifications?unread=` (paginated) · `PATCH /api/notifications/:id/read` · `PATCH /api/notifications/read-all`

Restock state machine (enforced server-side): `pending → accepted → delivered → completed` · `pending → declined (→ resent as a new request)` · `delivered → discrepancy → delivered (re-delivery loop)`. Only the owner verifies; verification completes the request **only when every received quantity equals delivered**, and then adds stock inside a transaction.

---

## Manual test checklist

Run the backend, then exercise the flow on web and mobile. Every step is expected to behave identically on both clients.

**Setup — empty system**
1. Start fresh (delete `backend/data/` if present) → `npm run dev`. Every screen shows an empty-state message; nothing is preloaded.

**Accounts & login**
2. Create Account → toggle **Supplier**, register supplier `s1`. Toggle **Store Owner**, register owner `o1` (check: username 4–20 chars `[A-Za-z0-9_.]` enforced; password min 8 + confirm; the name label switches between "Store Name" and "Supplier / Business Name").
3. Log in as `o1` with a wrong password → generic "Invalid username or password" (no role hint). Repeat many times → rate-limit message. Log in correctly → owner UI; the app knows your role from the JWT (no role selector on Login).

**Sales flow (owner)**
4. Products tab → add 2 products (one with no code; one with code). Stock adjustment +/- works. Duplicate product code for the same owner → rejected.
5. New Sale → search a product by name (no scanning exists anywhere) → add to cart → increase quantity beyond stock → blocked. Checkout → enter tendered cash below total → change field and confirm stay disabled; enter exact change → allowed.
6. Confirm sale → receipt appears numbered `BT-<today>-0001`, second sale that day is `-0002`. Product stock decreased. Print / Save-as-PDF / Share all work (web: print dialog; mobile: expo-print PDF + share sheet).
7. Sell a product down to/below its reorder level → a low-stock notification is created (bell badge updates) with a "Create restock request" shortcut.

**Suppliers & restock (owner → supplier → owner)**
8. Owner: Suppliers → search for `s1` → Link. Linked supplier appears in the list; unlinking asks for confirmation (test it, re-link).
9. Trigger the low-stock alert → create a restock request selecting the linked supplier and items with quantities. Status **Pending** (outlined badge), supplier gets a notification.
10. Supplier login: request visible with store name. **Decline** requires a reason; owner is notified and can **Resend** (to the same or another supplier) — the resent request is a new **Pending** row; history is preserved.
11. Supplier: **Accept** (badge turns gray-filled) → **Deliver** with delivered quantities (may be partial). Owner is notified.
12. Owner verify: enter a received quantity that mismatches one item → **Discrepancy** badge (2px black outline + warning icon) and the request loops back to the supplier for re-delivery. Stock is **not** changed yet.
13. Re-deliver → verify with all quantities matching → **Completed** (black fill) and inventory increases by the received amounts. Event history on both roles shows every transition with actor and timestamp.

**Reports (owner)**
14. Reports → Sales: totals, transaction count, items sold, average sale, daily breakdown, top-10 lists, receipt links all reflect the sales you made. Date presets Today/7/30/Custom change the numbers correctly.
15. Inventory: total stock value, low-stock flags, per-product rows. Restock: counts by status and per supplier, discrepancy count.
16. For each report: on-screen view, Print/PDF, Share (summary/PDF), and CSV download all produce correct output.

**Notifications**
17. Tapping a restock notification deep-links to that request (owner → RestockDetail, supplier → RequestDetail). Mark-as-read and "Mark all read" work; the unread badge clears.

**Design & restrictions sweep**
18. Any screen: only black/white/gray rendered, no emojis, thin 1px borders, rounded-xl cards, web sidebar on desktop / bottom tabs on narrow screens and mobile; touch targets ≥ 44 px; skeletons appear while loading.
19. Log out → back to Login; tokens are cleared (web: localStorage, mobile: SecureStore); navigating to a protected screen while logged out redirects to Login.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `better-sqlite3` install error | Use `better-sqlite3@^12` (prebuilt binaries). Node 18+ required. |
| Mobile "Cannot reach the server" | Confirm phone and computer are on the same Wi-Fi, the backend is running on port 4000, and Node.js is allowed through the firewall. The app auto-detects the API from Metro's host; override with `EXPO_PUBLIC_API_URL` in `mobile/.env` if needed, then restart with `npx expo start --clear`. |
| Port 4000 in use | Change `PORT` in `backend/.env` and update the clients' API URLs. |
| Want a clean slate | Stop the backend and delete the `backend/data/` folder — the DB is recreated empty on next start. |
