# MediQueue – Healthcare Queue Management System

Full-stack appointment booking and live patient-queue system for clinics.

| Layer | Stack |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router, Axios, Socket.IO client |
| Backend | Node.js 20, Express 4, TypeScript, Prisma 5, Zod, JWT, bcrypt, Socket.IO, Swagger UI |
| Database | PostgreSQL 16 (with `btree_gist`) |
| Tests | Jest + Supertest against a real PostgreSQL test database |

## Zero double-booking guarantee

Overlapping appointments for the same doctor are prevented in three layers:

1. **Per-doctor serialization** – every booking / reschedule runs in a transaction that takes
   `pg_advisory_xact_lock(hashtext('doctor:<id>'))`, so concurrent requests for one doctor are processed one at a time
   (other doctors are not blocked).
2. **Explicit validation** inside that transaction – slot alignment with the working schedule, breaks, time-off, past time,
   and an overlap query against active appointments.
3. **Database exclusion constraint** (the final guarantee, also protects against writes outside the API):

   ```sql
   ALTER TABLE appointments ADD CONSTRAINT appointments_no_doctor_overlap
     EXCLUDE USING gist (doctor_id WITH =, tstzrange(start_time, end_time, '[)') WITH &&)
     WHERE (status IN ('CONFIRMED','IN_CONSULTATION','COMPLETED'));
   ```

   A violation (`23P01`) is rolled back and mapped to **HTTP 409 `SLOT_ALREADY_BOOKED`**. Half-open ranges allow
   back-to-back slots; cancelled / no-show appointments free the slot.

`backend/tests/concurrency.test.ts` fires 25 simultaneous requests for one slot (exactly 1 succeeds, 24 get 409), plus
partially-overlapping races, concurrent reschedules, cancel-vs-rebook races, concurrent queue-token generation and
raw SQL inserts that bypass the API.

## Project layout

```
backend/
  prisma/            schema.prisma, migrations/, seed.ts
  src/
    config/          env validation (zod), prisma client
    controllers/     thin HTTP handlers
    services/        business logic (booking, slots, queue, prescriptions, auth, dashboard)
    repositories/    reusable Prisma queries / selects
    routes/          Express routers + zod validators (validators/)
    middleware/      auth (JWT + RBAC), validation, rate limiting, error handler
    sockets/         Socket.IO server, rooms and events
    docs/            OpenAPI 3 spec served at /api-docs
  tests/             Jest + Supertest suites
frontend/
  src/
    pages/           12 application pages
    components/      UI kit, SlotPicker, ScheduleEditor, QueueBoard, PrescriptionForm, dialogs
    context/         AuthContext, SocketContext
    hooks/ services/ utils/ types/
```

## Getting started

Prerequisites: Node.js 20+, npm, Docker (or a local PostgreSQL 14+ where you can `CREATE EXTENSION btree_gist`).

```bash
# 1. Database
docker compose up -d postgres

# 2. Backend
cd backend
cp .env.example .env          # set JWT_SECRET to a long random value
npm install
npx prisma migrate deploy     # or: npm run prisma:migrate (dev)
npm run seed                  # demo data
npm run dev                   # http://localhost:4000/api , docs at http://localhost:4000/api-docs

# 3. Frontend (new terminal)
cd frontend
cp .env.example .env
npm install
npm run dev                   # http://localhost:5173 (proxies /api and /socket.io to :4000)
```

### Demo accounts (password `Password123`)

| Role | Email |
|---|---|
| Admin | admin@hqms.test |
| Receptionist | reception@hqms.test |
| Doctor | doctor@hqms.test (more doctors: see seed output) |
| Patient | patient@hqms.test |

## Tests

```bash
cd backend
# uses DATABASE_URL from .env.test (database healthcare_queue_test is created & migrated automatically)
npm test
npm run typecheck
cd ../frontend && npm run build   # type-check + production build
```

## Environment variables

See `backend/.env.example` and `frontend/.env.example`. Key backend values:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Token signing (min 32 chars secret) |
| `CORS_ORIGIN` | Comma-separated allowed origins |
| `CLINIC_TIMEZONE` | IANA zone used for schedules / slots (e.g. `Asia/Kolkata`) |
| `BCRYPT_ROUNDS`, `RATE_LIMIT_*` | Security tuning |

## API overview

All responses use `{ success, message, data }`; errors use `{ success: false, message, errorCode, details? }`.
Full interactive documentation: **`/api-docs`** (raw spec at `/api-docs.json`).

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET/PATCH /auth/me`, `PATCH /auth/me/password` |
| Doctors | `GET/POST /doctors`, `GET/PATCH/DELETE /doctors/{id}`, `GET/PUT /doctors/{id}/schedules`, `GET/POST /doctors/{id}/time-off`, `DELETE /doctors/{id}/time-off/{timeOffId}`, `GET /doctors/{id}/available-slots?date=YYYY-MM-DD` |
| Appointments | `POST /appointments`, `GET /appointments`, `GET /appointments/{id}`, `PATCH /appointments/{id}/cancel`, `PATCH /appointments/{id}/reschedule`, `GET /patients/{id}/appointments` |
| Queue | `GET /queue/mine`, `GET /queue/doctor/{doctorId}?date=`, `GET /queue/{id}`, `POST /queue/{id}/call`, `POST /queue/{id}/start`, `POST /queue/{id}/complete`, `POST /queue/{id}/skip` |
| Prescriptions | `POST /prescriptions`, `GET /prescriptions`, `GET/PATCH/DELETE /prescriptions/{id}`, `GET /patients/{id}/prescriptions` |
| Admin | `GET/POST /users`, `PATCH/DELETE /users/{id}`, `GET /patients`, `GET/PATCH /patients/{id}`, `GET /dashboard/stats` |

### Real-time events (Socket.IO, JWT in `auth.token`)

| Event | When |
|---|---|
| `queue:updated` | Any change to a queue (room `queue:<id>`, join with `queue:join`) |
| `queue:patient-called` | Sent to the called patient |
| `appointment:updated` | Booking / cancel / reschedule / status change for involved users |
| `prescription:created` | Sent to the patient |

## Production notes

- `npm run build && npm start` in `backend`; serve `frontend/dist` from a CDN / static host and set `VITE_API_URL` /
  `VITE_SOCKET_URL` (or reverse-proxy `/api` and `/socket.io`).
- Run `npx prisma migrate deploy` on release. Use a strong `JWT_SECRET`, HTTPS and a restricted `CORS_ORIGIN`.
- Helmet, rate limiting, request-size limits, zod validation and generic 500 messages are enabled by default.
