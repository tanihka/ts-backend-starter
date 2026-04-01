# App Backend

Production-grade REST API for the MomKidCare platform, built with **Node.js + Express + TypeScript + MongoDB**.

---

## Tech Stack

| Layer | Library | Version |
|---|---|---|
| Runtime | Node.js | ≥ 18 |
| Framework | Express | ^5.2 |
| Language | TypeScript | ^6.0 |
| Database | MongoDB (native driver) | ^7.1 |
| Security | Helmet | ^8.1 |
| CORS | cors | ^2.x |
| NoSQL injection | Custom middleware (Express 5 compatible) | — |
| Rate limiting | express-rate-limit | ^8.3 |
| File uploads | Multer | ^2.1 |
| Logging | Pino | ^9.x |
| HTTP request logs | pino-http | ^10.x |
| Log formatting (dev) | pino-pretty | ^13.x |
| Config | dotenv | ^17.3 |
| Dev server | Nodemon + ts-node | latest |

---

## Project Structure

```
src/
├── server.ts              ← Entry point: DB connect → HTTP listen → graceful shutdown
├── app.ts                 ← Express factory (importable in tests, no side effects)
├── config/
│   ├── env.ts             ← Centralised env validation — crashes at boot if vars missing
│   └── db.ts              ← MongoDB singleton: connectDB(), getDB(), closeDB()
├── controllers/           ← Thin request handlers (delegates to services)
├── services/              ← All business logic lives here
├── routes/
│   └── index.ts           ← Root API router mounted at /api/v1
├── middleware/
│   ├── errorHandler.ts    ← Global 4-argument Express error handler
│   ├── notFound.ts        ← 404 catch-all (registered after all routers)
│   ├── rateLimiter.ts     ← globalRateLimiter (100/15min) + authRateLimiter (10/15min)
│   ├── requestLogger.ts   ← pino-http request/response logger + requestId injection
│   └── security.ts        ← configureHelmet, configureCors, configureMongoSanitize, sanitizeBody
├── utils/
│   ├── ApiError.ts        ← Custom operational error class with statusCode
│   ├── ApiResponse.ts     ← Standard { success, message, data, meta } envelope
│   └── logger.ts          ← Pino instance (JSON in prod, pretty in dev)
└── types/
    └── express.d.ts       ← Express Request augmentation (req.requestId, req.user, etc.)
```

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- MongoDB running locally **or** a MongoDB Atlas connection string

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/app
ALLOWED_ORIGINS=http://localhost:5173
```

### 3. Run in development (hot-reload)

```bash
npm run dev
```

### 4. Build for production

```bash
npm run build       # compiles TypeScript → dist/
npm run start       # runs dist/server.js
```

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start with Nodemon + ts-node (no build step) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start` | Run compiled production build |
| `npm run type-check` | Type-check without emitting files |

---

## API Endpoints

Base URL: `/api/v1`

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/health` | Server health check | None |

> More endpoints will be added here as features are built.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | No | `development` \| `production` \| `test` (default: `development`) |
| `PORT` | No | HTTP port (default: `3000`) |
| `MONGODB_URI` | **Yes** | Full MongoDB connection string |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins (default: `http://localhost:5173`) |

---

## Architecture Decisions

