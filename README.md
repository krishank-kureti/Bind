<div align="center">

# 🗄️ BIND

### *A unified cloud storage command center for multi-account Google Drive management*

`Unified` · `Search` · `Intelligence` · `Neo-Brutalist`

</div>

---

> **One pane of glass for every Google Drive account you own.**
> **BIND** connects multiple accounts via OAuth, lets you browse & search files across all of them at once, move bytes between accounts, surface duplicates, and reclaim wasted storage — all from a single striking dashboard.

Public product page (Google OAuth application home page): **https://bind-one-zeta.vercel.app/about/**

---

## ✨ Highlights

| | Feature | What it actually does |
|---|---|---|
| 🔐 | **Multi-account OAuth** | Link any number of Google Drive accounts; tokens encrypted at rest with AES-256-GCM, auto-refreshed with a 5-min expiry buffer. |
| 🗂️ | **Unified file browser** | Cursor-paginated listing across accounts with category, MIME, folder, starred, and search filters. **Owned-only by default**; optional Shared Files setting unlocks All / Owned / Shared pills. List or grid view. Open files in Google via `webViewLink`. |
| 🔎 | **Full-text search** | PostgreSQL `tsvector` + `plainto_tsquery` ranking across every indexed file. |
| 📁 | **Cross-account file ops** | Rename, copy, move (same *or* across accounts via streaming download → upload → delete), star, trash, restore, permanent delete — plus batch variants. Shared-file trash uses a dedicated permission modal. |
| 📤 | **Smart upload routing** | Auto-route to the account with the most free space, or **Manual** mode (pick account in the upload modal). Setting persists per user. |
| ♻️ | **Duplicate intelligence** | MD5 grouping with normalized-name fallback for Google Docs/Sheets. **Owned files only** (shared excluded so resolve can delete). One-click Resolve & Reclaim. |
| 📊 | **Live storage analytics** | Per-account and aggregate quota visualization, file-type distribution. |
| 🔄 | **Sync** | Manual Sync Live + **periodic full re-index** (checks every **15 min**) for accounts of **active users** (opened BIND in last **30 days**), stale &gt; **30 min**, and not in `ERROR`. Uploads and mutations update the index immediately. |
| ⚙️ | **User settings** | Upload mode, sync-alert toasts, show shared files, light/dark theme (theme is browser-local). |
| 🎨 | **Neo-Brutalist design** | Zero border-radius, heavy borders, flat offset shadows, Tiempos + JetBrains Mono, light/dark via `data-theme`. |

---

## 🧱 Tech Stack

### Backend — `backend/`
```
Runtime      Node.js 20 LTS
Framework    Express.js 5 + TypeScript (tsx watch dev, tsc build)
ORM          Prisma 7  →  @prisma/adapter-pg + pg Pool  (adapter-based, not classic datasource URL)
Database     PostgreSQL 16
Cache/Sess   Redis 7  →  ioredis (maxRetriesPerRequest: null)
Auth         Passport.js + Google OAuth 2.0  →  express-session in Redis store
Validation   Zod 4
HTTP hygiene Helmet (CSP), CORS, morgan, BigInt.toJSON override
Logging      Pino
```

### Frontend — `frontend/`
```
Runtime      React 19 + Vite 6
Styling      Tailwind CSS v4  →  @tailwindcss/vite plugin + @theme directive
Icons        lucide-react
Routing      no react-router — currentTab state in App.tsx + renderContent() switch
Design lang  Neo-Brutalist "geo-" utility classes + dark theme tokens (index.css)
Fonts        Tiempos Text / Tiempos Headline (local) + JetBrains Mono (webfont)
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js **20 LTS+**
- A PostgreSQL instance (local Docker, Neon, Supabase…)
- A Redis instance (local Docker, Upstash, Redis Cloud…)
- A Google Cloud project with **OAuth 2.0 credentials**, **Google Drive API** enabled, and scopes: `openid` + `email`/`profile` + `https://www.googleapis.com/auth/drive`

