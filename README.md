# Infotechzone Backend

The single database and API behind the Infotechzone website, Android app,
iOS app **and** admin dashboard (per section 2 of the brief: **one
backend, three front ends** — plus the admin panel that manages it all).
Node.js + Express + SQLite, built so a product added from the admin panel
is immediately available everywhere else.

Two deliberately separate frontend files consume this API:

- `infotechzone-website-live.html` — the public customer site. No admin
  link, button, or reference of any kind — customers have no way to find
  or reach the admin dashboard from here.
- `infotechzone-admin.html` — the admin dashboard. A completely separate
  file with its own URL, gated behind a real login screen. Give this link
  only to Infotechzone staff.

Both point at `API_BASE` (near the top of each file's `<script>`) —
update that constant once, in each file, when you deploy this API
somewhere real.

This has been run end-to-end while building it — register, login,
favourite, guest enquiry, role-gated 401/403s, admin login, adding a
product from the admin and watching it appear on the website — all
verified working in an actual browser before delivery.

## 1. Setup

```bash
npm install
cp .env.example .env        # then edit .env — set a real JWT_SECRET at minimum
npm run seed                 # creates the 8 categories, 10 sample products,
                              # and a first Super Admin:
                              #   amaka@infotechzone.ng / changeme123
                              # change that password immediately in a real deploy
npm start                    # http://localhost:4000
```

`npm run dev` restarts on file changes while you work.

## 2. Deploying it for real

SQLite is a single file (`data/infotechzone.db`) — enough for Infotechzone's
catalogue size for a long time, and it means there's no separate database
service to pay for or manage at launch. Any Node host works (Render,
Railway, Fly.io, a basic VPS); point `DB_FILE` at a persistent disk/volume,
not ephemeral storage, or the catalogue resets on every deploy.

If the business outgrows SQLite later (heavy concurrent writes, multiple
app servers), every query lives in `src/routes/*.js` as plain SQL — moving
to Postgres is a matter of swapping `src/db.js`'s connection and running the
same `CREATE TABLE` statements through a Postgres-flavoured migration; the
route files barely change.

## 3. About the earlier Claude.ai prototype

Earlier in this project there was also a published "Website + Admin
(Connected)" Claude.ai artifact, using a Claude.ai-only shared store
(`window.claude.use('db')`) so the team could test the website and admin
talking to each other before this real backend existed. That only ever
worked for people signed into that Claude.ai workspace — it never served
real customers. `infotechzone-website-live.html` and
`infotechzone-admin.html` are the real replacement: both already call this
API directly (`fetch('/api/...')`, no Claude-specific code), so there's no
migration step left to do — just point `API_BASE` at wherever this backend
ends up deployed. The old Claude.ai artifact link still exists if you want
to compare, but it's no longer the source of truth.

## 4. Authentication

Two separate account types, two separate login routes — a customer token
can never act as an admin token and vice versa.

- **Customers**: `POST /api/auth/register`, `POST /api/auth/login` → JWT.
  Send it as `Authorization: Bearer <token>` on favourites/views calls.
- **Admins**: `POST /api/auth/admin/login` only — there is no public admin
  signup route. The first Super Admin comes from `npm run seed`; every
  other admin account is created by a Super Admin via `POST /api/admins`.

Tokens carry `{ sub, type, role? }` and expire after 30 days.

## 5. Role enforcement (sections 17–19)

| Action | Super Admin | Admin/Manager | Staff |
|---|:---:|:---:|:---:|
| View products / customers | ✅ | ✅ | ✅ |
| Add / edit products | ✅ | ✅ | ✅ |
| Delete products | ✅ | ✅ | ❌ |
| Manage categories | ✅ | ✅ | ❌ |
| Product-level analytics | ✅ | ✅ | ❌ |
| Individual viewer list | ✅ | ❌ | ❌ |
| Manage admin accounts | ✅ | ❌ | ❌ |
| System settings (numbers) | ✅ | ❌ | ❌ |

This is enforced server-side in `src/middleware/auth.js` — `requireAdmin('super')`,
`requireAdmin('super','manager')`, etc. — not just hidden in the UI, matching
section 19's explicit requirement.

## 6. API reference

All routes are prefixed `/api`. 🔓 = public. 🔑 = customer login required.
🛡️ = admin login required (role noted where restricted).

```
🔓  GET    /health
🔓  GET    /settings                          WhatsApp + emergency numbers

    POST   /auth/register                     customer signup
    POST   /auth/login                        customer login
🔑  GET    /auth/me
    POST   /auth/admin/login                  admin login
🛡️  GET    /auth/admin/me

🔓  GET    /products                          ?q= ?category= ?condition=
                                               ?availability= ?sort= ?limit= ?offset=
🔓  GET    /products/:id
🛡️  POST   /products                          any admin tier
🛡️  PUT    /products/:id                      any admin tier
🛡️  DELETE /products/:id                      super, manager only

🔓  GET    /categories
🛡️  POST   /categories                        super, manager only
🛡️  PUT    /categories/:id                    super, manager only
🛡️  DELETE /categories/:id                    super, manager only

🔑  GET    /favourites
🔑  POST   /favourites/:productId
🔑  DELETE /favourites/:productId

🛡️  GET    /customers                          any admin tier — registered customers + activity counts

    POST   /enquiries                         guest or customer — logs a WhatsApp enquiry
🛡️  GET    /enquiries                         ?limit=  any admin tier

🔑  POST   /views                              logs a product view (registered customers only — section 14)
🛡️  GET    /analytics/products                any admin tier
🛡️  GET    /analytics/products/:id/viewers    super only — section 15B

🛡️  GET    /admins                            super only
🛡️  POST   /admins                            super only
🛡️  DELETE /admins/:id                        super only (blocks deleting the last Super Admin)

🛡️  PUT    /settings                          super only
```

## 7. What's deliberately not here yet

Matches "Features that can come later" (section 43) from the brief — none
of this blocks launch: in-app chat, payment/checkout, delivery tracking,
reviews, push notifications, promo campaigns, discount codes. Also out of
scope for this first pass: image upload (product photos are URLs in
`images_json` for now — wire up S3/Cloudinary when real photography is
ready), rate limiting, and automated tests.
