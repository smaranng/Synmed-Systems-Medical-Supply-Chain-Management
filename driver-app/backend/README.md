# Synmed Driver App — Backend

Express + SQLite REST API for the Synmed Driver App.

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Seed the database with sample data
node db/seed.js

# 3. Start the server
npm run dev      # development (auto-restarts)
npm start        # production
```

Server runs on **port 5203** by default.

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/driver/login` | ❌ | Login and get JWT token |
| GET | `/driver/:id` | ✅ | Get driver profile |
| PUT | `/driver/:id/password` | ✅ | Change password |
| GET | `/driver/:id/deliveries` | ✅ | List all deliveries |
| GET | `/driver/:id/deliveries/:delId` | ✅ | Get delivery detail |
| PATCH | `/driver/:id/deliveries/:delId/status` | ✅ | Update delivery status |
| GET | `/health` | ❌ | Health check |

---

## Login Request

```json
POST /auth/driver/login
{
  "username": "ravi",
  "password": "password123"
}
```

Response:
```json
{
  "token": "eyJ...",
  "user": {
    "driverID": "drv_001",
    "name": "Ravi Kumar",
    "username": "ravi",
    ...
  }
}
```

---

## Test Accounts (after seeding)

| Username | Password |
|----------|----------|
| ravi | password123 |
| suresh | password123 |

---

## Connect from Phone (Physical Device)

Find your computer's LAN IP:
- Windows: `ipconfig` → look for IPv4 Address
- Mac/Linux: `ifconfig` or `ip addr`

Then update in `src/api/api.ts`:
```ts
export const API_URL = 'http://YOUR_LAN_IP:5203';
// e.g. 'http://192.168.1.100:5203'
```

Make sure your phone and computer are on the **same WiFi network**.

---

## Environment Variables (.env)

```env
PORT=5203
JWT_SECRET=your_secret_here
JWT_EXPIRES_IN=7d
DB_PATH=./db/synmed.db
```