### 1 · Configure environment
```bash
cp backend/.env.example backend/.env
# Fill in: DATABASE_URL, REDIS_URL, SESSION_SECRET,
#          GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL,
#          ENCRYPTION_KEY  (64 hex chars = 32 bytes — generate with openssl rand -hex 32)
```

### 2 · Spin up infra (optional — skip if using managed Postgres/Redis)
```bash
cd backend
docker compose -p bind up -d        # PostgreSQL :5432 + Redis :6379
```
> If Docker Desktop ever throws a stale-container error (`No such container: …`), the `-p bind` flag sidesteps the corrupted compose project state.

### 3 · Database
```bash
cd backend
npm install                         # also runs: prisma generate
npm run prisma:migrate              # create / apply migrations
```

### 4 · Run both servers
```bash
# Terminal 1 — API on :3001
cd backend && npm run dev

# Terminal 2 — UI on :3000  (Vite proxies /api → :3001)
cd frontend && npm run dev
```

Open **http://localhost:3000** → BIND splash → **Sign in with Google**.

---

## 📡 API Surface

All endpoints are mounted under `/api/*` and respond with a consistent envelope:
```json
{ "success": true, "data": { ... } }            // on success
{ "success": false, "error": { "code", "message", "details": {} } }  // on failure
```

### Auth
| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/api/auth/google` | Initiate Google OAuth |
| `GET`  | `/api/auth/google/callback` | OAuth callback → redirect to frontend |
| `POST` | `/api/auth/logout` | Destroy session, clear cookie, return JSON |
| `GET`  | `/api/auth/me` | Current user + connected accounts (**200** even when unauthenticated) |

### Accounts
| Method | Path | Purpose |
|---|---|---|
| `GET`    | `/api/accounts` | List connected accounts |
| `DELETE` | `/api/accounts/:id` | Disconnect + cascade delete files/quotas |
| `POST`   | `/api/accounts/:id/sync` | Full re-index from Drive (**synchronous**) |
| `GET`    | `/api/accounts/:id/status` | Sync status (PENDING / SYNCING / SYNCED / ERROR) |

### Files — `files.routes.ts`
Listing (cursor-paginated, 15s Redis cache on first page, COUNT only on first page) · single metadata · download proxy · rename · move (same-account) · **move-across** · star · trash · restore · permanent delete · copy · folder creation · batch trash/restore/delete/move.

Query filters include `owned`, `accountId`, `folderId`, `mimeType`, `category`, `starred`, `query`, `cursor`, `limit`.

> Folder creation lives at `POST /api/files`, not `/create-folder`.

### Folders · Search · Storage · Upload · Duplicates · Analytics · Settings
```
GET    /api/folders                       Top-level folders across all accounts
GET    /api/folders/:id/contents          Folder children (paginated)

GET    /api/search?q=&limit=&offset=      Full-text search (offset pagination)

GET    /api/storage                       All-account quota + totals
GET    /api/storage/:accountId/quota      Single-account quota (cached 15 min)
POST   /api/storage/:accountId/quota/refresh   Force refresh from Drive

POST   /api/upload                        Multipart; optional accountId, else most free space
GET    /api/upload/:jobId                 Job progress / status
GET    /api/upload/:jobId/download        Download an uploaded file

POST   /api/duplicates/scan               Scan owned files only (synchronous)
GET    /api/duplicates                    Unresolved groups (owned copies only)
GET    /api/duplicates/:id                Single group detail
POST   /api/duplicates/:id/resolve        Delete extras; keep one (partial failure preserves group)

GET    /api/analytics/summary             Totals + per-account breakdown
GET    /api/analytics/file-types          Distribution by MIME-category

GET    /api/settings                      User prefs (upsert defaults if missing)
PATCH  /api/settings                      { uploadMode, notificationsEnabled, showSharedFiles }
```

---

## 🗄️ Data Model (Prisma)

**9 models** · PostgreSQL · full-text `tsvector` on `FileIndex.name`.

```
User  ─┬─ ConnectedAccount ─┬─ FileIndex  (cache of Drive items, rebuildable)
       │  (lastSeenAt)      ├─ StorageQuota
       │                    └─ DuplicateFile
       ├─ Session
       ├─ UserSettings      (uploadMode · notifications · showSharedFiles)
       └─ DuplicateGroup ── DuplicateFile ── FileIndex
