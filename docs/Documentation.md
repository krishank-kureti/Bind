# BIND — Complete Project Documentation

**Product name:** BIND  
**Tagline:** Unified cloud storage command center for multi-account Google Drive management  
**Repository layout:** Monorepo with Express.js API (`backend/`) and React SPA (`frontend/`)  
**Last reviewed against source:** 2026-08-05  

Public product / OAuth home page: `https://bind-one-zeta.vercel.app/about/`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Features](#2-features)
3. [Tech Stack](#3-tech-stack)
4. [Architecture](#4-architecture)
5. [Repository Structure](#5-repository-structure)
6. [Getting Started](#6-getting-started)
7. [Environment Variables](#7-environment-variables)
8. [Infrastructure (Docker)](#8-infrastructure-docker)
9. [Data Model (Prisma)](#9-data-model-prisma)
10. [Backend Reference](#10-backend-reference)
11. [API Reference](#11-api-reference)
12. [Frontend Reference](#12-frontend-reference)
13. [UI Pages & Screens](#13-ui-pages--screens)
14. [Design System (Neo-Brutalist)](#14-design-system-neo-brutalist)
15. [Core Workflows](#15-core-workflows)
16. [Security](#16-security)
17. [Caching & Performance](#17-caching--performance)
18. [Known Constraints & Gotchas](#18-known-constraints--gotchas)
19. [Deployment Notes](#19-deployment-notes)
20. [Commands Cheat Sheet](#20-commands-cheat-sheet)
21. [Project Status & Roadmap](#21-project-status--roadmap)

---

## 1. Overview

**BIND** is a unified multi-account Google Drive management platform. Users authenticate with Google OAuth, connect one or more Drive accounts, and operate on a single indexed view of their files across accounts.

The system:

- Indexes Drive metadata into PostgreSQL (file index is a **rebuildable cache**, not source of truth)
- Encrypts OAuth tokens at rest (AES-256-GCM)
- Stores sessions in Redis
- Runs **periodic full re-index** for active users only (see [Periodic sync](#periodic-sync))
- Surfaces storage quotas, full-text search, duplicate detection, smart upload routing, and cross-account file moves
- Serves static **About / Privacy / Terms** pages for OAuth and legal
- Presents a distinctive Neo-Brutalist / Swiss Modernist frontend (zero radius, heavy borders, offset shadows)

### Ports

| Service | Port |
|---|---|
| Frontend (Vite) | `3000` |
| Backend API | `3001` |
| PostgreSQL | `5432` |
| Redis | `6379` |

In development, Vite proxies `/api` → `http://localhost:3001`. The frontend never calls the backend host directly.

---

## 2. Features

| Area | Capability |
|---|---|
| **Auth** | Google OAuth 2.0 (Passport), session cookies, multi-account linking while signed in; `lastSeenAt` activity |
| **Accounts** | List, sync (re-index), status, disconnect (cascade); logout ends session only |
| **Files** | Unified listing with filters, cursor pagination, rename/move/star/trash/restore/delete/copy |
| **Cross-account move** | Stream download → upload to target → delete source → update index |
| **Folders** | Top-level folders, folder contents, create folder |
| **Search** | PostgreSQL full-text (`tsvector` + `plainto_tsquery`) with ranking |
| **Upload** | Multipart upload (up to 10 GB multer limit), auto-route to account with most free space |
| **Storage** | Per-account + aggregate quota (15-min cache), refresh endpoint |
| **Duplicates** | MD5 groups + name-normalized fallback for Google Docs/Sheets; resolve keeps one, removes rest |
| **Analytics** | Summary totals, file-type distribution |
| **Intelligence UI** | Waste cleanup, scan, resolve groups |
| **Settings / Support** | UI toggles, FAQ, diagnostics stub, ticket form |

---

## 3. Tech Stack

### Backend (`backend/`)

| Layer | Technology |
|---|---|
| Runtime | Node.js **20+** LTS |
| Language | TypeScript (compiled with `tsc`; dev via `tsx watch`) |
| Framework | **Express.js 5** |
| ORM | **Prisma 7** with `@prisma/adapter-pg` + `pg` Pool (adapter-based client) |
| Database | **PostgreSQL 16** |
| Cache / sessions | **Redis 7** via `ioredis`; `connect-redis` session store |
| Auth | **Passport.js** + `passport-google-oauth20` + `express-session` |
| Google API | `googleapis` (Drive v3) |
| Validation | **Zod 4** (env + optional request validation middleware) |
| Uploads | **Multer** (disk storage under `uploads/`) |
| HTTP hygiene | **Helmet** (CSP), **CORS**, **morgan** |
| Logging | **Pino** |
| Encryption | Node `crypto` AES-256-GCM |

> **Note on queues:** BullMQ-style background workers are described in older agent notes and `dist/` artifacts may retain worker builds, but the **current source** runs indexing, uploads, and duplicate scans **synchronously inside HTTP request handlers**. The `backend/src/workers/` directory is empty (placeholder only).

### Frontend (`frontend/`)

| Layer | Technology |
|---|---|
| Runtime | **React 19** |
| Build | **Vite 6** |
| Language | TypeScript |
| Styling | **Tailwind CSS v4** via `@tailwindcss/vite` (no classic `tailwind.config.js` required; tokens in CSS `@theme`) |
| Icons | **lucide-react** |
| Routing | **No react-router** — tab state (`currentTab`) in `App.tsx` |
| HTTP | Thin `apiFetch` wrapper (`credentials: 'include'`) |
| Fonts | Local **Tiempos Text** / **Tiempos Headline** + Google Fonts **JetBrains Mono** for mono labels |
| Deploy config | `vercel.json` rewrites `/api/*` to production API host |

### Tooling / monorepo

- Root `package.json` only pulls `ts-node` for ad-hoc tooling
- Engineering reference also exists in `AGENTS.md` and root `README.md` (prefer this doc + live source when they diverge)

---

## 4. Architecture

```
┌─────────────────────┐     Vite proxy /api      ┌──────────────────────────┐
│  React SPA (:3000)  │ ───────────────────────► │  Express API (:3001)      │
│  App.tsx + views    │  session cookie          │  Passport + Redis session │
└─────────────────────┘                          └────────────┬─────────────┘
                                                              │
                         ┌────────────────────────────────────┼────────────────────┐
                         │                                    │                    │
                         ▼                                    ▼                    ▼
                  ┌─────────────┐                    ┌──────────────┐      ┌──────────────┐
                  │ PostgreSQL  │                    │    Redis     │      │ Google Drive │
                  │ FileIndex,  │                    │ sessions +   │      │ API (OAuth)  │
                  │ accounts,   │                    │ files cache  │      │              │
                  │ quotas,     │                    │ (15s listing)│      │              │
                  │ duplicates  │                    └──────────────┘      └──────────────┘
                  └─────────────┘
```

### Design principles

1. **FileIndex is a cache** — Always rebuildable via `indexAccount()` from Drive API.
2. **Tokens never leave the server unencrypted** — access/refresh tokens stored AES-256-GCM encrypted; decrypted only when calling Drive.
3. **Synchronous long operations** — Account sync, upload processing, and duplicate scan run inline (simpler prototype; higher request latency).
4. **Frontend owns some data locally** — `FileManagerView` self-fetches with pagination; App-level `files` is mainly for dashboard heuristics.
5. **Consistent API envelope** —
   - Success: `{ "success": true, "data": ... }` (list endpoints may include `meta`)
   - Error: `{ "success": false, "error": { "code", "message", "details" } }`

### BigInt JSON

Prisma returns `BigInt` for sizes. `app.ts` patches:

```ts
(BigInt.prototype as any).toJSON = function () { return this.toString(); };
```

so sizes serialize as strings in JSON.

---

## 5. Repository Structure

```
BIND/
├── AGENTS.md                 # Engineering agent reference (may lag source)
├── README.md                 # High-level product README
├── docs/
│   └── Documentation.md      # This file
├── backend/
│   ├── docker-compose.yml    # postgres:16-alpine + redis:7-alpine
│   ├── package.json
│   ├── prisma.config.ts      # Prisma 7 datasource URL config
│   ├── tsconfig.json
│   ├── .env / .env.example
│   ├── prisma/
│   │   ├── schema.prisma     # models + enums (User.lastSeenAt, settings, …)
│   │   └── migrations/       # SQL migration history
│   ├── public/               # Legacy test.html / test.js
│   ├── uploads/              # Multer temp files
│   └── src/
│       ├── app.ts            # Express app, middleware, routes, stubs
│       ├── server.ts         # Listen, Prisma/Redis, startPeriodicSync, shutdown
│       ├── config/
│       │   ├── env.ts        # Zod-validated env
│       │   ├── passport.ts   # Google OAuth strategy + user linking
│       │   ├── prisma.ts     # PrismaClient + pg adapter pool
│       │   └── redis.ts      # ioredis client
│       ├── routes/           # auth, accounts, files, folders, search, storage, upload, duplicates, analytics, settings
│       ├── services/         # drive, index, token, storage, upload, duplicates, auth, periodicSync, activity
│       ├── middleware/       # auth, error, validate
│       ├── utils/            # encryption, logger, pagination, cache
│       ├── types/            # express.d.ts, google.types.ts
│       ├── generated/prisma/ # Prisma client output
│       └── workers/          # Empty (no BullMQ in current source)
└── frontend/
    ├── package.json
    ├── vite.config.ts        # Port 3000, /api → :3001
    ├── vercel.json           # Production API rewrite
    ├── index.html
    ├── public/
    │   ├── about/            # OAuth / product home page
    │   ├── privacy/          # Privacy Policy
    │   ├── terms/            # Terms of Service
    │   ├── fonts/tiempos/    # Local OTF font files
    │   └── images/favicon.png
    └── src/
        ├── main.tsx
        ├── App.tsx           # Auth, splash, tabs, data orchestration
        ├── api.ts            # credentials: include fetch
        ├── settings.ts       # UserSettings API + local theme helpers
        ├── types.ts          # Domain TS interfaces
        ├── index.css         # Tailwind + geo-* design tokens + fonts
        └── components/
            ├── SideNavBar.tsx
            ├── TopNavBar.tsx
            ├── DashboardView.tsx
            ├── FileManagerView.tsx
            ├── AccountsView.tsx
            ├── IntelligenceView.tsx
            ├── SettingsView.tsx
            ├── SupportView.tsx
            └── Modals.tsx    # ConnectAccountModal + UploadModal
```

---

## 6. Getting Started

### Prerequisites

- Node.js **20+**
- Docker Desktop (optional — for local Postgres + Redis)
- Google Cloud project with **OAuth 2.0 Web client** and Drive scope
- OpenSSL or equivalent to generate secrets

### 1. Clone and install

```bash
cd backend && npm install
cd ../frontend && npm install
```

`backend` `postinstall` runs `prisma generate`.

### 2. Environment

```bash
cp backend/.env.example backend/.env
```

Fill required values (see [Environment Variables](#7-environment-variables)). Generate encryption key:

```bash
openssl rand -hex 32
```

### 3. Infrastructure

```bash
cd backend
docker compose -p bind up -d
```

This starts:

- `bind-postgres` — user `bind_user`, password `bind_pass`, db `bind_db` on `:5432`
- `bind-redis` on `:6379`

> If Docker Desktop throws stale “No such container” errors after crashes, always use project name `-p bind`.

Local `DATABASE_URL` example for compose:

```
DATABASE_URL=postgresql://bind_user:bind_pass@localhost:5432/bind_db
REDIS_URL=redis://localhost:6379
```

### 4. Migrations

```bash
cd backend
npm run prisma:migrate
```

### 5. Run servers

```bash
# Terminal 1
cd backend && npm run dev    # → http://localhost:3001

# Terminal 2
cd frontend && npm run dev   # → http://localhost:3000
```

Open **http://localhost:3000** → splash → **Sign in with Google**.

### Google OAuth setup notes

- Authorized redirect URI must match `GOOGLE_CALLBACK_URL` (default `http://localhost:3001/api/auth/google/callback`)
- **Enable Google Drive API** in the same Cloud project as the OAuth client
- **App name:** BIND (must match branding)
- **Application home page:** prefer `https://…/about/` (static product page)
- **Privacy / Terms:** `/privacy/`, `/terms/`
- **Data access scopes (Console + code):**

```
openid
https://www.googleapis.com/auth/userinfo.email
https://www.googleapis.com/auth/userinfo.profile
https://www.googleapis.com/auth/drive
```

- Do **not** add `cloud-platform` (GCP, not Drive)
- Code: Passport + `/api/auth/google` request `openid`, `email`, `profile`, `https://www.googleapis.com/auth/drive`
- Strategy uses `accessType: 'offline'` and `prompt: 'select_account consent'` so refresh tokens are obtained
- Feature justification type: **Drive productivity**
- Testing mode: refresh tokens for test users expire ~**7 days**

### Periodic sync

Defined in `backend/src/services/periodicSync.service.ts`, started from `server.ts`:

| Parameter | Value |
|---|---|
| Check interval | **15 minutes** |
| Full re-index when | `lastSyncedAt` null or older than **30 minutes** |
| User must be active | `User.lastSeenAt` within last **30 days** |
| Skip | `syncStatus` ∈ `SYNCING`, `ERROR` |
| Concurrency | 1 account per tick |
| Operation | Full metadata re-index (`indexAccount`) — **not** duplicates |

Activity stamping: `activity.service.ts` — force on OAuth login; throttled (~1/hour) on `GET /api/auth/me`.

---

## 7. Environment Variables

Validated in `backend/src/config/env.ts` via Zod.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `NODE_ENV` | no | `development` | `development` \| `production` \| `test` |
| `PORT` | no | `3001` | API listen port |
| `APP_URL` | no | `http://localhost:3001` | Backend public URL |
| `FRONTEND_URL` | no | `http://localhost:3000` | OAuth success/failure redirect base |
| `CORS_ORIGINS` | no | `http://localhost:3000` | Comma-separated allowed origins |
| `DATABASE_URL` | **yes** | — | PostgreSQL connection string |
| `REDIS_URL` | no | `redis://localhost:6379` | Redis URL (`rediss://` for TLS / Upstash) |
| `SESSION_SECRET` | **yes** | — | Express session signing secret |
| `GOOGLE_CLIENT_ID` | **yes** | — | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | **yes** | — | OAuth client secret |
| `GOOGLE_CALLBACK_URL` | **yes** | — | OAuth callback URL |
| `ENCRYPTION_KEY` | **yes** | — | **Exactly 64 hex chars** (32 bytes) for AES-256-GCM |
| `LOG_LEVEL` | no | `info` | Pino level |

Invalid env → process exits at startup with field errors printed to console.

---

## 8. Infrastructure (Docker)

File: `backend/docker-compose.yml`

| Service | Image | Container | Ports | Volume |
|---|---|---|---|---|
| postgres | `postgres:16-alpine` | `bind-postgres` | 5432 | `pgdata` |
| redis | `redis:7-alpine` | `bind-redis` | 6379 | `redis_data` |

```bash
docker compose -p bind up -d
docker compose -p bind stop
docker compose -p bind down      # keep volumes
docker compose -p bind down -v   # wipe data
```

---

## 9. Data Model (Prisma)

Schema: `backend/prisma/schema.prisma`  
Client output: `backend/src/generated/prisma`  
Provider: PostgreSQL (URL via `prisma.config.ts` + adapter pool)

### Entity relationship (logical)

```
User
 ├── ConnectedAccount[]
 │    ├── FileIndex[]
 │    ├── StorageQuota?
 │    └── DuplicateFile[]
 ├── Session[]
 └── DuplicateGroup[]
      └── DuplicateFile[] → FileIndex

UploadJob  (standalone by userId / targetAccountId — no FK relations in schema)
```

### Models

#### `User` → table `users`

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| email | String | unique |
| displayName | String? | |
| avatarUrl | String? | |
| lastSeenAt | DateTime? | Last authenticated open of BIND; gates periodic sync (30-day window). Indexed. |
| createdAt / updatedAt | DateTime | |

Migration `20260804010000_add_user_last_seen_at` backfills existing users to `now()` once.

#### `ConnectedAccount` → `connected_accounts`

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| userId | String | FK → User, cascade |
| provider | String | default `"google"` |
| providerAccountId | String | Google subject id |
| email, displayName, avatarUrl | | Account identity |
| accessToken, refreshToken | String | **encrypted** ciphertext |
| tokenExpiresAt | DateTime? | |
| scopes | String[] | e.g. `['drive']` |
| isActive | Boolean | default true |
| lastSyncedAt | DateTime? | |
| syncStatus | SyncStatus | PENDING / SYNCING / SYNCED / ERROR |
| unique | (userId, providerAccountId) | |

#### `FileIndex` → `file_index`

Drive metadata cache. Unique on `(accountId, providerId)`.

| Field | Type | Notes |
|---|---|---|
| name, mimeType | String | |
| size | BigInt? | |
| isFolder, isTrashed, starred, isOwned | Boolean | `isOwned` from `owners[].me` |
| parentFolderId | String? | Drive parent id |
| fullPath | String? | optional path |
| webViewLink, webContentLink, iconLink, thumbnailLink | String? | |
| md5Checksum, sha256Checksum | String? | |
| searchVector | tsvector (Unsupported) | FTS; rebuilt after index |
| createdAtProvider / modifiedAtProvider | DateTime? | |
| indexedAt / updatedAt | DateTime | |

**Indexes:** accountId, name, mimeType, parentFolderId, md5Checksum, isTrashed, starred, isOwned, isFolder, composite `(accountId, isTrashed, parentFolderId)`.

#### `StorageQuota` → `storage_quotas`

| Field | Type |
|---|---|
| accountId | unique FK |
| totalBytes, usedBytes | BigInt |
| driveBytes, gmailBytes, photosBytes, trashBytes | BigInt? |
| refreshedAt | DateTime |

#### `Session` → `sessions`

Custom session rows (userId + Json data + expiresAt). Express sessions also use Redis via `connect-redis`.

#### `UploadJob` → `upload_jobs`

| Field | Type | Notes |
|---|---|---|
| userId, targetAccountId | String | |
| fileName, mimeType | String | |
| sizeBytes | BigInt? | |
| targetFolderId | String? | |
| status | UploadStatus | PENDING / UPLOADING / COMPLETE / FAILED |
| progress | Int | 0–100 |
| errorMessage | String? | |
| resultFileId | String? | Drive file id after success |

#### `DuplicateGroup` → `duplicate_groups`

| Field | Type | Notes |
|---|---|---|
| userId | FK | |
| checksum | String | MD5 or `name:<normalized>` |
| fileSize, totalWaste | BigInt? | waste = size × (count − 1) |
| fileCount | Int | |
| detectedAt / resolvedAt | DateTime | resolvedAt null = open |

#### `DuplicateFile` → `duplicate_files`

Join: group ↔ file ↔ account. Unique `(groupId, fileId)`.

### Enums

```
SyncStatus:   PENDING | SYNCING | SYNCED | ERROR
UploadStatus: PENDING | UPLOADING | COMPLETE | FAILED
```

### Migrations history

| Migration | Purpose |
|---|---|
| `20260529062926_init` | Initial schema |
| `20260530105912_add_search_gin_index` | Full-text GIN index |
| `20260531151053_add_duplicate_files` | Duplicate models |
| `20260531152238_add_is_owned` | Ownership flag |
| `20260608183913_add_file_indexes` | Query indexes (isTrashed, starred, isOwned, isFolder, composite) |

---

## 10. Backend Reference

### 10.1 Entry points

#### `server.ts`

1. `prisma.$connect()`
2. `redis.ping()` (warn if unavailable — sessions fail without Redis)
3. Ensure `uploads/` directory exists
4. `app.listen(env.PORT)`
5. SIGINT/SIGTERM → disconnect Prisma + Redis, exit

#### `app.ts`

Middleware stack (order matters):

1. `trust proxy = 1`
2. Helmet CSP (`defaultSrc self`, scripts self, Google avatar images allowed)
3. CORS (credentials + origins from env)
4. JSON / urlencoded body (10mb JSON limit)
5. Morgan `dev` logging
6. Express-session with Redis store (24h cookie; secure + sameSite `none` in production)
7. Passport initialize + session
8. Static `public/`
9. Route mounts under `/api/*`
10. Health + frontend stub endpoints
11. Global `errorHandler`

### 10.2 Config

| File | Role |
|---|---|
| `env.ts` | Zod parse of process.env |
| `prisma.ts` | Singleton PrismaClient with `PrismaPg` adapter on `pg.Pool` |
| `redis.ts` | `ioredis` with `maxRetriesPerRequest: null`, `enableReadyCheck: false` |
| `passport.ts` | Google strategy; creates/updates User + ConnectedAccount; **fire-and-forget** `indexAccount` after link/re-auth |

**Passport linking rules:**

- If already authenticated (`req.user`): add or refresh a ConnectedAccount on that user (multi-account)
- Else if Google account known: refresh tokens, log that user in
- Else: create User + ConnectedAccount

### 10.3 Middleware

| Middleware | Behavior |
|---|---|
| `requireAuth` | 401 `NOT_AUTHENTICATED` if not session-authenticated |
| `errorHandler` | Maps `AppError`, `ZodError`, else 500 |
| `validate(schema, source)` | Zod for body/query/params (available; not all routes use it) |

### 10.4 Services

#### `auth.service.ts`

- `getUserWithAccounts`, `getUserAccounts`
- `deactivateAccount` (soft), `scheduleAccountSync` (sets PENDING)

#### `token.service.ts`

- `getValidAccessToken(accountId)`
- Decrypts stored token; if expiring within **5 minutes**, refreshes via OAuth2 client and re-encrypts access token

#### `drive.service.ts`

Google Drive v3 wrapper (token via `getValidAccessToken`):

| Function | Drive API |
|---|---|
| `listAllFiles` | `files.list` pageSize 1000, `trashed=false` |
| `getStorageQuota` | `about.get` storageQuota |
| `uploadFile` | `files.create` with media stream |
| `downloadFile` | metadata + `alt=media` stream |
| `renameFile` / `moveFile` / `toggleStarFile` | `files.update` |
| `trashFile` / `restoreFile` | `trashed` flag |
| `permanentlyDeleteFile` | `files.delete` + `supportsAllDrives: true` |
| `copyFile` | `files.copy` |
| `createDriveFolder` | create folder mimeType |

Listed fields include owners (for `isOwned`), checksums, links, parents, etc.

#### `index.service.ts`

- Pages through `listAllFiles`
- Upserts FileIndex in batches of 25
- Sets `isOwned` from `owners[].some(o => o.me === true)` (default true if missing)
- Rebuilds `searchVector` with `to_tsvector('english', name)` for the account

#### `storage.service.ts`

- 15-minute quota cache (`refreshedAt`)
- `getOrRefreshQuota` / `refreshAccountQuota`
- `selectBestAccountForUpload` — active accounts sorted by free bytes descending

#### `upload.service.ts`

- Marks job UPLOADING → streams temp file to Drive → COMPLETE or FAILED
- **30 second hard timeout** via `Promise.race`
- Deletes temp file on success or failure

#### `duplicates.service.ts`

- Loads non-folder, non-trashed files for user
- Groups by `md5Checksum` when present
- Else normalizes name (strip “Copy of”, `(N)`, “- Copy”, lowercase, collapse space) → key `name:<normalized>`
- Upserts DuplicateGroup + DuplicateFile rows
- Deletes stale groups no longer present in scan

### 10.5 Utils

| File | Role |
|---|---|
| `encryption.ts` | AES-256-GCM; format `iv:authTag:ciphertext` hex |
| `logger.ts` | Pino logger |
| `pagination.ts` | Cursor limit parse helpers (1–200 default 50) |

### 10.6 Stub / auxiliary endpoints in `app.ts`

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | `{ status: 'ok', timestamp }` |
| GET | `/api/activities` | Empty array (dashboard activity stub) |
| GET | `/api/intelligence-data` | Stale files (>1 year), largest files, waste estimate |
| POST | `/api/gemini/analyze` | Rule-based “AI” report from duplicate groups (not real Gemini) |
| POST | `/api/accounts` | 400 OAUTH_REQUIRED |
| POST | `/api/accounts/:id/action` | 400 NOT_IMPLEMENTED |
| POST | `/api/files/upload` | 400 USE_MULTIPART (points users to real upload flow) |

---

## 11. API Reference

Unless noted, protected routes require session cookie (`requireAuth`).

### 11.1 Auth — `/api/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/google` | public | Start OAuth (Drive scope, offline, consent) |
| GET | `/google/callback` | public | Passport callback → redirect `FRONTEND_URL/` or `?error=auth_failed` |
| POST | `/logout` | public | Logout, destroy session, clear `connect.sid`, JSON `{ success: true }` |
| GET | `/me` | public | **Always 200**. Unauthenticated → `{ user: null, accounts: [] }`. Authenticated → user + active accounts. No-store cache headers. |

### 11.2 Accounts — `/api/accounts`

| Method | Path | Description |
|---|---|---|
| GET | `/` | List active connected accounts |
| GET | `/:accountId/status` | id, syncStatus, lastSyncedAt, email, displayName |
| DELETE | `/:accountId` | Hard-delete account (cascade FileIndex/quota via Prisma) |
| POST | `/:accountId/sync` | Set SYNCING → `indexAccount` → SYNCED (or ERROR). Returns `totalIndexed`. Idempotent if already SYNCING. |

### 11.3 Files — `/api/files`

#### Listing — `GET /`

Query params:

| Param | Description |
|---|---|
| `accountId` | Filter one account |
| `mimeType` | Exact or prefix with `/*` (e.g. `image/*`) |
| `category` | `docs` or `archives` (mime allowlists) |
| `folderId` | Drive parent id; `root` → `parentFolderId: null` |
| `query` | Case-insensitive name contains |
| `starred` | `true` |
| `trashed` | default non-trashed; `true` / `all` |
| `owned` | `true` / `false` for isOwned filter |
| `limit` | 1–500, default 50 |
| `cursor` | Cursor pagination by FileIndex id |
| `sortBy` | `name` \| `size` \| default modified |
| `sortDir` | `asc` \| `desc` |

Behavior:

- Folders first in order
- COUNT only when no cursor
- First page cached in Redis **15s**: key `files:${userId}:${sha256(query).slice(0,32)}`
- Response: `{ success, data, meta: { limit, hasMore, nextCursor, total } }`

#### Single-file & mutations

| Method | Path | Body | Description |
|---|---|---|---|
| GET | `/:fileId` | — | Metadata + account |
| GET | `/:fileId/download` | — | Stream attachment from Drive |
| POST | `/` | `{ name, folderId? }` | Create folder on first active account |
| PATCH | `/:fileId/rename` | `{ name }` | Rename |
| PATCH | `/:fileId/move` | `{ folderId }` | Same-account move |
| PATCH | `/:fileId/star` | `{ starred? }` | Toggle/set star |
| POST | `/:fileId/trash` | — | Owned → trash; shared → remove from view + delete index |
| POST | `/:fileId/restore` | — | Untrash |
| DELETE | `/:fileId` | — | Permanent delete |
| POST | `/:fileId/copy` | — | Drive copy + index row |
| POST | `/:fileId/move-across` | `{ targetAccountId, targetFolderId? }` | Cross-account stream move |

#### Batch

| Method | Path | Body |
|---|---|---|
| POST | `/batch/trash` | `{ fileIds: string[] }` |
| POST | `/batch/restore` | `{ fileIds }` |
| POST | `/batch/delete` | `{ fileIds }` |
| POST | `/batch/move` | `{ fileIds, folderId }` |

Each returns per-id success/error results. 403 Drive permission errors surface as `PERMISSION_DENIED`.

### 11.4 Folders — `/api/folders`

| Method | Path | Description |
|---|---|---|
| GET | `/` | Top-level folders (`parentFolderId: null`, not trashed). Query `owned`. |
| GET | `/:folderId/contents` | Children of folder id (paginated cursor). Query `limit`, `cursor`, `owned`. |

### 11.5 Search — `/api/search`

| Method | Path | Description |
|---|---|---|
| GET | `/?q=&limit=&offset=&accountId=` | FTS via `searchVector @@ plainto_tsquery('english', q)`, ordered by rank. Offset pagination (not cursor). Max limit 200. |

### 11.6 Storage — `/api/storage`

| Method | Path | Description |
|---|---|---|
| GET | `/` | All accounts quota + summary totals (total/used/free bytes as strings) |
| GET | `/:accountId/quota` | Single account get-or-refresh |
| POST | `/:accountId/quota/refresh` | Force Drive about fetch |

### 11.7 Upload — `/api/upload`

| Method | Path | Description |
|---|---|---|
| POST | `/` | Multipart field `file`; optional `folderId`. Auto-picks best account. Creates UploadJob, processes inline, returns job status. Multer max **10 GB**. |
| GET | `/:jobId` | Job status/progress |
| GET | `/:jobId/download` | Stream completed upload from Drive |

### 11.8 Duplicates — `/api/duplicates`

| Method | Path | Description |
|---|---|---|
| POST | `/scan` | Run `scanDuplicates` synchronously |
| GET | `/` | Unresolved groups (`resolvedAt: null`) with nested files/accounts |
| GET | `/:id` | Single group |
| POST | `/:id/resolve` | Body `{ keepFileId? }` — keep one (default first), delete others from Drive + index. **Partial failure preserves group.** Deletes `DuplicateFile` before `FileIndex`. |

### 11.9 Analytics — `/api/analytics`

| Method | Path | Description |
|---|---|---|
| GET | `/summary` | totalFiles, totalFolders, trashedFiles, storage sums, per-account breakdown |
| GET | `/file-types` | Categories: image, video, audio, text, document, archive, spreadsheet, presentation, data, application, folder, other |

---

## 12. Frontend Reference

### 12.1 Boot sequence

1. `main.tsx` mounts `<App />` in StrictMode with `index.css`
2. `App` calls `GET /api/auth/me`
3. If user present → `fetchAllData()` (accounts + files limit 50 + storage) → main shell
4. If unauthenticated → 3s **splash** (progress bar + BIND logo) → **welcome** with Sign in with Google
5. While auth not checked → render `null` (blank)

### 12.2 App.tsx responsibilities

| Concern | Behavior |
|---|---|
| Auth gate | Splash + welcome vs authenticated shell |
| Tab routing | `currentTab`: dashboard, files, intelligence, accounts, settings, support |
| Data load | Parallel accounts / files / storage; merge quotas into accounts; color hash per email |
| Sync all | `POST /api/accounts/:id/sync` per account; toast 4s success/error |
| Storage refresh | Re-fetch `/api/storage` only |
| Connect account | Navigate to `/api/auth/google` |
| Logout | `POST /api/auth/logout`, clear state, re-show splash |
| Disconnect | `DELETE /api/accounts/:id` |
| Modals | ConnectAccountModal, UploadModal |
| refreshTick | Incremented when upload modal closes → FileManager re-fetch |

Helper transforms:

- MIME → category (`images`, `docs`, `archive`, `data`, `video`, `other`)
- Relative modified labels (`Now`, `5m`, `2h`, `3d`, date)
- Deterministic account colors from email hash

### 12.3 `api.ts`

```ts
export function apiFetch(input, init?) {
  return fetch(input, { ...init, credentials: 'include' });
}
```

All authenticated calls depend on the session cookie.

### 12.4 Types (`types.ts`)

- `CloudAccount` — id, email, quotas, syncStatus, color, provider label, etc.
- `CloudFile` — full index fields + UI helpers (`category`, `modified`, `sizeBytes`, `accountEmail`)
- `ActivityLog` — unused stub shape
- `DuplicateGroup` — group + nested duplicateFiles + wastedSizeBytes
- `StaleFile`, `GeminiReport` — intelligence / AI stub shapes

### 12.5 Vite config

- Port **3000**
- Proxy `/api` → `http://localhost:3001` with `changeOrigin: true`
- Plugins: `@vitejs/plugin-react`, `@tailwindcss/vite`

### 12.6 Production frontend (`vercel.json`)

Rewrites `/api/:match*` to `https://bind-a3nr.onrender.com/api/:match*` so the SPA can keep relative `/api` paths on Vercel.

---

## 13. UI Pages & Screens

There is no URL-based multi-page router. “Pages” are tabs + pre-auth screens.

### 13.1 Splash screen (unauthenticated)

- Full-screen white layout
- BIND wordmark + Cloud icon with blue offset shadow
- Geometric striped progress bar (~3 seconds)
- Copy: “Initializing secure grid… N%”

### 13.2 Welcome / login (unauthenticated)

- Centered card: product pitch (unify accounts, search, duplicates, smart routing)
- **Sign in with Google** → `/api/auth/google`
- Footer: “Powered by Google OAuth 2.0”

### 13.3 Authenticated shell

| Region | Component | Contents |
|---|---|---|
| Left fixed sidebar | `SideNavBar` | Logo BIND, nav items, Add Account, Global Grid Storage bar, Settings/Support, Logout |
| Top fixed header | `TopNavBar` | Current tab title |
| Main content | `renderContent()` | Active view |
| Overlays | Modals + toasts | Connect, Upload, sync notifications |

#### SideNavBar nav items

1. **Dashboard**
2. **File Manager**
3. **Intelligence** (pulsing blue indicator)
4. **Accounts**

Footer: Settings, Support, red Logout.

**Global Grid Storage:** summed `quotaUsed` / `quotaTotal` across accounts with geo-stripes bar.

### 13.4 Dashboard (`DashboardView`)

| Section | Details |
|---|---|
| Waste alert | Client-side heuristic: same `name+size` duplicates in loaded files; amber banner; link to Intelligence |
| Unified Space Accumulator | Used GiB large number, cap, segmented bar by account color, legend, **Sync Live** button |
| Connected Active Integration Nodes | Up to 3 account cards with avatar initial, email, provider, usage bar, % |
| Smart Pack Router | Clickable card → opens UploadModal |

Props from App: accounts, files, sync handlers, navigation to intelligence.

### 13.5 File Manager (`FileManagerView`)

Self-contained browser (does **not** rely on App’s `files` prop for listing).

| Feature | Behavior |
|---|---|
| Ownership pills | All Files / Owned / Shared → `owned` query |
| Category pills | Images, Docs, Audio, Starred, Accounts (toggle off → all) |
| Accounts mode | Grid of account cards → drill into that account’s files |
| Search | 300ms debounce → `query` param |
| Breadcrumb | Files > folder chain; click to jump |
| Table | Icon, name, source chip (account color), size, modified, ⋯ menu |
| Actions | Star, Rename (inline), Copy, Move, Trash — optimistic UI with toast revert |
| Move dialog | Same account vs different account; folder select; cross-account uses `move-across` |
| Load more | Cursor pagination, page size 50, shows remaining count |
| Upload | Opens UploadModal via prop |
| refreshTick | Re-fetch when parent increments |

Folder navigation uses Drive `providerId` as `folderId` filter.

### 13.6 Intelligence (`IntelligenceView`)

| Section | Behavior |
|---|---|
| Waste Cleanup card | Total reclaimable bytes, group count badge, **Scan Now** → `POST /api/duplicates/scan`, wait 3s, reload list |
| Duplicate Groups | Per group: filename, copy count, accounts, each instance row, wasted bytes, **Resolve & Reclaim** |
| Partial resolve | Alert listing failed file errors; group may remain |

Loads `GET /api/duplicates` on mount / when `files` prop changes.

### 13.7 Accounts (`AccountsView`)

| Element | Behavior |
|---|---|
| Header | Count of nodes; Sync All; Add Account |
| Empty state | Connect Google Drive CTA |
| Account card | Initial avatar, name, email, provider, status badge (Active/Syncing/Error/Pending), per-account sync & disconnect |
| Storage bar | Used/total + % |
| Stats grid | Quota total, used, last synced date |

### 13.8 Settings (`SettingsView`)

UI-only controls (local React state; **not persisted** to backend):

| Section | Controls |
|---|---|
| Duplication Engine | Auto/Manual dedup mode; Upload throttle slider 1–20 |
| AI & Intelligence | Gemini Storage Audit toggle |
| Notifications | Sync Alerts toggle |
| Cache & Local Data | Clear button → `alert('Cache cleared.')` |

### 13.9 Support (`SupportView`)

| Section | Details |
|---|---|
| FAQ accordion | 6 items: connect account, sync frequency, disconnect, duplicates, encryption, storage quota |
| System Diagnostics | Runs 4 checks (API, DB, Redis, OAuth). Only OAuth truly hits `/api/auth/me`; others currently marked ok |
| Submit Ticket | Subject + message form; client-side success state only (no backend ticket API) |

### 13.10 Modals (`Modals.tsx`)

#### ConnectAccountModal

- Explains OAuth and metadata-only indexing
- Continue with Google → parent `onSubmit` → redirect OAuth

#### UploadModal

- Drag-and-drop + multi-file browse
- Per-file queue → uploading → success/failed with progress bar
- Sequential `POST /api/upload` FormData
- Grid storage status bar
- Upload All / Done / Cancel
- On close: parent refreshes data + `refreshTick`

---

## 14. Design System (Neo-Brutalist)

Defined primarily in `frontend/src/index.css`.

### Visual principles

- **Zero border-radius** on geo components
- **Heavy black borders** (`1–2px` / Tailwind `border-2 border-black`)
- **Flat offset shadows** (e.g. `4px 4px 0 #000` or blue `#3b82f6`)
- **No glassmorphism / soft gradients** on chrome (stripes used as solid pattern fills)
- Global mild **oblique 6°** type styling
- **No forced uppercase** (`text-transform: none !important`)
- Root **zoom 1.1025** for slightly larger type scale

### Fonts

| Token | Family | Use |
|---|---|---|
| `--font-sans` | Tiempos Text | Body / UI |
| `--font-display` | Tiempos Headline | h1/h2 / display |
| `--font-mono` | JetBrains Mono | Numeric / data labels |

### Utility classes

| Class | Role |
|---|---|
| `.geo-cell` | White panel, black border, 4px black shadow |
| `.geo-cell-interactive` | Hover lift / active press shadow shifts |
| `.geo-btn-primary` | Black fill, white text, blue offset shadow |
| `.geo-btn-secondary` | White fill, black offset shadow |
| `.geo-stripes` | 45° blue diagonal stripes |
| `.geo-stripes-slate` / `-warning` / `-gray` | Variant stripe fills |
| `.geo-badge-solid` / `.geo-badge-outline` | Badge styles |

### Color accents

- Primary blue: `#3b82f6` / `#2563eb`
- Status: emerald (ok), red (error/waste), amber (warning/pending)
- Account colors: hashed palette (`#4285f4`, `#ea4335`, …)

---

## 15. Core Workflows

### 15.1 Sign-in & first index

1. User clicks Sign in with Google  
2. Passport Google strategy creates User + ConnectedAccount (encrypted tokens)  
3. `indexAccount` starts asynchronously after OAuth  
4. Redirect to frontend; `/api/auth/me` returns user  
5. App loads accounts/files/storage  

### 15.2 Multi-account link

1. Already logged in → Add Account / Connect modal  
2. Same OAuth URL; `req.user` set → new ConnectedAccount attached to same User  
3. New account indexed  

### 15.3 Manual sync

1. Accounts or Dashboard Sync  
2. `POST /api/accounts/:id/sync`  
3. Synchronous full Drive list + upserts + searchVector rebuild  
4. Frontend refreshes data  

### 15.4 Smart upload

1. User drops files in UploadModal  
2. `POST /api/upload` with multipart  
3. Backend picks account with most free quota  
4. Temp file on disk → Drive upload (30s timeout)  
5. Job COMPLETE/FAILED returned  

### 15.5 Cross-account move

1. File Manager → Move → Different Account  
2. `POST /api/files/:id/move-across`  
3. Download stream from source → upload to target → permanent delete source → create new FileIndex → delete old index  

### 15.6 Duplicate resolve

1. Intelligence Scan Now  
2. Groups stored with waste bytes  
3. Resolve & Reclaim keeps first (or `keepFileId`)  
4. Removes other copies from Drive; only marks resolved if all removals succeed  

### 15.7 Shared vs owned trash

- **Owned:** Drive trash (`trashed: true`), index `isTrashed: true`  
- **Shared:** permanent delete from *this user’s* Drive view; remove FileIndex  

---

## 16. Security

| Control | Implementation |
|---|---|
| Session | Redis-backed; httpOnly cookie; secure+sameSite none in production |
| OAuth tokens | AES-256-GCM at rest; never returned to frontend |
| Authz | File ops verify FileIndex belongs to a ConnectedAccount of the session user |
| Helmet CSP | Restricts scripts; allows Google avatar images |
| CORS | Explicit origins + credentials |
| Secrets | `.env` not committed; `.env.example` placeholders only |
| Logout | Session destroy + clear cookie |
| `/me` no-store | Prevents cached auth leakage |

File **content** remains in Google Drive; BIND indexes metadata and proxies download/upload when needed.

---

## 17. Caching & Performance

| Cache | Location | TTL | Notes |
|---|---|---|---|
| File listing first page | Redis | 15 seconds | Query-hash key; cursor pages uncached |
| Storage quota | DB `refreshedAt` | 15 minutes | `getOrRefreshQuota` |
| FileIndex | PostgreSQL | Until re-sync | Rebuildable from Drive |
| FTS | `searchVector` | Rebuilt end of `indexAccount` | English config |

Pagination:

- Files / folders: cursor (`take limit+1`, `skip: 1` on cursor)
- Search: offset/limit

---

## 18. Known Constraints & Gotchas

1. **Synchronous heavy work** — Indexing large Drives, uploads, and duplicate scans block HTTP requests (or one periodic-sync slot).
2. **Upload 30s timeout** — Large files may fail even within multer’s 10 GB limit if Drive transfer exceeds 30s.
3. **No BullMQ / lazySync** — `src/workers` empty; older notes that mention queues are obsolete.
4. **Periodic sync gates** — Only active users (30d `lastSeenAt`); skip `ERROR` accounts; check every 15m; re-index if stale 30m.
5. **Logout ≠ disconnect** — Session only; linked Drive accounts and tokens remain until trash disconnect.
6. **`invalid_grant`** — Dead refresh token; reconnect **that** Google account. Logout/login does not fix other linked accounts.
7. **`ACCESS_TOKEN_SCOPE_INSUFFICIENT`** — Console missing Drive scope or old token without Drive; re-consent after fixing Data access.
8. **No default `folderId=root`** — Unfiltered listing returns files across nesting levels; drill folders for scoped views.
9. **Google Docs/Sheets** — `md5Checksum` null → name-based duplicate grouping.
10. **`supportsAllDrives: true`** only on permanent delete today.
11. **Shared delete** removes from user’s view, not global ownership.
12. **UserSettings** are persisted in Postgres; **theme** is browser-local (`bind-theme`). Support ticket form is client-only.
13. **Gemini endpoint** (if present) is heuristic mock, not Google Gemini API.
14. **Support diagnostics** mostly stubbed except `/api/auth/me`.
15. **Dashboard waste banner** may use client-side heuristics — Intelligence uses server duplicate groups.
16. **Express 5** `req.params` typing requires casts to `string`.
17. **Docker compose corruption** — use `-p bind` project name.
18. **OAuth Testing mode** — ~7-day refresh token lifetime for test users.

---

## 19. Deployment Notes

### Backend

- Build: `npm run build` → `prisma generate && tsc && cp -r src/generated dist/generated`
- Start: `npm start` → `node dist/server.js`
- Requires live `DATABASE_URL`, Redis, Google OAuth callback pointing at public API URL
- Production cookies: `secure: true`, `sameSite: 'none'` (needs HTTPS)

### Frontend

- Build: `npm run build` → `dist/`
- Dev proxy only for local; production uses `vercel.json` rewrites to Render API (`bind-a3nr.onrender.com` as currently configured)

### Managed services commonly used

- Postgres: Neon / Supabase / Docker
- Redis: Upstash (`rediss://`) / Docker
- Frontend: Vercel
- Backend: Render (referenced in vercel rewrite)

---

## 20. Commands Cheat Sheet

### Backend

| Command | Description |
|---|---|
| `npm run dev` | `tsx watch src/server.ts` |
| `npm run build` | Generate Prisma client + compile TS |
| `npm start` | Run `dist/server.js` |
| `npm run prisma:migrate` | Dev migrations |
| `npm run prisma:generate` | Client only |
| `npm run prisma:studio` | Prisma Studio UI |

### Frontend

| Command | Description |
|---|---|
| `npm run dev` | Vite on :3000 |
| `npm run build` | Production assets |
| `npm run preview` | Preview production build |

### Docker

```bash
cd backend
docker compose -p bind up -d
docker compose -p bind down
docker compose -p bind down -v
```

---

## 21. Project Status & Roadmap

### Current state

Working prototype against real Google Drive accounts:

- Multi-account OAuth and encrypted tokens
- Full file listing, filters, CRUD-like ops, cross-account move
- Search, storage, uploads, duplicate scan/resolve
- Periodic sync (15m check, 30m stale, active users 30d, skip ERROR)
- Activity tracking (`lastSeenAt`)
- Public about / privacy / terms pages
- Neo-Brutalist multi-tab UI + light/dark theme

### Likely next milestones

1. Optional background jobs for large index / upload / duplicates  
2. UI “Reconnect account” on `invalid_grant` / ERROR  
3. Real support tickets / stronger diagnostics  
4. Shared drive / `supportsAllDrives` consistency  
5. Raise or remove upload 30s timeout; progress streaming  
6. Automated tests (currently no suite in package scripts)

---

## Appendix A — Response envelope examples

**Success**

```json
{
  "success": true,
  "data": { "id": "clx...", "syncStatus": "SYNCED", "totalIndexed": 1240 }
}
```

**List with meta**

```json
{
  "success": true,
  "data": [ /* FileIndex[] */ ],
  "meta": {
    "limit": 50,
    "hasMore": true,
    "nextCursor": "clx_last_id",
    "total": 1200
  }
}
```

**Error**

```json
{
  "success": false,
  "error": {
    "code": "NOT_AUTHENTICATED",
    "message": "Authentication required. Please sign in.",
    "details": {}
  }
}
```

---

## Appendix B — Common error codes

| Code | Typical HTTP | Meaning |
|---|---|---|
| `NOT_AUTHENTICATED` | 401 | Missing session |
| `ACCOUNT_NOT_FOUND` | 404 | Account id invalid for user |
| `FILE_NOT_FOUND` | 404 | File missing or not owned by user |
| `GROUP_NOT_FOUND` | 404 | Duplicate group missing |
| `PERMISSION_DENIED` | 403 | Drive 403 / no modify rights |
| `MISSING_*` | 400 | Validation (name, fileIds, folderId, etc.) |
| `NO_ACCOUNT` / `NO_FILE` | 400 | Upload prerequisites |
| `JOB_NOT_FOUND` | 404 | Upload job |
| `OAUTH_REQUIRED` | 400 | Stub POST /api/accounts |
| `VALIDATION_ERROR` | 400 | Zod issues |
| `INTERNAL_SERVER_ERROR` | 500 | Unhandled |

---

## Appendix C — MIME category mapping (analytics)

| Category | Heuristic |
|---|---|
| image | `image/*` |
| video | `video/*` |
| audio | `audio/*` |
| text | `text/*` |
| document | PDF, Word, Google Doc-like |
| spreadsheet | Excel / spreadsheet mime |
| presentation | PPT / presentation mime |
| archive | zip, rar, tar, 7z |
| data | json, xml, yaml |
| application | other application/* |
| folder | isFolder |
| other | fallback |

Frontend File Manager categories are slightly different (`images`, `docs`, `archive`, `data`) and map filters to API `mimeType` / `category` params.

---

*Documentation last aligned with repository source on **2026-08-05**. When in doubt, treat live code under `backend/src` and `frontend/src` as authoritative.*
