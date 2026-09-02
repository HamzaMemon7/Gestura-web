# GesturaWeb — Backend API

Express + SQLite (better-sqlite3) REST API with JWT authentication and role-based
access control (`ADMIN` / `USER`) for storing hand-gesture landmark data.

## Setup

```powershell
cd server
npm install
npm run seed     # creates the default admin account
npm run dev      # nodemon on http://localhost:5000
```

> `npm install` compiles/downloads the `better-sqlite3` native binary. If npm blocks
> the install script (npm 11+), approve it once with:
> `npm install-scripts approve better-sqlite3`

Scripts:

| Script          | Purpose                          |
| --------------- | -------------------------------- |
| `npm run dev`   | Start with nodemon (auto-reload) |
| `npm start`     | Start once (production)          |
| `npm run seed`  | Insert the default admin user    |

## Environment (`.env`)

```
PORT=5000
JWT_SECRET=gesturaweb_super_secret_key_2024
```

## Database

SQLite file at `server/gestura.db` (created automatically on first run, WAL mode).

- **users** — `id`, `name`, `email` (unique), `password_hash`, `role` (`ADMIN`|`USER`), `created_at`
- **gestures** — `id`, `name`, `landmarks_json`, `created_at`

Passwords are hashed with bcryptjs (10 salt rounds); plaintext is never stored.

Default admin created by the seed script:

```
email:    hackerterminal404@gmail.com
password: Hamza724
role:     ADMIN
```

## API

Base URL: `http://localhost:5000`. JSON bodies, limit `50mb` (landmark payloads are large).
Protected routes expect `Authorization: Bearer <token>`. Tokens carry `{ id, email, role }` and expire in 7 days.

### Auth — `/api/auth`

| Method | Path        | Auth  | Body                       | Success                            |
| ------ | ----------- | ----- | -------------------------- | ---------------------------------- |
| POST   | `/register` | —     | `{ name, email, password }`| `201 { token, user }` (role `USER`) |
| POST   | `/login`    | —     | `{ email, password }`      | `200 { token, user }`              |
| GET    | `/me`       | token | —                          | `200 { user }`                     |

`user` is always `{ id, name, email, role }`.

Errors: `400` missing fields · `401` bad credentials / invalid or expired token · `409` email already registered.

### Gestures — `/api/gestures`

All routes require a valid token; writes additionally require `role === 'ADMIN'`.

| Method | Path   | Auth  | Body                        | Success                                        |
| ------ | ------ | ----- | --------------------------- | ---------------------------------------------- |
| GET    | `/`    | token | —                           | `200 { gestures: [...] }` (newest first)       |
| POST   | `/`    | admin | `{ name, landmarks_json }`  | `201 { gesture: { id, name, landmarks_json } }`|
| DELETE | `/:id` | admin | —                           | `200 { message: "Gesture deleted" }`           |

`landmarks_json` may be sent as a JSON string or a raw array/object — it is stored as text either way.

Errors: `400` invalid input · `401` missing/invalid token · `403 { error: "Admin access required" }` · `404` gesture not found.

### Health

`GET /api/health` → `200 { status: "ok", service, time }`