UploadJob
```

**Enums:** `SyncStatus` (PENDING · SYNCING · SYNCED · ERROR), `UploadStatus` (PENDING · UPLOADING · COMPLETE · FAILED).

`User.lastSeenAt` gates background re-index to users who opened BIND in the last 30 days.

`FileIndex` is a **cache**, always rebuildable via `indexAccount()`. `isOwned` is set from Drive `owners[].me` during indexing. The `owned` query param filters on it without a hardcoded default in the API (the **frontend** defaults to owned-only unless `showSharedFiles` is on).

---

## 🏛️ Architecture Notes

- **Mostly synchronous long ops.** Indexing (manual + periodic), uploads, and duplicate scans run **inline in the HTTP request** (or on a server interval for periodic sync). There is **no BullMQ worker stack** in current source (`backend/src/workers/` is empty).
- **Periodic sync** (`periodicSync.service.ts`, started on boot):
  - **Check interval:** every **15 minutes**
  - **Full re-index eligibility:** `lastSyncedAt` null or older than **30 minutes**
  - **Active users only:** parent `User.lastSeenAt` within the last **30 days** (stamped on login + throttled on `GET /api/auth/me`)
  - **Skip** accounts with `syncStatus` `ERROR` or `SYNCING` (broken tokens stop hammering Google until reconnect / manual sync)
  - **Concurrency:** 1 account per tick
  - What it does: full Drive `files.list` metadata re-index into `FileIndex` — **not** duplicate detection
- **Activity tracking.** `User.lastSeenAt` + `activity.service.ts`. Migration backfills existing users once; ongoing activity keeps them in the window.
- **Real-time index on mutations.** Upload completion upserts `FileIndex`; trash/rename/move/etc. update the DB and **invalidate** Redis file-list cache keys for that user.
- **Token encryption.** Access + refresh tokens AES-256-GCM in `ConnectedAccount`; refresh with a 5-min buffer before expiry. `invalid_grant` means the refresh token is dead — user must reconnect that Google account (logout alone does not fix other linked accounts).
- **First-page file listing cache.** 15s in Redis: `files:${userId}:${sha256(query).slice(0,32)}`. Cursor pages not cached; COUNT only on first page.
- **Storage quota cache.** 15-min TTL via `StorageQuota.refreshedAt`.
- **Cross-account move.** Stream source → upload destination → delete source → index rows updated in-request.
- **Duplicates: owned only.** Scan/list/resolve ignore shared files so reclaim can permanently delete extras.
- **Shared file trash.** Modal explains limited permissions; “Remove from my list” attempts Drive remove and always drops the local index row when Drive forbids delete.
- **Frontend self-fetching.** `FileManagerView` owns pagination (page size 50), list/grid, filters, action menu (left of each row), optimistic CRUD + toasts.
- **Settings hybrid storage.** Product prefs in `UserSettings` (Postgres); **theme** in `localStorage` (`bind-theme`).
- **BigInt serialization.** `BigInt.prototype.toJSON` in `app.ts` → JSON strings.
- **Sessions.** Redis-backed cookies; survive deploys if Redis + `SESSION_SECRET` stay stable.

---

## 🎨 Design Language — Neo-Brutalism / Swiss Modernist

Defined in `frontend/src/index.css` (plus light/dark tokens via `html[data-theme]`):

| Token | Effect |
|---|---|
| `.geo-cell` | `border-radius: 0` · black border · flat offset shadow |
| `.geo-btn-primary` | Black fill, white text, blue offset shadow (soft navy in dark mode) |
| `.geo-btn-secondary` | White fill, black offset shadow |
| `.geo-stripes` | 45° diagonal stripe fill (muted in dark mode) |
| Theme | `data-theme="light" \| "dark"`; favicon at `/images/favicon.png` |

Zero border-radius, heavy borders, flat shadows — no glassmorphism. Body uses **Tiempos**; mono labels use **JetBrains Mono**.

---

## 📂 Repository Layout

```
BIND/
├── backend/
│   ├── src/
│   │   ├── app.ts            Express app + BigInt toJSON + stub endpoints
│   │   ├── server.ts         HTTP entry, Prisma/Redis, periodic sync, shutdown
│   │   ├── config/           env (zod) · prisma · redis · passport
│   │   ├── routes/           auth, accounts, files, folders, search,
│   │   │                     storage, upload, duplicates, analytics, settings
│   │   ├── services/         drive · index · token · storage · upload ·
│   │   │                     duplicates · auth · periodicSync · activity
│   │   ├── middleware/       auth · error · validate
│   │   ├── utils/            encryption · logger · pagination · cache
│   │   └── types/            express.d.ts · google.types.ts
│   ├── prisma/               schema.prisma · migrations/
│   ├── docker-compose.yml    PostgreSQL 16 + Redis 7
│   └── .env.example
├── frontend/
│   ├── public/
│   │   ├── about/            Static OAuth / product home page
│   │   ├── privacy/          Privacy Policy
│   │   ├── terms/            Terms of Service
│   │   ├── fonts/tiempos/    Local Tiempos OTFs
│   │   └── images/favicon.png
│   ├── src/
│   │   ├── App.tsx           Auth · splash · tabs · data · settings state
│   │   ├── api.ts            apiFetch (credentials: include)
│   │   ├── settings.ts       Theme localStorage + /api/settings helpers
│   │   ├── types.ts          Domain models
│   │   ├── index.css         Tailwind v4 + geo-* + dark theme
│   │   └── components/       SideNav · TopNav · Dashboard · FileManager ·
│   │                          Accounts · Intelligence · Settings · Support · Modals
│   ├── vite.config.ts        Proxy /api → :3001
│   └── index.html
├── docs/
│   └── Documentation.md      Full product/engineering doc
└── AGENTS.md                 Engineering agent reference (may lag source)
```

---

## 🖥️ Frontend tabs (at a glance)

| Tab | Role |
|---|---|
| **Dashboard** | Storage accumulator, account cards, Smart Pack Router upload, Sync Live |
| **File Manager** | Self-fetching list/grid, owned-only by default, category pills, ⋯ menu left, open-in-Drive |
| **Intelligence** | Waste cleanup + owned duplicate groups; open files; resolve & reclaim |
| **Accounts** | Connect/disconnect, per-account sync, quotas |
| **Settings** | Dedup mode (local), upload auto/manual, shared-files toggle (+ warning), sync alerts, theme, clear local cache |
| **Support** | FAQ, diagnostics stub, ticket form (client-only) |

---

## ⚙️ Commands Cheat Sheet

### Backend
| Command | Description |
|---|---|
| `npm run dev` | Start dev server with hot reload (`tsx watch src/server.ts`) |
| `npm run build` | `prisma generate && tsc` and copy generated client |
| `npm start` | Run compiled production server |
| `npm run prisma:migrate` | Apply / create migrations (dev) |
| `npm run prisma:generate` | Regenerate Prisma client |
| `npm run prisma:studio` | Open Prisma Studio |

### Frontend
| Command | Description |
|---|---|
| `npm run dev` | Vite on `:3000` (proxies `/api` → `:3001`) |
| `npm run build` | Production assets to `dist/` |
| `npm run preview` | Preview production build |

### Docker Infra
```bash
cd backend
docker compose -p bind up -d            # start PostgreSQL + Redis
docker compose -p bind stop             # stop everything
docker compose -p bind down             # teardown (preserves volumes)
docker compose -p bind down -v          # teardown including data volumes
```

---

## 🌐 Public static pages (OAuth / legal)

Served from `frontend/public/` on Vercel (not the React shell):

| URL | Purpose |
|---|---|
| `/about/` | Product / **Google OAuth application home page** |
| `/privacy/` | Privacy Policy |
| `/terms/` | Terms of Service |
| `/` | React app (auth gate, dashboard) |

Browser titles for public + app shell use product name **BIND**. Consent screen App name should match.

### Google Cloud OAuth Data access (required)

```
openid
https://www.googleapis.com/auth/userinfo.email
https://www.googleapis.com/auth/userinfo.profile
https://www.googleapis.com/auth/drive
```

Do **not** use `cloud-platform` (GCP, not Drive). Enable **Google Drive API**. Feature type for full Drive: **Drive productivity**.

---

## ⚠️ Known Constraints & Gotchas

1. **Synchronous long ops.** Large Drive indexes, uploads, and duplicate scans block the request (or a single periodic-sync slot).
2. **Upload 30s hard timeout** in `upload.service.ts` — large files may fail even within the multer size limit.
3. **Shared files.** Drive `files.delete` is not a reliable “Remove from Shared with me” for every share; 403 is common. UI warns when enabling shared files and when trashing shared items.
4. **No `folderId=root` default.** Unscoped listing can span nesting levels — drill into folders for scoped views.
5. **Google Docs/Sheets** often have `null` `md5Checksum` → name-based duplicate matching.
6. **`supportsAllDrives: true`** is used on permanent delete; broader Shared Drive support may need more API flags.
7. **`invalid_grant`.** Refresh token dead (revoke, Testing 7-day expiry, client/secret change, encryption key change). Reconnect **that** Drive account; logout does not refresh other linked accounts. Accounts in `ERROR` are skipped by periodic sync.
8. **`ACCESS_TOKEN_SCOPE_INSUFFICIENT`.** Token lacks Drive scope — fix Console Data access + re-consent.
9. **`/api/auth/me` returns 200** with `{ user: null, accounts: [] }` when logged out (frontend auth gate). Stamps `lastSeenAt` when authenticated (throttled).
10. **Logout** ends the BIND **session** only (not disconnect all Drive accounts). Splash after logout is ~3s by design.
11. **Re-deploy logouts.** Sessions live in Redis; changing `SESSION_SECRET` or wiping Redis logs everyone out. Frontend-only deploys do not.
12. **OAuth Testing mode.** Refresh tokens for test users expire ~**7 days** — re-consent required.

---

## 📋 Status

Working prototype against real Google Drive accounts: multi-account OAuth, file ops, search, upload routing, owned-only duplicates, settings, light/dark UI, and periodic + mutation-aware indexing. Optional next steps include true background job queues and a more faithful “remove from Shared with me” path.

---

## 🔐 Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis URL (`rediss://` for TLS — required for Upstash) |
| `SESSION_SECRET` | Express session signing secret |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` | OAuth credentials |
| `ENCRYPTION_KEY` | 32-byte hex (64 chars) for AES-256-GCM token encryption |
| `PORT` (default `3001`) | Backend port |
| `APP_URL` / `FRONTEND_URL` | OAuth redirects and links |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `LOG_LEVEL` | Pino log level |

---

## ⏱️ Free-tier keep-alive (Render)

Render’s **free** web service **spins down after ~15 minutes** with no traffic. This repo includes a GitHub Actions cron that hits `/api/health` every **10 minutes**:

- Workflow: [`.github/workflows/keep-alive.yml`](.github/workflows/keep-alive.yml)
- Default URL: `https://bind-a3nr.onrender.com/api/health` (override with repo variable `RENDER_HEALTH_URL`)
- Health check also pings **Postgres** and **Redis** so Neon can be woken when the app is woken

| Service | Needs keep-alive? | Free-tier notes |
|---|---|---|
| **Render (API)** | **Yes** | Hibernates when idle. Cron/uptime pings keep it warm. **Always-on free has monthly hour limits** — 24/7 pinging can burn free hours; upgrade if you outgrow it. |
| **Neon (Postgres)** | **Usually no separate cron** | Compute **auto-suspends** when idle. Hitting `/api/health` (which runs `SELECT 1`) while the API is up warms Neon. First request after sleep is slower (cold start). |
| **Upstash (Redis)** | **No** | Serverless Redis doesn’t “sleep” like Render free web services. Usage is request-based; no cron required for availability. |

Enable **GitHub → Actions** on the repo after push so the schedule runs. You can also use a free external monitor (e.g. UptimeRobot every 5–10 min) against the same health URL.

---

<div align="center">

**BIND** — *built deliberately.*

</div>

