<div align="center">

# 🗄️ CLOUDVAULT

### *A unified cloud storage command center for multi-account Google Drive management*

`Unified` · `Search` · `Intelligence` · `Neo-Brutalist`

</div>

---

> **One pane of glass for every Google Drive account you own.**
> Connect multiple accounts via OAuth, browse & search files across all of them at once, move bytes between accounts, surface duplicates, and reclaim wasted storage — all from a single striking dashboard.

---

## ✨ Highlights

| | Feature | What it actually does |
|---|---|---|
| 🔐 | **Multi-account OAuth** | Link any number of Google Drive accounts; tokens encrypted at rest with AES-256-GCM, auto-refreshed with a 5-min expiry buffer. |
| 🗂️ | **Unified file browser** | Cursor-paginated listing across all accounts with ownership (owned / shared), category, MIME-type, folder, starred, trashed, and full-text filters. |
| 🔎 | **Full-text search** | PostgreSQL `tsvector` + `plainto_tsquery` ranking across every indexed file in milliseconds. |
| 📁 | **Cross-account file ops** | Rename, copy, move (same *or* across accounts via streaming download → upload → delete), star, trash, restore, permanent delete — plus batch variants. |
| ♻️ | **Duplicate intelligence** | `md5Checksum` grouping with a normalized-name fallback for Google Docs/Sheets (which have no checksums). One-click "Resolve & Reclaim" keeps the keeper and trashes the rest. |
| 📊 | **Live storage analytics** | Per-account and aggregate quota visualization, file-type distribution, stale-file detection. |
| 🎨 | **Neo-Brutalist design system** | Zero border-radius, heavy black borders, flat offset shadows, uppercase monospace, 45° geometric stripes — a deliberate Swiss-modernist point of view, not a template. |

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
Styling      Tailwind CSS v4  →  @tailwindcss/vite plugin + @theme directive (no JS config)
Icons        lucide-react
Routing      ⚡ no react-router — currentTab state in App.tsx + renderContent() switch
Design lang  Neo-Brutalist "geo-" utility classes (custom CSS in index.css)
Fonts        JetBrains Mono (webfont) + Helvetica Neue (system)
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js **20 LTS+**
- A PostgreSQL instance (local Docker, Neon, Supabase…)
- A Redis instance (local Docker, Upstash, Redis Cloud…)
- A Google Cloud project with **OAuth 2.0 credentials** and the **Drive** scope

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

Open **http://localhost:3000** → you'll see the BIND splash → click **Sign in with Google**.

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
| `GET`  | `/api/auth/me` | Current user + connected accounts (200 even when unauthenticated) |

### Accounts
| Method | Path | Purpose |
|---|---|---|
| `GET`    | `/api/accounts` | List connected accounts |
| `DELETE` | `/api/accounts/:id` | Disconnect + cascade delete files/quotas |
| `POST`   | `/api/accounts/:id/sync` | Re-index an account from Drive (synchronous) |
| `GET`    | `/api/accounts/:id/status` | Current sync status (PENDING/SYNCING/SYNCED/ERROR) |

### Files — `files.routes.ts`
Listing (cursor-paginated, 15s Redis cache on first page, COUNT only on first page) · single metadata · download proxy · rename · move (same-account) · **move-across** (cross-account stream) · star · trash · restore · permanent delete · copy · folder creation · batch trash/restore/delete/move.

> Folder creation lives at `POST /api/files`, not `/create-folder`.

### Folders · Search · Storage · Upload · Duplicates · Analytics
```
GET    /api/folders                       Top-level folders across all accounts
GET    /api/folders/:id/contents          Folder children (paginated)

GET    /api/search?q=&limit=&offset=      Full-text search (offset pagination)

GET    /api/storage                       All-account quota + totals
GET    /api/storage/:accountId/quota      Single-account quota (cached 15 min)
POST   /api/storage/:accountId/quota/refresh   Force refresh from Drive

POST   /api/upload                        Multipart upload → auto-routed to the
                                          account with the most free space
GET    /api/upload/:jobId                 Job progress / status
GET    /api/upload/:jobId/download        Download an uploaded file

POST   /api/duplicates/scan               Scan for duplicates (synchronous)
GET    /api/duplicates                    List unresolved groups
GET    /api/duplicates/:id                Single group detail
POST   /api/duplicates/:id/resolve        Trash all but the kept file
                                         (partial failure preserves the group)

GET    /api/analytics/summary             Totals + per-account breakdown
GET    /api/analytics/file-types          Distribution by MIME-category
```

