# Rideshare App — Uber Driver Matching, Built from Scratch

End-to-end implementation of the Uber driver matching system design. Every concept from the
[interview topic document](../interview/uber-driver-matching.html) is working code here.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontends                                                       │
│  rider-app  :5173     driver-app  :5174                         │
└────────────────────┬─────────────────────────────────────────────┘
                     │  REST + WebSocket
┌────────────────────▼─────────────────────────────────────────────┐
│  Backend Services                                                 │
│                                                                   │
│  location-service   :3001   WebSocket gateway, Kafka producer    │
│  matching-service   :3002   H3 search, ETA engine, dispatch      │
│  pricing-service    :3003   Flink-style surge per H3 cell        │
│  trip-service       :3004   Trip lifecycle, PostgreSQL           │
│  notification-svc   :3005   WebSocket push to rider + driver     │
└────────────────────┬─────────────────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────────────────┐
│  Infrastructure                                                   │
│  Redis   :6379    GEOADD/GEOSEARCH, locks, surge cache           │
│  Kafka   :9092    driver-locations, ride-requests, trip-events   │
│  Postgres :5432   trips, users, audit log                        │
└──────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Option A — Docker (everything in one command)

```bash
docker compose up --build
```

Ports: rider-app → http://localhost:5173 · driver-app → http://localhost:5174

### Option B — Local dev (faster iteration)

**Prerequisites:** Node 20+, Docker (for Redis / Kafka / Postgres)

```bash
# 1. Start infrastructure only
npm run docker:up

# 2. Install dependencies
npm install

# 3. Apply DB schema + seed data
npm run db:wait && npm run db:migrate

# 4. Start all five services
npm run dev

# 5. In a separate terminal, start frontends
npm run dev -w frontend/rider-app
npm run dev -w frontend/driver-app
```

Or start everything at once:

```bash
npm run dev:all
```

## Services

| Service | Port | Responsibility |
|---|---|---|
| location-service | 3001 | Driver WebSocket gateway, Kafka producer, Redis GEOADD |
| matching-service | 3002 | H3 supply pool, parallel ETA (A\*), wave dispatch, Redis lock |
| pricing-service | 3003 | 5-second surge window per H3 cell, Redis SETEX |
| trip-service | 3004 | Trip CRUD, state machine, PostgreSQL |
| notification-service | 3005 | WebSocket push hub for riders and drivers |

## Key Engineering Concepts Implemented

- **H3 hexagonal indexing** (`shared/h3.ts`) — `latLngToCell`, `gridDisk` ring expansion
- **WebSocket gateway** (`location-service`) — sticky sessions, binary frames, heartbeat
- **Kafka pipeline** — driver-locations topic, manual offset commit, idempotent writes
- **A\* ETA engine** (`matching-service/src/eta.ts`) — road graph, admissible heuristic, traffic blending
- **Wave dispatch** (`matching-service/src/dispatch.ts`) — timeout chain, parallel scoring
- **Redis distributed lock** (`matching-service/src/lock.ts`) — SET NX + Lua release, 10 s TTL
- **Surge pricing** (`pricing-service`) — 5-sec window, EMA smoothing, clamped multiplier
- **CAP-aware data stores** — Redis (AP), PostgreSQL (CP), Cassandra schema ready

## Project Structure

```
rideshare-app/
├── docker-compose.yml
├── package.json               # npm workspaces root
├── tsconfig.base.json
├── .env                       # local dev config
├── infra/
│   └── postgres/init.sql      # schema + seed data
├── shared/
│   ├── types.ts               # shared domain types + Kafka topic names
│   └── h3.ts                  # H3 helpers + Haversine
├── services/
│   ├── location-service/      # Port 3001
│   ├── matching-service/      # Port 3002
│   ├── pricing-service/       # Port 3003
│   ├── trip-service/          # Port 3004
│   └── notification-service/  # Port 3005
├── frontend/
│   ├── rider-app/             # React + Vite, Port 5173
│   └── driver-app/            # React + Vite, Port 5174
└── scripts/
    ├── wait-for-pg.js
    └── migrate.js
```

## Environment Variables

See `.env` for the full list. Key values for local dev:

```
REDIS_URL=redis://localhost:6379
KAFKA_BROKERS=localhost:9092
POSTGRES_URL=postgresql://rideshare:rideshare@localhost:5432/rideshare
```

## Demo Accounts (seeded)

| Name | Role | ID |
|---|---|---|
| Alice Rider | rider | a0000000-...-0001 |
| Bob Rider | rider | a0000000-...-0002 |
| Dave Driver | driver | d0000000-...-0001 |
| Eve Driver | driver | d0000000-...-0002 |
| Frank Driver | driver | d0000000-...-0003 |
