# GesturaWeb 🤟

## Overview

Multi-user sign language detection platform with role-based access. Admin can train gestures, all users can detect and browse the gesture dictionary.

GesturaWeb turns any webcam into a sign language interpreter. Hand landmarks are captured in the browser with MediaPipe Hands, stored on the server, and matched in real time against the trained gesture library — no GPU, no cloud inference, no model retraining required.

## Tech Stack

- **Frontend:** React + Vite + Tailwind CSS + Framer Motion
- **Backend:** Node.js + Express + SQLite (better-sqlite3)
- **ML:** MediaPipe Hands + Fingerpose
- **Auth:** JWT + bcrypt

## Features

- User authentication (login/register) with JWT
- Role-based access (ADMIN / USER)
- Real-time hand tracking with MediaPipe Hands
- Gesture training (Admin only) — record hand landmarks
- Gesture detection — compare live hand with saved gestures (80% threshold)
- Text-to-speech for detected gestures
- Gesture dictionary with all saved signs

## Project Structure

```
gestoura app web/
├── server/           # Express backend
│   ├── src/
│   │   ├── index.js
│   │   ├── db.js
│   │   ├── seed.js
│   │   ├── middleware/auth.js
│   │   └── routes/
│   │       ├── auth.js
│   │       └── gestures.js
│   └── package.json
├── client/           # React frontend
│   ├── src/
│   │   ├── App.jsx
│   │   ├── context/AuthContext.jsx
│   │   ├── pages/
│   │   ├── components/
│   │   └── utils/api.js
│   └── package.json
└── README.md
```

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+

### 1. Setup Backend

```bash
cd server
npm install
npm run seed
npm run dev
```

Backend runs on http://localhost:5000

### 2. Setup Frontend

```bash
cd client
npm install
npm run dev
```

Frontend runs on http://localhost:5173

> Run both commands in separate terminals. The frontend expects the backend to be reachable on port 5000.

## Default Admin Account

- **Email:** hackerterminal404@gmail.com
- **Password:** Hamza724

> Created by `npm run seed`. Change this password before deploying anywhere public.

## User Roles

| Feature | ADMIN | USER |
|---------|-------|------|
| Detect Gestures | ✅ | ✅ |
| View Dictionary | ✅ | ✅ |
| Train Gestures | ✅ | ❌ |
| Delete Gestures | ✅ | ❌ |

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/register | No | Register new user |
| POST | /api/auth/login | No | Login |
| GET | /api/auth/me | Yes | Get current user |
| GET | /api/gestures | Yes | Get all gestures |
| POST | /api/gestures | Admin | Create gesture |
| DELETE | /api/gestures/:id | Admin | Delete gesture |

Authenticated routes expect the JWT in an `Authorization: Bearer <token>` header.

## How It Works

1. Admin trains gestures by recording hand landmarks via webcam
2. Landmarks are saved to the SQLite database
3. During detection, live hand landmarks are compared with saved ones
4. If match confidence > 80%, the gesture name is displayed
5. Users can hear the gesture name via text-to-speech

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Camera never starts | Allow camera permission; browsers only grant it on `localhost` or HTTPS |
| No gestures detected | Ensure at least one gesture is trained, and keep the whole hand in frame with even lighting |
| 401 on every request | Token expired — log out and log back in |
| No speech output | Text-to-speech relies on the Web Speech API; use Chrome or Edge |

## License

MIT