---

## 🗄️ Data Model (Prisma)

8 models · PostgreSQL · full-text `tsvector` on `FileIndex.name`.

```
User  ─┬─ ConnectedAccount ─┬─ FileIndex  (cache of Drive items, rebuildable)
       │                    ├─ StorageQuota
       │                    └─ DuplicateFile
       ├─ Session
       └─ DuplicateGroup ── DuplicateFile ── FileIndex
UploadJob
```

**Enums:** `SyncStatus` (PENDING · SYNCING · SYNCED · ERROR), `UploadStatus` (PENDING · UPLOADING · COMPLETE · FAILED).

`FileIndex` is treated as a **cache**, never as the source of truth — it is always rebuildable from the Drive API via `indexAccount()`. The `isOwned` flag is derived from `owners[].me === true` during indexing; the `owned` query param filters on it without hardcoding.

---

## 🏛️ Architecture Notes

- **Synchronous job execution.** Heavy work (account indexing, uploads, duplicate scans) runs **inline within the HTTP request** rather than on background queues. BullMQ is installed as a dependency but not currently imported / wired. This keeps the request/response cycle simple at the cost of latency on long operations — a deliberate trade-off, not a bug.
- **Token encryption.** OAuth access + refresh tokens are stored AES-256-GCM encrypted in `ConnectedAccount`; `token.service.ts` transparently refreshes with a 5-min buffer before expiry.
- **First-page file listing cache.** 15s in Redis, keyed by `files:${userId}:${sha256(query).slice(0,32)}`. Cursor pages are not cached, and the `COUNT` query only runs on the first (non-cursor) page for performance.
- **Storage quota cache.** 15-min TTL in `StorageQuota`; `getOrRefreshQuota` only hits the Drive `about` API when the cache is stale.
- **Cross-account move.** Streams bytes from the source account → uploads to the destination → deletes from source → re-indexes both. Done synchronously during the request.
- **Duplicate detection fallback.** Google Docs/Sheets/Slides expose `null` `md5Checksum`, so those go through a normalized-name path: strip `Copy of`, `(N)` suffixes, dash-`Copy` tails, lowercase, collapse whitespace.
- **Partial duplicate resolution.** `resolvedAt` is set **only** when every Drive delete succeeds; partial failure preserves the group so you can retry. On resolve, `DuplicateFile` rows are deleted **before** their `FileIndex` rows (FK ordering).
- **Frontend self-fetching.** `FileManagerView` does **not** receive files as props — it owns its own pagination state (page size 50, cursor from `meta.nextCursor`), filter pills, and optimistic CRUD with revert-on-failure toasts.
- **BigInt serialization.** Overridden via `BigInt.prototype.toJSON` in `app.ts` so Prisma's `BigInt` sizes serialize cleanly to JSON strings.

---

## 🎨 Design Language — Neo-Brutalism / Swiss Modernist

The visual identity is a deliberate point of view, defined in `frontend/src/index.css`:

| Token | Effect |
|---|---|
| `.geo-cell` | `border-radius: 0px !important` · `1px solid #000` · `box-shadow: 4px 4px 0px 0px #000` |
| `.geo-btn-primary` | `bg-#000` / `text-#fff` / `box-shadow: 3px 3px 0px 0px #3b82f6` (blue offset) |
| `.geo-btn-secondary` | `bg-#fff` / `text-#000` / `box-shadow: 3px 3px 0px 0px #000` |
| `.geo-stripes` | `repeating-linear-gradient(45deg, #2563eb 10px, #3b82f6 20px)` |
| `.geo-badge-{solid,outline}` | Uppercase mono, zero-radius |