- **`app.ts` vs `server.ts` split** — Express app is importable in tests without opening a socket or connecting to DB. `supertest(app)` works without `listen()` or a real MongoDB connection.
- **Fail-fast env validation** — Missing required variables crash the process at startup with a clear message, not silently at runtime mid-request.
- **MongoDB singleton** — `MongoClient` manages an internal connection pool; multiple clients would waste connections.
- **`ApiError.isOperational`** — Distinguishes expected errors (send message to client) from bugs (log full stack + hide message in production).
- **Standard response envelope** — `{ success, message, data, meta }` lets clients write one generic handler for every endpoint.
- **Two rate limiters** — Auth routes get a stricter limit (10 req / 15 min) to prevent brute-force attacks.
- **Pino over Morgan** — Morgan logs plain text strings at request-start time and never knows the final status code or response time. Pino logs after `response.finish`, capturing `statusCode`, `responseTime`, and `requestId` as structured JSON fields that log aggregators (Datadog, CloudWatch, ELK) can query and alert on directly.
- **`requestId` per request** — Every incoming request is assigned a UUID v4 via `crypto.randomUUID()` (no extra packages). The ID is attached to `req.requestId` and included in every pino log line. With concurrent traffic, this is the only way to correlate log lines from a controller, a service call, and a DB query that all belong to one user's request.
- **`requestLogger` before `rateLimiter`** — Even throttled/blocked requests are logged for audit purposes. Placing logging after rate-limiting would make abuse attempts invisible in your logs.
- **Pino-pretty dev-only** — `pino-pretty` is a `devDependency` only. It runs in a worker thread (no blocking) in development. Production emits raw newline-delimited JSON straight to stdout for ingestion by the container log driver or log shipper.
- **CORS allowlist, never wildcard** — `"*"` is incompatible with `credentials: true`. Named origins are required to allow cookies and Authorization headers. Server-to-server calls (no `Origin` header) are always permitted.
- **`configureCors` before `configureHelmet`** — OPTIONS preflight requests must receive CORS headers before any other middleware can reject them. If Helmet ran first and set a restrictive CSP before CORS approved the origin, preflights would fail silently.
- **Custom mongo sanitizer after body parsing** — Strips `$` and `.` characters from `req.body`, `req.params`, and `req.query` keys in-place before they reach any service or DB query. Without it, `{ "email": { "$gt": "" } }` bypasses login — MongoDB evaluates it as "greater than empty string", matching every user. `express-mongo-sanitize` was removed because it reassigns `req.query`, which is a read-only getter in Express 5.
- **sanitizeBody after mongo-sanitize** — Encodes `<` and `>` in string values and drops `__proto__`/`constructor`/`prototype` keys. Prevents stored XSS (injected `<script>` tags saved to DB and rendered elsewhere) and prototype-pollution attacks that can silently corrupt `Object.prototype` app-wide.
- **Helmet CSP over a separate XSS library** — Content Security Policy in Helmet tells the browser to refuse executing inline scripts from unknown origins. This is the correct, standards-based XSS defence — not a regex scrubber. The `sanitizeBody` middleware is an additional depth-of-defence to protect against stored XSS in non-browser consumers (mobile apps, server-side rendering).

---

## Step-by-Step Build Log

| Step | Status | Description |
|---|---|---|
| 1 | ✅ Done | Project structure + TypeScript + clean architecture |
| 2 | ✅ Done | Express server setup (app/server split, middleware pipeline, health check) |
| 3 | ✅ Done | Production-grade logging (Pino, structured JSON, requestId, request lifecycle logs) |
| 4 | ✅ Done | Security layer (Helmet CSP, CORS allowlist, NoSQL injection, XSS, prototype pollution) |
| 5 | 🔜 Next | Authentication (register, login, JWT) |
| 6 | — | Consumer & provider profiles |
| 7 | — | Booking system |
| 8 | — | File uploads (profile photos) |
| 9 | — | Notifications |

### Step 2 — Express Server Setup

**What was added:**
- `app.ts` — pure Express factory with ordered middleware pipeline: `helmet → requestLogger → rateLimiter → body parsers → router → 404 → errorHandler`
- `server.ts` — process bootstrap: `connectDB → listen → SIGTERM/SIGINT graceful shutdown → unhandledRejection safety net`
- `GET /api/v1/health` — unauthenticated health check for load balancers
- `middleware/errorHandler.ts`, `middleware/notFound.ts`, `middleware/rateLimiter.ts`

**Why app and server are separate:**  
`server.ts` has side effects (`listen`, DB connect). `app.ts` does not. Tests can `import app` and call `supertest(app).get('/health')` — no open port, no DB needed.

