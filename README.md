# BentaTrack

**General Retail Sales & Supply Coordination System** — a point-of-sale, inventory, and supplier restock coordination system for small general retail stores.

Two roles, three apps, one backend:

| Role | What they do |
| --- | --- |
| **Store Owner** | Records cash sales, manages products and stock, receives low-stock alerts, creates restock requests, verifies deliveries, generates reports |
| **Supplier** | Receives restock requests, accepts or declines, delivers goods, resolves discrepancies |

| App | Stack | Folder |
| --- | --- | --- |
| REST API backend | Node.js + Express + SQLite (better-sqlite3) + JWT/bcrypt + zod | `backend/` |
| Web client | React 18 (Vite) + Tailwind CSS + lucide-react + React Router + axios | `frontend/` |
| Mobile client | React Native (Expo SDK 51) + NativeWind + lucide-react-native + React Navigation + expo-secure-store/print/sharing | `mobile/` |

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
│   │   ├── utils/receipt.js, notify.js
│   │   ├── controllers/auth|products|sales|suppliers|restock|reports|notifications.controller.js
│   │   ├── routes/*.routes.js
│   │   ├── app.js
│   │   └── server.js
│   ├── .env.example
│   └── package.json                              # npm run dev / npm start
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
    ├── .env.example
    └── package.json                              # npm start (Expo)
```

---

## Prerequisites

- **Node.js 18+** (the project is verified on Node 20/24; `better-sqlite3` ^12 ships prebuilt binaries for modern Node, so no Visual Studio build tools are required)
- **Git** (optional)
- For the mobile app: the **Expo Go** app on your phone, or an Android/iOS emulator

## 1. Backend

```bash
cd backend
copy .env.example .env      # Windows — or `cp .env.example .env`
npm install
npm run dev                 # http://localhost:4000
```

Notes:
- On first start, `migrate.js` creates all tables (users, products, sales, sale_items, store_suppliers, restock_requests, restock_items, restock_events, notifications) in `data/bentatrack.db`. **No rows are inserted** — the system starts empty by design.
- Change `JWT_SECRET` in `.env` to a long random string before any real use.
- `CORS_ORIGINS` must list every client origin (Vite dev server, preview, Expo).

### Optional: loading sample products

The empty-by-default rule is not weakened by an opt-in developer script that only runs when you ask for it. `src/db/seed.js` is **never** imported by `server.js` or `migrate.js` — booting the API never seeds anything.

```bash
npm run seed                    # seeds the single registered store owner
npm run seed -- kaeljaca        # or name the owner explicitly (required if >1 owner)
```

It inserts 10 general-retail products (peso pricing) into an **already registered** owner — it never creates users — and is safe to re-run: duplicate codes and names are skipped rather than inserted. Three of the ten sit at or below their reorder level so the low-stock filter, alerts and restock flow can be exercised immediately, and one item intentionally has no `product_code` to cover the no-code path. Every sample is validated against the same zod schema as `POST /api/products`, so sample data cannot drift from the API contract.

To get back to a truly empty database, stop the backend and delete `backend/data/`.

## 2. Web frontend

```bash
cd frontend
copy .env.example .env      # VITE_API_URL=http://localhost:4000/api
npm install
npm run dev                 # http://localhost:3000
npm run build && npm run preview   # production check
```

## 3. Mobile app (Expo)

```bash
cd mobile
copy .env.example .env      # EXPO_PUBLIC_API_URL — see below
npm install
npm start                   # scan the QR code with Expo Go
```

**Device testing:** a phone cannot reach `localhost` of your computer. Find your computer's LAN IP (`ipconfig` → e.g. `192.168.1.42`) and set:

```
EXPO_PUBLIC_API_URL=http://192.168.1.42:4000/api
```

Add `exp://192.168.1.42:8081` (and the Expo debug origins) to the backend `CORS_ORIGINS`, restart the backend, then reload Expo. Phone and computer must be on the same Wi-Fi network.

---

## API surface (summary)

All routes are under `/api`, require `Authorization: Bearer <jwt>` (except register/login), are zod-validated, role- and ownership-scoped, and return errors as `{ "error": { "message", "field?" } }`.

- `POST /api/auth/register` · `POST /api/auth/login` · `GET /api/auth/me`
- `GET|POST /api/products` · `GET|PUT|DELETE /api/products/:id` · `POST /api/products/:id/adjust-stock` · query `?search=`, `?lowStock=true`
- `POST /api/sales` (transactional: totals recomputed, stock deducted, receipt `BT-YYYYMMDD-0001` numbered per store/day, low-stock alerts raised) · `GET /api/sales` · `GET /api/sales/:id`
- `GET /api/suppliers/search?q=` · `GET /api/suppliers/linked` · `POST /api/suppliers/link` · `DELETE /api/suppliers/link/:id`
- `POST /api/restock` · `GET /api/restock?status=` · `GET /api/restock/:id` · `POST /api/restock/:id/accept|decline|deliver|verify|discrepancy|resend`
- `GET /api/reports/sales|inventory|restock?from=&to=&format=csv`
- `GET /api/notifications?unread=` · `PATCH /api/notifications/:id/read` · `PATCH /api/notifications/read-all`

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
| Mobile "Cannot reach the server" | Set `EXPO_PUBLIC_API_URL` to the computer's LAN IP (not localhost) and add the Expo origin to backend `CORS_ORIGINS`; restart both. |
| Port 4000 in use | Change `PORT` in `backend/.env` and update the clients' API URLs. |
| Want a clean slate | Stop the backend and delete the `backend/data/` folder — the DB is recreated empty on next start. |