Every interactive surface uses **zero border-radius**, **heavy black borders**, and **flat offset shadows** that translate on hover/active to simulate pressed depth. No gradients, no glassmorphism, no rounded corners — type carries the personality.

---

## 📂 Repository Layout

```
BIND/
├── backend/
│   ├── src/
│   │   ├── app.ts            Express app + BigInt toJSON + stub endpoints
│   │   ├── server.ts         HTTP entry, Prisma/Redis connect, graceful shutdown
│   │   ├── config/           env (zod) · prisma · redis · passport (Google strategy)
│   │   ├── routes/           9 routers — auth, accounts, files, folders, search,
│   │   │                                  storage, upload, duplicates, analytics
│   │   ├── services/         drive · index · token · storage · upload ·
│   │   │                                  duplicates · auth
│   │   ├── middleware/       auth · error (AppError + ZodError) · validate
│   │   ├── utils/            encryption (AES-256-GCM) · logger (Pino) · pagination
│   │   └── types/            express.d.ts · google.types.ts
│   ├── prisma/               schema.prisma (8 models) · migrations/
│   ├── docker-compose.yml    PostgreSQL 16 + Redis 7
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.tsx           Auth gate · splash · routing · data orchestration
│   │   ├── api.ts            apiFetch wrapper (credentials: include)
│   │   ├── types.ts          Domain models
│   │   ├── index.css         Tailwind v4 + Neo-Brutalist geo-* design tokens
│   │   └── components/      SideNav · TopNav · Dashboard · FileManager ·
│   │                          Accounts · Intelligence · Settings · Support · Modals
│   ├── vite.config.ts        Proxy /api → :3001
│   └── index.html
├── .grok/skills/             bullmq · google-drive · prisma · frontend-design · find-skills
└── AGENTS.md                 Detailed engineering reference
```

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
| `npm run dev` | Start Vite dev server on `:3000` (proxies `/api` → `:3001`) |
| `npm run build` | Build production assets to `dist/` |

### Docker Infra
```bash
cd backend
docker compose -p bind up -d            # start PostgreSQL + Redis
docker compose -p bind stop             # stop everything
docker compose -p bind down             # teardown (preserves volumes)
docker compose -p bind down -v          # teardown including data volumes
```

---

## ⚠️ Known Constraints & Gotchas

1. **Synchronous long ops.** Indexing a large Drive account or scanning many duplicates blocks the HTTP request. BullMQ is on the roadmap to move these to background workers.
2. **Upload has a 30s hard timeout** in `upload.service.ts` (`Promise.race` with `setTimeout`). Files that take longer than 30s to push to Drive — even with the 10GB multer limit — will incorrectly fail.
3. **Shared file "delete".** `drive.files.delete` on a shared file removes it from *your* Drive view, not for everyone.
4. **No `folderId=root` default.** Root-level listing returns files from every nesting level — drill into folders for scoped views.
5. **Google Docs/Sheets** have `null` `md5Checksum`; duplicate detection falls back to normalized-name matching.
6. **`supportsAllDrives: true`** is currently only set on `permanentlyDeleteFile`; other Drive calls would need it for shared-drive support.
7. **`invalid_grant` after restart.** Token refresh can fail after a server restart or if Google revokes — the user must re-authenticate via OAuth.
8. **`/api/auth/me` returns 200 (not 401)** with `{ user: null, accounts: [] }` when unauthenticated — a deliberate design choice for the frontend auth gate.

---

## 📋 Status

The repo is a working prototype — every endpoint and view is functional against real Google Drive accounts. The quality floor (core file ops, search, duplicate resolution, multi-account routing) is solid; background job orchestration (BullMQ workers, lazy sync, periodic 30-min sync) is the next major milestone.

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
| `APP_URL` / `FRONTEND_URL` | Used for OAuth redirects |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `LOG_LEVEL` | Pino log level |

---

<div align="center">

**CloudVault / BIND** — *built deliberately.*

</div>
