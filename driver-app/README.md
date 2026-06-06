# Driver App — React Native (Expo)

A mobile app for drivers to manage their deliveries, update statuses, and view their profile.

---

## Setup

### 1. Install dependencies

```bash
cd driver-app
npm install
```

### 2. Set your server IP

Open `src/api/api.ts` and update `API_URL`:

```ts
// For physical device testing, use your machine's LAN IP
export const API_URL = 'http://192.168.x.x:5203';

// For Android emulator
// export const API_URL = 'http://10.0.2.2:5203';

// For iOS simulator (localhost works)
// export const API_URL = 'http://localhost:5203';
```

### 3. Add backend routes

Copy the contents of `server_delivery_routes.js` into your existing `server.js`
alongside the driver auth routes. These routes need:
- `verifyToken` middleware (already in your project)
- `db` MongoDB connection (already set up)
- `ObjectId` from `mongodb` (already imported)

### 4. Run the app

```bash
# Start Expo dev server
npm start

# Or directly target a platform
npm run android
npm run ios
```

---

## Screens

| Screen | Description |
|--------|-------------|
| **Login** | Driver signs in with username + password set by distributor |
| **Home** | Dashboard with active count, completed today, and active delivery cards |
| **Deliveries** | Full list with Active / Completed / All tabs |
| **Delivery Detail** | Full details + action buttons to progress status |
| **Profile** | Driver info, vehicle, license expiry warning, change password |

## Status flow

```
Assigned → Picked Up → In Transit → Delivered
                ↘ (any non-terminal state) → Failed
```

## Build for production

Install EAS CLI and run:

```bash
npm install -g eas-cli
eas login
eas build --platform android   # .apk / .aab
eas build --platform ios       # .ipa
```
