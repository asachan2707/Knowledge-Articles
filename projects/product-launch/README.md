# Product Launch — Real-Time Web App

Phase 5 scaling demo. A production-ready product launch page with live waitlist counter, real-time countdown, flash sale with atomic inventory, and admin dashboard.

## Tech Stack

| Layer       | Technology                                        |
|-------------|---------------------------------------------------|
| Backend     | Node.js (ESM) · Express · Socket.io               |
| Database    | PostgreSQL (persistent data)                      |
| Cache/Queue | Redis (counters, pub/sub, BullMQ jobs)            |
| Frontend    | React 18 · Vite · react-router-dom                |
| Workers     | BullMQ email worker fleet (separate process)      |

## Phase 5 Patterns Demonstrated

- **Redis atomic DECR** — flash sale inventory with zero race conditions under 100k concurrent requests
- **Redis pub/sub → Socket.io** — any server instance broadcasts to all connected clients (horizontal scaling)
- **BullMQ worker fleet** — email processing fully decoupled from API, separate concurrency + rate limits
- **Stateless API servers** — no in-memory state; add instances freely behind a load balancer
- **Graceful shutdown** — drain in-flight requests, close DB pool, quit Redis before exit
- **Rate limiting per endpoint** — waiting room for buy, strict limit for join

## Quick Start

### Prerequisites
- Node.js ≥ 18
- PostgreSQL running locally
- Redis running locally

### 1. Setup
```bash
# From project root
npm run setup         # installs all three package.json files

# Copy env files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# Edit backend/.env with your DATABASE_URL and REDIS_URL
```

### 2. Database
```bash
npm run dev:backend -- --run db:migrate   # or: cd backend && npm run db:migrate
cd backend && npm run db:migrate
cd backend && npm run db:seed
```

### 3. Run everything
```bash
# Terminal 1 — API server + Socket.io
npm run dev:backend

# Terminal 2 — Email worker fleet (separate process, scales independently)
npm run dev:worker

# Terminal 3 — React frontend
npm run dev:frontend
```

Or all at once (no worker):
```bash
npm run dev
```

### 4. Open
- Launch page: http://localhost:5173
- Admin panel: http://localhost:5173/admin

## Architecture

```
Browser ──WebSocket──► Socket.io Server ◄── Redis pub/sub ◄── Any API server
                            │
Browser ──HTTP──────► Express API ──► PostgreSQL (persistent)
                            │
                          Redis (atomic counters + sessions)
                            │
                         BullMQ Queue ──► Worker Fleet (emails)
```

## API Endpoints

| Method | Path                        | Auth   | Description                        |
|--------|-----------------------------|--------|------------------------------------|
| GET    | /api/launch/status          | public | Launch config + flash stock        |
| POST   | /api/launch/buy             | public | Atomic flash sale reservation      |
| POST   | /api/waitlist/join          | public | Join waitlist                      |
| GET    | /api/waitlist/count         | public | Live waitlist count                |
| POST   | /api/admin/launch           | admin  | Fire launch + queue emails         |
| POST   | /api/admin/reset            | admin  | Reset to pre-launch (demo)         |
| GET    | /api/admin/stats            | admin  | KPI dashboard data                 |
| GET    | /api/admin/registrations    | admin  | Paginated registrations list       |

## Socket.io Events

| Event              | Direction      | Payload                       |
|--------------------|----------------|-------------------------------|
| waitlist:count     | server→client  | `{ count: number }`           |
| viewers:update     | server→client  | `{ count: number }`           |
| flash:stock        | server→client  | `{ remaining: number }`       |
| launch:fired       | server→client  | `{ launchedAt: string }`      |
| launch:reset       | server→client  | `{}`                          |