**Middleware order matters:**
```
cors()            ← OPTIONS preflights answered before any other middleware
helmet()          ← security headers on every response, including errors
requestLogger     ← log everything, including rate-limited requests  
rateLimiter       ← block flood before body is parsed (saves CPU)
express.json()    ← parse body only after rate check passes
mongoSanitize()   ← strip $ / . operators from parsed body keys
sanitizeBody      ← encode < > in values, drop prototype-pollution keys
router            ← feature routes
notFound()        ← 404 only fires if no router matched
errorHandler()    ← must be last (4-arg signature)
```

### Step 3 — Production-Grade Logging

**What changed (and why):**

| Before | After | Reason |
|---|---|---|
| `morgan` | removed | Logs flat text at request-start; never sees final status code or response time |
| Custom `console.log` wrapper | `pino` logger | JSON output, log levels, worker-thread serialisation — ~5× faster than winston |
| No request tracing | `pino-http` + `requestId` | Correlates all log lines (controller, service, DB) for one request across concurrent traffic |
| `morgan` in `app.ts` | `requestLogger` middleware | Structured, fires after response finishes, includes `requestId` + `responseTime` |

**Log shape in production (JSON):**
```json
{
  "level": "info",
  "time": "2026-04-01T10:42:01.123Z",
  "req": { "id": "a3f2c1d4-...", "method": "GET", "url": "/api/v1/health" },
  "res": { "statusCode": 200 },
  "responseTime": 3,
  "msg": "request completed"
}
```

**Log levels:**
- `5xx` or thrown error → `error` (alert-worthy)
- `4xx` → `warn` (client mistake)
- everything else → `info`
- `debug` — suppressed in production

**Using `requestId` in controllers:**
```typescript
export async function createBooking(req: Request, res: Response) {
  const { requestId } = req; // fully typed, always present
  res.setHeader('X-Request-ID', requestId); // return to client for support tickets
  await bookingService.create(data, { requestId }); // forward to downstream
}
```

### Step 4 — Security Layer

**What was added:**
- `middleware/security.ts` — single file with all four security factories
- `ALLOWED_ORIGINS` env var — comma-separated CORS origin allowlist

**What changed and why:**

| Before | After | Reason |
|---|---|---|
| `helmet()` with defaults | `configureHelmet()` with explicit CSP + HSTS | Default helmet omits a hard Content Security Policy; defaults are a starting point, not a production config |
| No CORS config | `configureCors()` with origin allowlist | Without CORS, any website can make credentialed requests to your API from a victim's browser |
| No input sanitization | `configureMongoSanitize()` | `{ "email": { "$gt": "" } }` in body bypasses MongoDB auth queries entirely — custom impl required for Express 5 compatibility |
| No body key filtering | `sanitizeBody()` | Stored `<script>` tags and `__proto__` keys are silent time-bombs |

**Attack scenarios blocked:**

| Attack | Vector | Blocked by |
|---|---|---|
| Stored XSS | Save `<script>` to DB, render in browser | Helmet CSP + sanitizeBody |
| Clickjacking | Wrap app in iframe, trick clicks | Helmet `frameguard: deny` |
| SSL strip / MITM | Downgrade HTTPS → HTTP | Helmet HSTS 1-year |
| MIME sniff | Upload `.jpg` containing JS, browser executes | Helmet `noSniff` |
| NoSQL injection | `{ "$gt": "" }` auth bypass | configureMongoSanitize (custom) |
| Prototype pollution | `{ "__proto__": { "isAdmin": true } }` | sanitizeBody key filter |
| Cross-origin request forgery (basic) | malicious.com calls API with victim's cookies | CORS origin allowlist |
| Fingerprinting / bot scanning | `X-Powered-By: Express` reveals tech stack | Helmet `hidePoweredBy` |
#   t s - b a c k e n d - s t a r t e r 
 
 