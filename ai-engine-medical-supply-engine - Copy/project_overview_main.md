# Project Overview Main

## 1. Executive Technical Summary
This repository is a multi-application medical supply chain project centered on four user-facing portals, a driver mobile app, a small set of Node/Express backend services, and three Python AI microservices. In practical terms, the strongest implemented workflows are:

- role-based login and profile management for customer, pharmacy, distributor, and admin users,
- pharmacy-side inventory viewing and basic CRUD,
- customer-to-pharmacy order placement and pharmacy-side order processing,
- pharmacy-side offline walk-in sales,
- simple admin registration and pharmacy statistics views,
- a separate driver delivery backend plus Expo mobile app,
- a standalone order-tracking demo app.

The core business problem the project tries to solve is medicine supply coordination across customers, pharmacies, distributors, and logistics staff. The intended value proposition is that pharmacies can manage stock, customers can place and track medicine orders, distributors can supply stock, and administrators can monitor platform activity.

The important truth is that the repository is more complete as a demo-oriented multi-portal platform than as a finished end-to-end “AI forecasting + auto procurement + ICN exchange + live logistics” system. Those advanced layers are present in the UI and in some service wrappers, but many of them are either mock-driven, partially wired, or inconsistent with the currently checked-in backend code. That distinction matters for report writing and viva preparation: the implemented system should be presented primarily as a portal-based supply chain management prototype with selected working workflows, not as a production-complete intelligent procurement engine.

## 2. Repository-Wide Architecture Overview
At the highest level, the repository uses a mono-repo style layout:

- `frontend/` contains four independent Vite + React + TypeScript portals.
- `backend/services/` contains small Express services for users, inventory, orders, and distributors.
- `backend/api-gateway/` contains an Apollo GraphQL gateway, but it is mostly a scaffold with mock resolvers.
- `ai-services/` contains three FastAPI services, all of which currently return mock or synthetic outputs.
- `driver-app/` contains both a React Native driver app and a separate Node/Mongoose delivery backend.
- `tracking/` is an additional standalone React tracking UI built on static mock data.
- `design/` contains UML and design notes that are architectural intent, not live implementation.

The actual architectural style is hybrid and inconsistent:

- part microservice-oriented in folder structure,
- part portal-centric in frontend development,
- part prototype/demo-driven in UI behavior,
- part legacy-code carryover, with old ports, routes, and collection assumptions still present.

It is not a clean production microservice platform yet. Instead, it behaves like a layered academic prototype where:

- portals are the most visible layer,
- service wrappers are written as if richer backend contracts exist,
- backends only implement a subset of those contracts,
- AI services are demonstrators rather than real decision engines,
- some features depend on legacy service ports such as `5201`, `5202`, `5203`, `5204` that do not match the Docker setup.

Why this matters: for a final year project report, the architecture can still be presented as a modular service-oriented design, but you should clearly state that the checked-in codebase mixes current services, mock services, and incomplete integration paths.

## 3. Complete Repository Tree With Purpose
Below is the effective repository tree, grouped by importance instead of listing every generated utility component.

```text
syn2/
└── MSCMS/
    ├── README.md
    ├── QUICK_START.md
    ├── OFFLINE_IMPLEMENTATION_SUMMARY.md
    ├── CHANGES
    ├── docker-compose.yml
    ├── package.json
    ├── inventory.csv
    ├── inventory_output.json
    ├── excel-json.py
    ├── migrateBatches.js
    ├── hash.js
    ├── design/
    ├── scripts/
    ├── backend/
    │   ├── api-gateway/
    │   ├── database/init/
    │   └── services/
    │       ├── user-service/
    │       ├── inventory-service/
    │       ├── order-service/
    │       └── distributor-service/
    ├── ai-services/
    │   ├── demand-forecasting/
    │   ├── invoice-processing/
    │   └── analytics-engine/
    ├── frontend/
    │   ├── customer-portal/
    │   ├── pharmacy-portal/
    │   ├── distributor-portal/
    │   ├── admin-portal/
    │   └── shared/
    ├── driver-app/
    ├── tracking/
    └── infrastructure/monitoring/
```

### Root-level files

#### `README.md`
Purpose: top-level project pitch and intended architecture.
Importance: support-only.
Status: aspirational and partly inaccurate relative to code. It claims more services and production readiness than the repository currently contains.

#### `QUICK_START.md`
Purpose: local setup instructions.
Importance: support-only.
Status: partially outdated. It refers to files such as `.env.example` that are not present.

#### `OFFLINE_IMPLEMENTATION_SUMMARY.md`
Purpose: narrative explanation of the offline pharmacy sales feature.
Importance: support-only but useful.
Status: partially aligned, partially outdated. It references paths and behavior not fully matching the current `src/server.ts` implementations.

#### `docker-compose.yml`
Purpose: declares MongoDB, Redis, RabbitMQ, API gateway, user service, inventory service, order service, and the four web portals.
Importance: runtime-critical in theory.
Status: partially runnable, but mismatched with hardcoded frontend service ports. The portals expect `5201`/`5202`/`5203`/`5204`, while Docker exposes `4001`-`4004`.

#### `inventory.csv`, `inventory_output.json`, `excel-json.py`
Purpose: seed/reference dataset conversion utilities.
Importance: support/demo data.
Status: not part of live service runtime. Useful to explain sample medicine schema and data engineering intent.

#### `migrateBatches.js`
Purpose: one-time migration from a single `inv` collection into `products` and `batches`.
Importance: legacy/support.
Status: not integrated into current runtime. Shows an unfinished schema evolution path.

#### `hash.js`
Purpose: generate bcrypt password hashes manually.
Importance: support-only.
Status: utility script, not runtime.

#### `CHANGES`
Purpose: ad hoc change log.
Importance: support-only.
Status: very brief and incomplete.

### `design/`
Purpose: UML, architecture notes, navigation ideas, PRD, TODOs.
Importance: documentation-only.
Status: non-executable. Useful for presentation narrative, but it cannot be used as proof that a feature is implemented.

### `scripts/`
Purpose: shell automation for install and startup.
Importance: support/runtime-helper.
Status: partially useful on Unix-like systems; not directly suitable for the current Windows environment shown in this session.

### `backend/api-gateway/`
Purpose: GraphQL gateway.
Importance: experimental/support.
Status: scaffold only. It boots, but resolvers return mock data and are not wired to the real services. Not the true application core.

### `backend/database/init/`
Purpose: MongoDB initialization and seed data for Docker.
Importance: support/runtime-helper.
Status: partially legacy. Collection names and seeded schemas do not fully match the active service code.

### `backend/services/user-service/`
Purpose: user registration, login, password change, pharmacy settings, admin stats.
Importance: runtime-critical.
Status: one of the most real backends in the repository.

### `backend/services/inventory-service/`
Purpose: inventory CRUD, search, and prescription upload.
Importance: runtime-critical.
Status: partially real. Core inventory list/stats/create/update/delete exists, but many frontend-expected routes are missing.

### `backend/services/order-service/`
Purpose: customer orders, pharmacy status transitions, reservation timeout logic, offline pharmacy orders.
Importance: runtime-critical.
Status: one of the most important real backends, but it contains major schema and collection mismatches with other modules.

### `backend/services/distributor-service/`
Purpose: distributor catalog and invoice log.
Importance: low runtime value in current state.
Status: minimal placeholder service.

### `ai-services/`
Purpose: forecasting, invoice OCR, analytics.
Importance: demo/experimental.
Status: all three return mock or synthetic data. They are not authoritative planning engines.

### `frontend/customer-portal/`
Purpose: customer browsing, cart, checkout, order tracking, profile.
Importance: runtime-critical for demo.
Status: visually rich and fairly complete at UI level, but several service calls target backend routes that do not exist in current code.

### `frontend/pharmacy-portal/`
Purpose: pharmacy dashboard, inventory, order processing, offline sales, ICN, procurement, distributor shopping.
Importance: runtime-critical for demo.
Status: the largest and most feature-heavy frontend. Some parts are working against real endpoints; others are sophisticated UI shells around missing backends.

### `frontend/distributor-portal/`
Purpose: distributor dashboard, products, invoices, shipments, vehicles/drivers.
Importance: moderate.
Status: mixed. The role/login/profile shell exists, but most inventory, vehicle, and driver-management routes expected by the frontend are not implemented in the current backend services.

### `frontend/admin-portal/`
Purpose: admin login, overview, pharmacies, vendors, settings.
Importance: moderate.
Status: some real integration exists with user-service admin endpoints. Other pages are mostly static or lightly wired.

### `frontend/shared/`
Purpose: shared UI primitives, hooks, utility helpers, map/location components.
Importance: support/runtime-helper.
Status: active reusable library.

### `driver-app/`
Purpose: driver mobile app plus separate delivery backend.
Importance: separate subsystem.
Status: more self-contained than the distributor portal’s transport layer. This is one of the clearer logistics flows in the repo.

### `tracking/`
Purpose: standalone order-tracking UI demo.
Importance: demo-only.
Status: entirely mock-data driven. Useful for presentation, not part of the actual integrated backend flow.

### `infrastructure/monitoring/`
Purpose: Prometheus and monitoring compose files.
Importance: support-only.
Status: infrastructure stub, not central to current execution.

## 4. End-to-End System Flow
There is no single perfectly integrated end-to-end path covering forecasting, inventory policy, reorder generation, procurement, and fulfilment. Instead, there are several separate or partially connected flows.

### Flow A: Customer-to-Pharmacy online order flow
1. Customer logs in through `frontend/customer-portal`.
2. The portal attempts to search medicines via inventory-related service wrappers.
3. Customer adds items to cart.
4. Checkout computes tax fields client-side and posts order confirmation.
5. `backend/services/order-service/src/server.ts` creates one order per pharmacy in `customer_to_pharma_orders`.
6. Pharmacy portal fetches orders for that pharmacy.
7. Pharmacy changes status to `APPROVED`, `READY_FOR_PICKUP`, `COMPLETED`, or `REJECTED`.
8. On `APPROVED`, Redis reservation keys are created and reserved stock counters are incremented.
9. On `COMPLETED`, the service tries to decrement inventory stock and release reservation.

Important limitation: this flow is conceptually implemented, but current repo mismatches make it fragile:

- customer frontend often sends `productID`/`pharmaID`, while backend expects `itemId`/`pharmacyId`,
- backend requires `type`, while customer payload often omits it,
- order-service decrements collections `inventory`, `emergency`, `general`, while inventory-service writes to collection `inv`.

### Flow B: Pharmacy offline walk-in sales flow
1. Pharmacy enters `OfflinePurchase.tsx`.
2. Medicines are searched from pharmacy inventory.
3. Selected items are stored locally in `localStorage` via `pharma_cartService`.
4. Checkout page collects customer name, doctor name, mobile number, and optional email.
5. The frontend enriches line items with MRP, discount, GST, HSN, and tax breakdown.
6. `order-service` stores the offline order in `pharma_offline_orders`.
7. Pharmacy later completes the order with payment mode.
8. Backend logs stock-out history records into `stockHistory`.

Important limitation: the offline flow is one of the better documented flows, but the current backend completion logic logs stock-out history only; it does not actually decrement the main inventory collection used by inventory-service.

### Flow C: Pharmacy inventory management flow
1. Pharmacy logs in.
2. Inventory page fetches inventory list and stats.
3. Pharmacy adds, updates, or deletes items.
4. Inventory is stored in `inventory_pharma.inv`.
5. Stats are derived from this `inv` collection and current Redis reservations.

Important limitation: the frontend expects richer routes like `/medicines/search`, `/inventory/pharmacy/:pharmacyId/:productID`, `/next-product-id`, and image routes. The current backend only implements:

- `GET /inventory/pharmacy/:pharmacyId`
- `GET /inventory/pharmacy/:pharmacyId/stats`
- `POST /inventory/pharmacy/:pharmacyId`
- `PUT /inventory/:itemId`
- `DELETE /inventory/:itemId`
- `GET /items/search`
- `GET /items/:id`
- `POST /cart/upload-prescription`

So only a subset of the frontend inventory flow matches the backend.

### Flow D: Admin monitoring flow
1. Admin logs in through user-service admin login.
2. Admin portal fetches:
   - aggregate user counts,
   - weekly registrations,
   - pharmacy list,
   - pharmacy revenue/order summary.
3. These values are computed mostly from `user_db`, `order_db`, and `inventory_pharma`.

This is one of the cleaner portal-to-backend integrations.

### Flow E: Driver delivery flow
1. Driver logs into the separate driver backend.
2. JWT token is stored in mobile secure storage.
3. Driver fetches profile, deliveries, and delivery details.
4. Driver updates delivery status through the dedicated delivery route set.

This subsystem is separate from the order-service and not yet integrated into the customer/pharmacy order lifecycle.

### Alternate or legacy flows
- GraphQL API gateway flow exists but is mostly mock-only.
- Distributor product shopping from the pharmacy portal depends on a not-implemented distributor inventory backend.
- ICN flow has a large pharmacy UI and service wrapper, but the backend routes are absent from the checked-in order-service.
- Forecasting and AI procurement are mostly UI/service-shell + mock FastAPI services rather than true operational flows.

## 5. Entry Points and How the System Runs
### Root entry points

#### `package.json`
Main commands:

- `npm run dev`
- `npm run build`
- `npm run test`

What it runs: concurrent portal dev servers plus API gateway, not all backend services.
Use case: workspace-level development convenience.
Generated outputs: frontend build artifacts and gateway build output.
Difference: this script does not fully solve the port mismatch problem in the repo.

#### `docker-compose.yml`
What it runs:

- MongoDB,
- Redis,
- RabbitMQ,
- API gateway,
- user-service,
- inventory-service,
- order-service,
- customer/pharmacy/distributor/admin web containers.

Use case: intended full local stack.
Problem: frontend code is hardcoded to different ports, so Docker alone does not align with current frontend service wrappers.

### Backend service entry points

#### `backend/services/user-service/src/server.ts`
Runs the user/auth/profile/admin REST service.
Expected inputs: MongoDB `user_db`; optional file uploads under `uploads/pharmacies`.
Generates: user documents, pharmacy documents, admin documents, distributor user documents, uploaded logos/license files.

#### `backend/services/inventory-service/src/server.ts`
Runs inventory REST service.
Expected inputs: MongoDB `inventory_pharma`, Redis for reservation lookups, uploaded prescription images.
Generates: `inv` collection documents, prescription image files, cart prescription-path updates.

#### `backend/services/order-service/src/server.ts`
Runs order REST service.
Expected inputs: MongoDB `order_db`, MongoDB `inventory_pharma`, Redis reservation store.
Generates:

- `customer_to_pharma_orders`,
- `pharma_offline_orders`,
- Redis reservation keys `stock_reservation:{orderId}:{itemId}`,
- `stockHistory` entries for offline completions.

#### `backend/services/distributor-service/src/server.ts`
Runs minimal distributor REST service.
Expected inputs: MongoDB `distributor_db`.
Generates: invoice processing log entries.

#### `backend/api-gateway/src/server.ts`
Runs GraphQL server.
Expected inputs: MongoDB and Redis connection.
Generates: GraphQL responses, but most are mock/stub data.

### AI service entry points

#### `ai-services/demand-forecasting/src/app.py`
Runs FastAPI forecasting demo on port `5001`.
Generates mock forecast JSON using synthetic Poisson historical demand.

#### `ai-services/invoice-processing/src/app.py`
Runs FastAPI invoice-processing demo on port `5002`.
Generates fixed structured invoice responses independent of uploaded file contents.

#### `ai-services/analytics-engine/src/app.py`
Runs FastAPI analytics demo on port `5003`.
Generates synthetic time-series analytics.

### Driver subsystem entry points

#### `driver-app/backend/server.js`
Runs dedicated driver backend, default port `5203`.
This collides conceptually with frontend expectations that `5203` is the user-service.

#### `driver-app/App.tsx`
Runs Expo mobile driver application.

### Standalone demo entry point

#### `tracking/src/main.tsx`
Runs the mock tracking web app.
Uses static `mockOrders.ts`.

## 6. Deep Module-by-Module Breakdown
This section focuses on meaningful runtime modules rather than every UI primitive.

### `backend/services/user-service/src/server.ts`
Role: central REST service for users, pharmacies, admins, and distributor user accounts.

Main logic:

- JWT generation with `generateToken(userId, role)`.
- `verifyToken` middleware reads bearer token and populates `req.userId` and `req.role`.
- role-specific login and registration handlers:
  - `/auth/login`
  - `/auth/pharmacy/login`
  - `/auth/pharmacy/register`
  - `/auth/admin/login`
  - `/auth/admin/register`
  - `/auth/distributor/login`
  - `/auth/distributor/register`
- profile update endpoints for customer, pharmacy, admin, and distributor.
- password change endpoints for each role.
- admin-only statistics endpoints.

Important inputs:

- MongoDB collections in `user_db`
- multipart uploads for pharmacy logo and license
- JSON bodies for credentials and profile data

Important outputs:

- JWT tokens
- sanitized user objects
- admin summary data

Internal notes:

- Passwords are hashed with bcrypt.
- Pharmacy settings endpoint stores uploaded files under `/uploads/pharmacies/...`.
- It supports both old and new MongoDB driver return styles by checking `result.value || result`.

Edge cases and limitations:

- There are no public `GET /pharmacy/:id` or `GET /distributor/:id` routes even though many frontends depend on them.
- There are no location endpoints (`/users/location`, `/pharmacies/nearby`, `/distributors/nearby`, `/location/geocode`) even though shared location code depends on them.
- There are no AI procurement endpoints even though the pharmacy portal calls `/ai-procurement/config/:pharmacyId`, `/distributors/options`, and `/distributors/name/:id`.
- Distributor settings route expected by frontend is `/distributor/:id/settings`, but backend only implements `PUT /distributor/:id`.

Why this matters: user-service is one of the most real services, but it is also where many cross-portal integration assumptions break.

### `backend/services/inventory-service/src/server.ts`
Role: manages pharmacy inventory, stock-derived stats, item search, and prescription uploads.

Main functions and helpers:

- `connectDB()` connects to `inventory_pharma`, `user_db`, and `order_db`.
- `connectRedis()` initializes Redis.
- `getReservedQuantity(itemId)` scans Redis reservation keys and sums active reserved stock.
- `withAvailability(items)` attaches `reservedStock` and `availableStock`.

Routes:

- `GET /health`
- `GET /inventory/pharmacy/:pharmacyId/stats`
- `GET /inventory/pharmacy/:pharmacyId`
- `POST /inventory/pharmacy/:pharmacyId`
- `PUT /inventory/:itemId`
- `DELETE /inventory/:itemId`
- `GET /items/search`
- `GET /items/:id`
- `POST /cart/upload-prescription`

Important inputs:

- JWT-authenticated pharmacy ID
- inventory item bodies including stock, price, item type, dates
- optional uploaded prescription image

Important outputs:

- inventory documents from collection `inv`
- stats object `{ totalItems, lowStock, expiringSoon, totalValue }`
- enriched availability values

Internal logic:

- low stock is computed as `availableStock <= lowStockThreshold`.
- expiring soon is anything with `expiryDate < now + 90 days`.
- availability status is set based on stock count.
- stock history inside each inventory document is stored under `stockDetails`.

Edge cases and limitations:

- Search route is `/items/search`, but frontends mostly call `/medicines/search`.
- Item detail route is `/items/:id`, but frontends often call `/medicines/:productID` or `/medicines/:productID/:pharmaID`.
- Search enrichment looks up pharmacies in `userDb.collection('pharmacy_users_db')`, but user-service stores pharmacies in `pharmacy_users`. That lookup likely fails.
- Inventory data is stored in `inv`, but order-service decrements `inventory`, `emergency`, and `general`.
- Cart add/get/update/remove routes are missing even though customer and pharmacy carts assume they exist.
- `POST /cart/upload-prescription` expects `itemId`, while customer cart code often sends `productID`.

Why this matters: the inventory backend has real business logic, but schema and route mismatches make it one of the biggest integration bottlenecks.

### `backend/services/order-service/src/server.ts`
Role: manages customer orders, pharmacy order transitions, stock reservations, order expiry, favourites, and offline pharmacy orders.

Core helpers:

- `getCollectionName(type)` maps logical item type to Mongo collections:
  - `medicines -> inventory`
  - `emergency -> emergency`
  - `general -> general`
- `buildOrderNumber()`
- `reserveStock(orderId, pharmacyId, items)`
- `releaseReservation(orderId)`
- `decrementStock(order)`
- `adjustReservedStock(order, direction)`
- `isTransitionAllowed(current, next)`
- `expireOrdersJob()`

Main routes:

- `POST /orders/confirm`
- `GET /orders/customer`
- `GET /orders/:orderId`
- `GET /orders/pharmacy/:pharmacyId`
- `PUT /orders/:orderId/status`
- `GET /orders/pharmacy/:pharmacyId/action-required`
- `POST /orders/:orderId/check-expiry`
- `PUT /orders/:orderId/favourite`
- offline:
  - `POST /orders/offline/create`
  - `GET /orders/offline/:orderId`
  - `GET /orders/offline/pharmacy/:pharmacyId`
  - `POST /orders/offline/:orderId/complete`

Important inputs:

- authenticated customer/pharmacy
- `items[]` payload on order creation
- status transition requests
- offline customer details

Important outputs:

- order documents with timestamps and status
- Redis reservation entries
- stock history records for offline orders

Internal logic:

- Customer order creation groups items by pharmacy, producing one order per pharmacy.
- Orders begin in `PLACED`.
- `APPROVED` creates Redis reservation keys and adjusts reserved stock.
- `COMPLETED` decrements stock and removes reservations.
- `REJECTED` and `CANCELLED` release reservations without stock-out.
- A background interval checks for expiry every 10 seconds.

Edge cases and limitations:

- The code comments say `PLACED` should not auto-cancel, and the expiry job reflects that intent.
- `CANCELLED` is handled inside status update logic, but `allowedStatuses` does not include `CANCELLED`, so external callers cannot request it via the current route.
- Customer cancellation routes expected by frontend (`/orders/:id/customer-cancel`, `/confirm-cancellation-payment`) do not exist.
- WebSocket endpoints expected by customer and ICN UIs are not implemented in this file.
- ICN routes expected by the pharmacy portal are not implemented.
- Inventory decrement logic targets collections that the active inventory-service does not populate.
- Offline order completion logs stock history but does not decrement the `inv` collection actually used by the inventory portal.

Why this matters: order-service contains the most substantial operational logic in the repo, but it also exposes the clearest evidence of an unfinished schema migration.

### `backend/services/distributor-service/src/server.ts`
Role: minimal distributor backend.

Implemented behavior:

- health check,
- `GET /distributors/:distributorId/catalog`,
- `POST /distributors/:distributorId/invoices`.

Limitations:

- no inventory CRUD,
- no driver/vehicle management,
- no shipment logic,
- no purchase-order workflow.

Why this matters: distributor-service is currently a placeholder, not a full supply backend.

### `backend/api-gateway/src/server.ts`
Role: GraphQL facade.

Implemented pieces:

- Express app with Apollo Server,
- health check,
- JWT extraction into GraphQL context,
- MongoDB and Redis initialization.

Supporting files:

- `schema/typeDefs.ts`: schema definitions for users, medicines, orders.
- `schema/resolvers.ts`: mostly mock resolvers returning fixed values.
- `config/environment.ts`: environment and service URL config.

Limitations:

- resolver layer does not call the real REST microservices,
- search/login/order creation are mock outputs,
- service URLs in config do not consistently match actual Docker ports or backend defaults.

Why this matters: this module is good for architectural explanation, but it is not the real transactional path.

### `backend/database/init/01-init-databases.js`
Role: Docker Mongo initialization.

What it creates:

- `user_db.users`, `addresses`
- `inventory_db.medicines`, `inventory`
- `order_db.orders`, `order_items`
- `distributor_db.distributors`, `distributor_catalog`, `invoice_processing_logs`
- `tracking_db.shipments`, `tracking_updates`
- `analytics_db.demand_forecasts`, `business_metrics`

Limitation: active services actually use databases and collections such as `inventory_pharma.inv`, `customer_to_pharma_orders`, `pharma_offline_orders`, `pharmacy_users`, etc. So this initializer is only partially aligned.

### `backend/database/init/02-seed-data.js`
Role: inserts sample data for Docker startup.

Limitations:

- stores `passwordHash`, while active user-service expects `password`,
- uses role names and field names from an older schema,
- does not match active portal login expectations.

### `frontend/customer-portal/src/services/authService.ts`
Role: customer auth wrapper.
Uses `http://localhost:5203`.
Implements login, register, profile update, password change, current-user fetch.
Limitation: depends on user-service routes existing on port `5203`.

### `frontend/customer-portal/src/services/medicineService.ts`
Role: customer medicine search wrapper.
Assumes routes `/medicines/search` and `/medicines/:productID/:pharmaID`.
Limitation: current inventory-service exposes `/items/search` and `/items/:id` instead.

### `frontend/customer-portal/src/services/cartService.ts`
Role: customer cart operations and checkout enrichment.

Key logic:

- add/update/remove/clear cart through backend cart routes,
- enrich cart items with tax fields before checkout,
- upload prescriptions,
- fetch live product and pharmacy details.

Important limitation: the backend cart routes used here do not exist in current inventory-service.

### `frontend/customer-portal/src/services/orderService.ts`
Role: customer order wrapper.

Key functions:

- confirm order,
- fetch customer orders,
- fetch single order,
- toggle favourite,
- check expiry,
- fetch pharmacy orders,
- update status.

Important limitation: several expected backend routes are missing, especially customer cancellation flows.

### `frontend/customer-portal/src/pages/CartPage.tsx`
Role: shopping cart UI and tax calculation stage.

Key logic:

- groups items by pharmacy,
- calculates per-line MRP and selling price,
- computes GST, CGST, SGST,
- requires prescriptions for flagged items,
- prepares `taxSummaryByPharma`.

Why this matters: some of the repository’s clearest implemented financial formulas live here.

### `frontend/customer-portal/src/pages/CheckoutConfirmationPage.tsx`
Role: final customer checkout confirmation UI.

Key logic:

- validates stock before order submission by calling search again,
- groups by pharmacy,
- shows order summary,
- posts to order-service.

Limitation: it assumes search and order payload schemas that do not perfectly match the current backend.

### `frontend/customer-portal/src/pages/OrderTrackingPage.tsx`
Role: customer order list and live updates UI.

Key logic:

- order filtering,
- favourite toggling,
- timers for expiry display,
- WebSocket connection attempt with polling fallback.

Limitation: the WebSocket endpoint it expects is not implemented in current order-service.

### `frontend/pharmacy-portal/src/hooks/useAuth.ts`
Role: pharmacy portal session persistence.

Key behavior:

- restores user from `localStorage`,
- saves pharmacy token under `pharmacy_token`,
- enforces role `pharmacy`,
- exposes `updateUser`.

### `frontend/pharmacy-portal/src/services/authService.ts`
Role: pharmacy auth wrapper.
Works with pharmacy login/register routes.
This is relatively aligned with user-service except for port assumptions.

### `frontend/pharmacy-portal/src/services/inventoryService.ts`
Role: pharmacy inventory API wrapper.

Expected capabilities:

- inventory list and stats,
- search,
- medicine details,
- next product ID,
- create/update/delete by `productID`,
- image upload/delete.

Important limitation: only list/stats are close to current backend; most other routes do not exist.

### `frontend/pharmacy-portal/src/pages/InventoryPage.tsx`
Role: pharmacy inventory management UI.

Key logic:

- inventory search/filter/sort,
- add/edit/delete medicine modal,
- image upload preview,
- GST field handling,
- sub-unit calculations for dosage forms,
- low stock and expiry display.

Formulas:

- `totalSubUnits = unitsAvailable * baseQuantity`
- low-stock and expiry classification are UI-driven from stats and item fields.

Limitation: it depends on many non-existent backend routes like `next-product-id`, productID-based CRUD, and product image routes.

### `frontend/pharmacy-portal/src/services/orderService.ts`
Role: pharmacy order handling wrapper.

Notable behavior:

- tries `5202`, then falls back to `4003`.
- wraps pharmacy orders, status changes, stock history, and inventory refresh.

Important limitation: several fallback routes (`/api/stock-history`, `/api/inventory/:pharmaID`, `/api/orders/:id/complete`) are not implemented in current order-service.

### `frontend/pharmacy-portal/src/pages/DashboardPage.tsx`
Role: pharmacy dashboard UI.

Key calculations:

- combines online and offline orders,
- total revenue includes:
  - full total for completed orders,
  - half of `cancellationAmount` for cancelled orders,
- monthly/yearly sales aggregation,
- month-over-month growth percentages.

Why this matters: this page turns raw order data into report-friendly business metrics.

### `frontend/pharmacy-portal/src/services/pharma_cartService.ts`
Role: localStorage cart for offline pharmacy purchases.

Key behavior:

- key `pharma_offline_purchase_cart`,
- no backend dependency for cart persistence,
- prescription image stored as base64 data URL,
- supports “prescription shown at pharmacy”.

This is one of the cleanest self-contained modules in the repo.

### `frontend/pharmacy-portal/src/pages/OfflinePurchase.tsx`
Role: offline medicine search, local cart handling, offline order history.

Key features:

- search medicines,
- quantity and sub-quantity stepper,
- alternate medicine lookup using composition cleanup,
- offline order list and bill modal.

Limitation: medicine search still depends on backend routes that are not fully aligned.

### `frontend/pharmacy-portal/src/pages/OfflineCheckoutConfirmation.tsx`
Role: local-cart checkout for walk-in customers.

Key logic:

- form validation,
- tax enrichment from live product data,
- prescription handling,
- offline order creation,
- success/failure animated modal.

### `frontend/pharmacy-portal/src/pages/OfflineOrderConfirmation.tsx`
Role: order completion and payment-mode confirmation for offline sales.

Key logic:

- fetch offline order,
- display customer/order summary,
- choose cash or online payment,
- post completion to backend.

### `frontend/pharmacy-portal/src/services/icnService.ts`
Role: wrapper for ICN exchange APIs and socket subscription.

Expected backend routes:

- `/icn/post-exchange`
- `/icn/request`
- `/icn/exchanges`
- `/icn/accept`
- `/icn/cancel`
- `/icn/complete`
- `/icn/:exchangeId/check-expiry`

Limitation: none of these routes exist in the checked-in backend.

### `frontend/pharmacy-portal/src/pages/ICNPage.tsx`
Role: large pharmacy UI for Inter-Clinic Network exchange and request marketplace.

What it actually does:

- builds grouped medicine options from inventory,
- prepares exchange/request payloads,
- displays exchange history and modal views,
- calculates countdown labels,
- displays source/destination pharmacy details,
- can render Google Maps directions URLs.

What it does not have:

- a backing ICN implementation in the current backend.

### `frontend/pharmacy-portal/src/services/aiProcurementService.ts`
Role: wrapper for AI procurement configuration.

Expected backend routes:

- `/ai-procurement/config/:pharmacyId`
- `/distributors/options`
- `/distributors/name/:distributorId`

Limitation: not present in current user-service.

### `frontend/pharmacy-portal/src/pages/ProcurementPage.tsx`
Role: procurement dashboard UI.

Actual behavior:

- loads config if backend route exists,
- displays fixed placeholder purchase orders,
- displays empty AI-triggered orders list unless config contains data.

Truth: this is UI scaffolding, not an implemented procurement engine.

### `frontend/pharmacy-portal/src/pages/ProcurementSetupPage.tsx`
Role: AI procurement setup form.

Important rules:

- `ordersPerMonth` is fixed at `2`,
- `secondOrderDay` must be `1..28`,
- preferred distributor can be explicit or `AI`.

Truth: this stores configuration only if the absent backend route exists. No reorder algorithm consumes it in current code.

### `frontend/pharmacy-portal/src/pages/Distributors.tsx`
Role: nearby distributor discovery UI using `locationService`.

Limitation: depends on location endpoints not implemented in user-service.

### `frontend/pharmacy-portal/src/pages/SearchDistributorInventory.tsx`
Role: pharmacy-side browsing of distributor stock.

Limitation: depends on a distributor inventory service at `5204` plus WebSocket stock updates, neither of which exists in the checked-in backend.

### `frontend/distributor-portal/src/services/authService.ts`
Role: distributor login, registration, settings, drivers, vehicles.

Reality:

- distributor login/register roughly align with user-service,
- driver/vehicle routes mostly do not exist in user-service,
- some driver functionality belongs instead to `driver-app/backend`.

### `frontend/distributor-portal/src/services/inventoryService.ts`
Role: distributor inventory CRUD wrapper.
Limitation: expects a separate inventory backend at `5204`, not implemented here.

### `frontend/distributor-portal/src/hooks/useAuth.ts`
Role: restores distributor or driver session from local storage and token decoding.
Limitation: it calls routes such as `/driver/:driverID` and `/distributor/:distributorID` on `5203`, but the checked-in user-service does not provide both of these.

### `frontend/admin-portal/src/services/adminService.ts`
Role: fetches admin dashboard numbers.

This is relatively aligned with user-service:

- user stats,
- weekly registrations,
- all pharmacies,
- pharmacy stats.

### `driver-app/backend/server.js`
Role: standalone driver API bootstrap.

Routes wired:

- `/auth` from `routes/auth.js`
- `/driver` from `routes/driver.js`

Why it matters: this subsystem is not integrated into `order-service`, but it is one of the more coherent standalone modules.

### `driver-app/backend/routes/auth.js`
Role: driver login.

Behavior:

- searches `driver_users`,
- compares bcrypt password,
- loads optional vehicle and distributor,
- returns JWT with `driverID`, `distributorID`, role.

### `driver-app/backend/routes/driver.js`
Role: driver profile, password change, deliveries, delivery status update.

Important limitation:

- first route references `driverID` without defining it from params, which is a bug.

### `driver-app/src/api/api.ts`
Role: mobile app API client.

Notable detail:

- hardcoded LAN IP `http://192.168.1.35:5203`, making it environment-specific.

### `tracking/src/data/mockOrders.ts`, `tracking/src/pages/*`
Role: standalone mock tracking demo.

Truth:

- no real backend integration,
- useful for presentation visuals only.

## 7. Algorithms and Mathematical Logic
This section is exact and intentionally honest: forecasting, reorder policy, safety stock, supplier scoring, and supplier selection are mostly not implemented as real operational algorithms in this repository.

### 7.1 Demand forecasting logic
Implemented location: `ai-services/demand-forecasting/src/app.py`

Problem solved: demo demand prediction for a medicine.

Exact logic:

1. Generate synthetic historical sales:
```python
historical_sales = np.random.poisson(lam=50, size=request.historical_days)
```
2. Compute 7-day moving average:
```python
moving_avg = pd.Series(historical_sales).rolling(window=7).mean()
predicted_demand = int(moving_avg.iloc[-1])
```
3. Compute recent trend:
```python
recent_trend = moving_avg.iloc[-7:].mean() - moving_avg.iloc[-14:-7].mean()
```
4. Adjust forecast:
```python
if recent_trend > 0:
    predicted_demand = int(predicted_demand * 1.1)
elif recent_trend < 0:
    predicted_demand = int(predicted_demand * 0.9)
```
5. Confidence score:
```python
variance = np.var(historical_sales[-30:])
confidence_score = max(0.6, min(0.95, 1 - (variance / 1000)))
```

Assumptions:

- history is synthetic, not database-driven,
- no real seasonality model,
- no medicine-specific behavior,
- no pharmacy-specific business constraints.

Truth summary: this is a demonstration forecasting endpoint, not a deployed forecast engine.

### 7.2 Ensemble or hybrid forecasting logic
Not implemented.

There is no true ensemble, weighted model blend, Prophet/LSTM/ARIMA combination, or per-SKU model selection in the checked-in code.

### 7.3 Reorder threshold logic
Implemented only as low-stock detection, not as autonomous reorder generation.

Locations:

- inventory-service stats route,
- inventory UI,
- ICN inventory grouping.

Exact logic examples:

```ts
lowStock = inv.filter(i => i.availableStock <= (i.lowStockThreshold || 0)).length
```

and in grouped ICN medicine options:

```ts
isLowStock = option.totalUnitsAvailable <= option.threshold
```

Meaning: the system detects stock that is below or equal to a threshold, but it does not convert that into a purchase order automatically in the live backend.

### 7.4 Safety stock logic
Not implemented as a formal formula.

There is no code of the form:

```text
Safety Stock = Z * sigma * sqrt(lead_time)
```

or any other statistical buffer formula.

What exists instead:

- manually stored thresholds per product,
- UI labels for low stock,
- 90-day expiry warnings,
- ICN warnings for close-to-expiry or low-stock postings.

### 7.5 Target stock logic
Not implemented.

No explicit target stock level, order-up-to policy, min-max policy, or EOQ-based replenishment loop exists in current code.

### 7.6 Order quantity logic for customer orders
Implemented location: frontend cart pages and backend order creation.

Customer order quantity is user-selected, not algorithmically derived.

For customer checkout totals:

```ts
lineSellingPrice(item) =
  (item.price ?? 0) * (item.quantity ?? 0) +
  (item.pricePerSubUnit ?? 0) * (item.subQuantity ?? 0)
```

For line MRP:

```ts
lineMrp(item) =
  (item.mrp ?? item.price ?? 0) * (item.quantity ?? 0) +
  (mrpPerSubUnit ?? pricePerSubUnit ?? 0) * (item.subQuantity ?? 0)
```

### 7.7 Tax calculation logic
Implemented in customer and pharmacy offline checkout pages.

Exact logic:

```ts
rate = gstRate > 1 ? gstRate / 100 : gstRate
gross = totalMrp
discount = totalMrp - totalSellingPrice
taxable = rate > 0 ? totalSellingPrice / (1 + rate) : totalSellingPrice
gst = totalSellingPrice - taxable
cgst = gst / 2
sgst = gst - cgst
```

Why it exists:

- to create invoice-like summaries,
- to preserve tax components inside cart enrichment and offline order records.

Downstream effect:

- bill summaries display MRP, discount, taxable value, GST, CGST, SGST,
- enriched items are stored with tax metadata.

### 7.8 Stock reservation logic
Implemented in `order-service`.

Reservation key pattern:
```text
stock_reservation:{orderId}:{itemId}
```

Reservation payload:
```json
{
  "pharmacyId": "...",
  "type": "...",
  "quantity": 3
}
```

Reservation behavior:

- created when order becomes `APPROVED`,
- released on `COMPLETED`, `REJECTED`, or `CANCELLED`,
- included in inventory availability through Redis scans.

Available stock formula:
```ts
availableStock = Math.max((item.stock || 0) - reservedStock, 0)
```

### 7.9 Order state-transition logic
Implemented in `order-service`.

Allowed transitions:

```ts
PLACED -> APPROVED, REJECTED
APPROVED -> READY_FOR_PICKUP, COMPLETED, REJECTED, CANCELLED
READY_FOR_PICKUP -> COMPLETED, REJECTED
COMPLETED/REJECTED/EXPIRED/CANCELLED -> no further transitions
```

This is deterministic state-machine logic.

### 7.10 Expiry and timeout logic
Implemented in `order-service`.

Testing constants currently hardcoded:

```ts
PHARMACY_ACTION_TIMEOUT_SECONDS = 10
CUSTOMER_PICKUP_TIMEOUT_SECONDS = 10
RESERVATION_TTL_SECONDS = 10
```

These comments explicitly say they are testing values, not production values.

Expiry behavior:

- `APPROVED` orders past expiry become `CANCELLED`.
- `READY_FOR_PICKUP` past expiry becomes `EXPIRED`.
- `PLACED` orders are intentionally not auto-cancelled by the background job.

Why this matters: if demoed live, order timers will fire very quickly because they are set to 10 seconds.

### 7.11 Offline order amount logic
Implemented in `order-service`:

```ts
totalAmount = items.reduce(
  (sum, item) =>
    sum + ((item.price * (item.quantity || 0)) + ((item.pricePerUnit || 0) * (item.subQuantity || 0))),
  0
)
```

### 7.12 Admin growth logic
Implemented in `user-service`.

Monthly growth percentage:

```ts
growth = ((thisMonth - lastMonth) / lastMonth) * 100
```

with special handling:

- if `lastMonth === 0` and `thisMonth > 0`, growth is set to `100`.

### 7.13 Dashboard revenue logic
Implemented in pharmacy dashboard.

Total revenue:

```ts
if order.status === 'COMPLETED':
  sum += order.totalAmount
if order.status === 'CANCELLED' and order.cancellationAmount:
  sum += order.cancellationAmount / 2
```

This is a business assumption hardcoded only in the frontend dashboard.

### 7.14 Procurement filtering, scoring, supplier selection
Not implemented as real backend logic.

What exists:

- nearby distributor UI filtering by distance bucket,
- manual or “AI” distributor preference setting in procurement setup,
- display-only purchase order placeholders.

What does not exist:

- weighted vendor scoring formula,
- lead time scoring,
- price/quality/reliability weighted ranking,
- actual supplier selection engine,
- purchase order generation pipeline.

## 8. Data Flow and Data Structures
### 8.1 User-service data

Collections used:

- `users`
- `pharmacy_users`
- `admin_users`
- `distributor_users`

Typical pharmacy record:
```json
{
  "_id": "ObjectId",
  "name": "Pharmacy Name",
  "email": "mail@example.com",
  "username": "pharmacyuser",
  "phone": "...",
  "address": "...",
  "licenseNumber": "...",
  "logo": "/uploads/pharmacies/....png",
  "licenseCertificate": "/uploads/pharmacies/....pdf",
  "role": "pharmacy",
  "password": "bcrypt hash",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### 8.2 Inventory document structure
Current live collection: `inventory_pharma.inv`

Shape created by inventory-service:
```json
{
  "_id": "ObjectId",
  "pharmacyId": "string",
  "itemType": "string",
  "name": "string",
  "category": "string",
  "stock": 100,
  "price": 25.5,
  "lowStockThreshold": 20,
  "expiryDate": "Date|null",
  "manufacturingDate": "Date|null",
  "availabilityStatus": "AVAILABLE|OUT_OF_STOCK",
  "stockDetails": [
    {
      "stockUpdated": 100,
      "date": "Date",
      "status": "stock_in|stock_out",
      "balance": 100
    }
  ],
  "createdAt": "Date",
  "lastUpdated": "Date",
  "updatedAt": "Date"
}
```

Important mismatch: frontend expects much richer nested medicine documents with fields like `productID`, `medicineName`, `packaging`, `stock.unitsAvailable`, `category.primaryCategory`, etc.

### 8.3 Customer order structure
Collection: `order_db.customer_to_pharma_orders`

Shape:
```json
{
  "_id": "ObjectId",
  "orderNumber": "ORD-...",
  "customerId": "string",
  "pharmacyId": "string",
  "items": [
    {
      "itemId": "string",
      "type": "medicines|emergency|general",
      "name": "string",
      "price": 0,
      "quantity": 0,
      "prescriptionPath": "string?"
    }
  ],
  "totalAmount": 0,
  "status": "PLACED|APPROVED|READY_FOR_PICKUP|COMPLETED|REJECTED|EXPIRED|CANCELLED",
  "paymentMode": "PAY_AT_PHARMACY",
  "placedAt": "Date",
  "expiresAt": "Date",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### 8.4 Offline order structure
Collection: `order_db.pharma_offline_orders`

Shape:
```json
{
  "_id": "ObjectId",
  "orderNumber": "OFL-...",
  "pharmacyId": "string",
  "customerId": "CUSTOMER_PHARMA",
  "customerName": "string",
  "doctorName": "string",
  "mobileNumber": "string",
  "email": "string?",
  "items": [
    {
      "productID": "string",
      "name": "string",
      "price": 0,
      "quantity": 0,
      "subQuantity": 0,
      "mrp": 0,
      "discountPercent": 0,
      "gstRate": 0,
      "hsnCode": "string",
      "taxBreakdown": {
        "gross": 0,
        "discount": 0,
        "taxable": 0,
        "gst": 0,
        "cgst": 0,
        "sgst": 0
      }
    }
  ],
  "totalAmount": 0,
  "status": "PENDING|COMPLETED",
  "paymentMode": "CASH|ONLINE",
  "transactionId": "string?",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### 8.5 Redis stock reservation structure
Key:
```text
stock_reservation:{orderId}:{itemId}
```

Value:
```json
{
  "pharmacyId": "string",
  "type": "string",
  "quantity": 2
}
```

### 8.6 Driver delivery structure
Collection: `deliveries` in driver backend.

Shape:
```json
{
  "deliveryID": "DEL001",
  "orderID": "ORD001",
  "driverID": "DRV001",
  "customerName": "City Hospital",
  "customerPhone": "...",
  "deliveryAddress": "...",
  "status": "Assigned|Picked Up|In Transit|Delivered|Failed",
  "estimatedDelivery": "string",
  "items": [
    { "name": "Paracetamol 500mg", "quantity": 100, "unit": "tablets" }
  ],
  "assignedAt": "Date"
}
```

### 8.7 AI responses
Forecast response:
```json
{
  "medicine_id": "string",
  "predicted_demand": 0,
  "confidence_score": 0.0,
  "forecast_period_days": 7,
  "factors": {
    "historical_avg": 0.0,
    "recent_trend": "increasing|decreasing",
    "seasonality": "low"
  }
}
```

Invoice processing response:
```json
{
  "invoice_number": "INV-YYYYMMDD-001",
  "distributor_name": "PharmaDist Ltd",
  "date": "YYYY-MM-DD",
  "items": [...],
  "total_amount": 4250.0,
  "confidence_score": 0.92
}
```

## 9. File and Dataset Analysis
### `inventory.csv`
Contains raw inventory rows used by `excel-json.py`.
Observed fields include:

- `productID`
- `pharmaID`
- `batchCode`
- `medicineName`
- `composition`
- `description`
- `manufacturer`
- `quantity`
- `mrpWithDiscount`
- `price`
- `pricePerUnit`
- `unitsAvailable`
- `threshold`
- `manufacturedDate`
- `expiryDate`
- `lastUpdated`

Use: data-preparation/reference only.

### `inventory_output.json`
Contains converted sample medicine objects.
Use: reference/demo dataset.
Coverage: first 10 CSV rows only, because `excel-json.py` uses `df.head(10)`.

### `excel-json.py`
Purpose: one-off conversion utility from CSV to JSON.

What it actually does:

- reads `inventory.csv`,
- renames some columns,
- converts each row into a nested medicine JSON shape,
- writes `inventory_output.json`.

Why this matters: it demonstrates an intended medicine schema closer to the frontend expectation than the active inventory backend currently supports. That makes it useful as a design artifact, but not as active runtime code.

### `backend/database/init/01-init-databases.js`
Purpose: creates initial MongoDB collections and indexes for a more complete microservice layout.

Status: partially aligned with the current repository.

Important observation:

- it creates databases such as `inventory_db`, `tracking_db`, and `analytics_db`,
- active services instead use names like `inventory_pharma`, `order_db`, and `user_db`,
- some collection names differ from the names expected by the running code.

Why this matters: this file captures intended database organization, but it cannot be treated as the exact truth of the live runtime state.

### `backend/database/init/02-seed-data.js`
Purpose: seed file for initial users, medicines, and distributors.

Status: legacy or partially outdated.

Important mismatch:

- the seeded user records use `passwordHash`,
- the active `user-service` login compares `password` directly.

Why this matters: this file is useful for report discussion about planned initial data, but it does not cleanly match the actual login implementation.

### `README.md`
Purpose: high-level project description and startup guidance.

Status: aspirational and partially out of sync.

Observed issues:

- it describes a broader platform than the currently wired code,
- some commands and services assume a smoother integration than the repository currently provides.

Why this matters: this file is valuable for project framing, but it should not be treated as a precise runtime specification.

### `QUICK_START.md`
Purpose: shortcut setup guide.

Status: helpful but not fully reliable.

Observed issue:

- it assumes `.env.example` exists, but no such file is present in the repository snapshot.

### `OFFLINE_IMPLEMENTATION_SUMMARY.md`
Purpose: describes the pharmacy walk-in or offline ordering feature.

Status: mostly consistent with the existence of the offline pharmacy flow, but still a documentation artifact rather than executable logic.

Why this matters: it is useful for report writing because the offline flow is one of the strongest implemented features in the repository.

### `migrateBatches.js`
Purpose: migration utility to split old inventory records into product and batch collections.

Status: support or migration-only.

Why this matters: it shows that inventory schema evolved over time. The current active inventory backend does not expose the full product-plus-batch model expected by some frontends.

### `hash.js`
Purpose: standalone password hashing helper.

Status: utility only, not part of the active request path.

Why this matters: it suggests security-aware intent, but the active `user-service` still appears to compare plaintext-style `password` fields instead of bcrypt hashes.

### Frontend datasets and mock content
Important examples:

- `tracking/src/data/mockOrders.ts`: pure mock data for the tracking demo app.
- pharmacy and customer portals also contain hardcoded placeholder lists and fallback UI states in some pages.

Why this matters: these files are presentation assets, not proof of backend implementation.

## 10. Real-Time vs Batch Behavior
This system is not truly real-time in the strict distributed-systems sense. It is better described as a hybrid of on-demand HTTP workflows, local browser state, and short-interval polling or timeout-based updates.

The most accurate characterization is:

- customer ordering is request-driven and near-real-time only at the API call level,
- stock reservation uses Redis keys with expiry, which creates time-sensitive behavior,
- order expiry is enforced by a periodic background interval in `order-service`,
- dashboard pages usually refresh by polling or page reload, not by event streams,
- WebSocket-based live updates are planned in several frontends but are not implemented in the current backend,
- forecasting and analytics services are on-demand demo APIs, not continuously running optimization engines,
- procurement automation is largely configurational and UI-oriented, not an active scheduled replenishment engine.

The demand-forecasting service has a `batch-forecast` endpoint, but it only returns a mock scheduled message. There is no real batch orchestration, no cron-driven forecasting job, no persisted forecast table, and no automated handoff from forecast to procurement.

Why this matters: for viva or presentation, the safest statement is that the project demonstrates a digital medicine supply workflow with time-sensitive order handling and AI-assisted prototype services, but it is not a fully real-time autonomous supply chain platform.

## 11. Business Logic and Decision-Making Rules
The repository contains several concrete operational rules, but many of the more ambitious supply-chain decisions remain either simplified or unimplemented.

### Reorder trigger logic
The only clearly implemented inventory alerting rule is low-stock detection in `inventory-service`:

```text
lowStock = availableStock <= lowStockThreshold
```

Here:

- `availableStock` is computed after subtracting active reservations from physical stock,
- `lowStockThreshold` is stored per item,
- a medicine becomes low stock when available quantity falls to or below that threshold.

This is not a classical reorder-point engine with lead time and service-level design. It is a threshold alert.

### Order quantity computation
For customer orders, quantity is determined entirely by the customer-selected amounts:

- `quantity` for full packs or whole units,
- `subQuantity` for sub-units such as strips or tablets when the UI supports it.

For offline pharmacy orders, the backend computes:

```text
totalAmount = Σ(price * quantity + pricePerUnit * subQuantity)
```

There is no economic order quantity, no target-stock replenishment quantity, and no procurement lot-sizing engine in the current backend.

### Supplier filtering and ranking
The repository does not contain a real implemented supplier filtering engine or ranking formula. The pharmacy procurement UI allows configuration such as:

- preferred procurement mode,
- order days,
- preferred distributor.

However:

- the backend endpoints expected by `aiProcurementService.ts` do not exist,
- no code calculates supplier scores,
- no deterministic shortlist pipeline is implemented,
- no final automated supplier selection is executed server-side.

The distributor portal does include catalog and inventory ideas, but current distributor-service implementation is minimal and not sufficient to support procurement optimization.

### Deterministic logic vs AI/LLM logic
Deterministic logic is authoritative where it exists:

- login and profile updates,
- inventory CRUD,
- stock reservation,
- order creation,
- order approval and completion,
- offline order recording,
- admin statistics.

AI services are optional prototype layers:

- demand forecasting returns synthetic predictions,
- invoice processing returns mocked extraction,
- analytics returns random or fixed recommendations.

There is no LLM-driven authoritative decision in the transaction path. No order is accepted, rejected, or procured based on an AI model output.

Why this matters: this project is strongest when presented as deterministic transaction software plus AI-ready prototype modules, not as a fully autonomous AI-controlled supply chain engine.

## 12. Current Implementation vs Claimed/Future Features
### Implemented Now
The following functionality is genuinely implemented in code, even if some parts still have integration rough edges:

- multi-portal frontend structure for customer, pharmacy, distributor, and admin roles,
- pharmacy, customer, admin, and distributor authentication endpoints in `user-service`,
- pharmacy profile update and password change flows,
- customer user creation and update flows,
- pharmacy inventory CRUD in `inventory-service` using MongoDB,
- inventory statistics using available stock and low-stock detection,
- medicine search over the active inventory collection, though schema expectations are inconsistent with frontend assumptions,
- customer order creation in `order-service`,
- Redis-based temporary stock reservation,
- pharmacy approval, ready-for-pickup, completion, and rejection transitions,
- timeout-based order expiry and reservation release,
- offline pharmacy order creation and completion flow,
- admin dashboards backed by user-service statistics endpoints,
- a working driver backend skeleton with driver login and delivery status endpoints,
- standalone AI prototype services via FastAPI.

### Not Yet Implemented / Future Scope
The following capabilities are claimed, suggested, scaffolded, or partially prototyped, but not fully realized end to end:

- true demand-driven auto-replenishment from forecast to procurement,
- real ensemble forecasting with historical pharmacy data,
- automated reorder point, safety stock, and target stock calculations,
- AI-based supplier scoring and final supplier selection,
- full distributor inventory marketplace integration,
- live inter-pharmacy exchange completion via backend ICN APIs,
- location-based nearby pharmacy or distributor search,
- real geocoding and route optimization,
- WebSocket-based live order and stock updates,
- production-grade OCR invoice extraction,
- analytics backed by real warehouse or transaction history,
- production-consistent API gateway GraphQL orchestration,
- database seed scripts that fully match the active authentication schema,
- a unified, version-consistent inventory schema across every service and portal.

Why this matters: this contrast section is one of the most important for viva preparation. It helps separate confident claims from careful claims.

## 13. Design Strengths
One major strength of the repository is breadth. It does not only show one script or one model; it demonstrates a full ecosystem concept involving pharmacies, customers, distributors, administrators, drivers, analytics, procurement, and delivery tracking. For a final-year project, that breadth makes the system easy to position as a complete digital medicine supply management platform.

Another strength is the separation of concerns. Even though integration is incomplete, the repository clearly attempts to split identity, inventory, ordering, distribution, analytics, and forecasting into separate modules or services. This makes the architecture easy to explain in a report because each service has a distinct responsibility.

The pharmacy offline sales workflow is also a notable strength. It addresses a practical real-world scenario: a customer walks into the pharmacy, the pharmacist searches available stock, creates an offline cart, records customer details, and finalizes a sale. This makes the project more realistic than a purely online-only medicine ordering demo.

The Redis reservation pattern is another technically meaningful design choice. It shows awareness that stock should not simply be decremented at the end of an order without temporarily reserving it during in-progress fulfillment. That gives the system a more advanced concurrency story than many student projects.

The admin service endpoints also provide meaningful demo value because they aggregate registrations, user counts, pharmacy counts, and order summaries. These give visible management-level outputs that are useful in presentation settings.

Finally, the AI services, although simplified, add a forward-looking layer. They help justify report sections on forecasting, invoice automation, and analytics, even if those modules should be described honestly as prototype-grade.

## 14. Technical Weaknesses and Limitations
The biggest weakness is architectural inconsistency. Different parts of the system assume different schemas, ports, route names, and collection names. For example, the inventory backend actively uses the `inv` collection, while the order service expects collections named `inventory`, `emergency`, and `general`. This means end-to-end execution is not uniformly reliable across all features.

Another weakness is that several frontends are more complete than their corresponding backends. The pharmacy, customer, and distributor portals contain sophisticated pages for ICN, procurement, distributor browsing, stock images, vehicle assignment, and live updates, but the required backend routes are absent or only placeholders. This creates a gap between UI demonstration breadth and backend execution depth.

Security is also weaker than production standards. The user-service appears to compare `password` fields directly rather than consistently using hashed passwords. Some utilities suggest hashing was planned, but the active authentication path does not clearly enforce it.

The AI modules are prototype-only. Demand forecasting uses synthetic data rather than historical pharmacy transaction records. Analytics returns random generated summaries. Invoice processing ignores actual OCR extraction. These modules are valuable for architecture and future scope discussion, but not strong evidence of real predictive intelligence.

There is also no fully realized procurement engine. The project talks about forecasting, replenishment, and supplier choice, but the implemented code does not connect these stages into a closed-loop operational pipeline. The most concrete inventory decision rule is still a low-stock threshold.

Error handling and validation are uneven. Some routes validate request fields well, but many cross-service assumptions are unchecked. If one frontend sends `productID` while the backend expects `itemId`, the failure is structural, not gracefully handled.

Scalability is limited by the current design quality. Several services scan Redis keys or compute statistics directly in-request. That is acceptable for a student prototype but would need redesign for large-scale deployment.

Why this matters: these weaknesses should not be hidden. They should be framed as the boundary between prototype achievement and production engineering.

## 15. Important Assumptions and Hidden Couplings
This repository contains many hidden assumptions that are crucial to understand before presenting or extending it.

### File and naming assumptions

- scripts assume `.env.example` exists,
- many services assume localhost-based fixed ports,
- the driver mobile app hardcodes `http://192.168.1.35:5203`,
- some modules assume specific file names for images or uploads.

### Database and collection assumptions

- `user-service` assumes `user_db`,
- `inventory-service` assumes `inventory_pharma.inv`,
- `order-service` assumes `order_db.customer_to_pharma_orders`,
- offline orders are stored in `pharma_offline_orders`,
- some code assumes collections like `inventory`, `emergency`, and `general`,
- some code looks up pharmacy records in `pharmacy_users_db`, while user-service writes to `pharmacy_users`.

### Payload-shape assumptions

- customer and pharmacy frontends often use `productID` and `pharmaID`,
- order-service expects `itemId` and `pharmacyId`,
- inventory frontend expects nested stock and packaging objects,
- inventory backend stores a simpler flatter record.

### Business-rule assumptions

- order reservation TTL and pharmacy/customer action timeouts are all set to 10 seconds for testing,
- low-stock threshold is item-level and manually provided,
- several dashboards treat incomplete or cancelled values using simplified formulas,
- some pages assume GST values exist on pharmacy profiles.

### Output-path assumptions

- AI services assume they can run independently and respond through fixed FastAPI ports,
- Docker and frontend hardcoded API base URLs are not consistently aligned,
- several “live” pages assume backend WebSocket endpoints exist when they do not.

Why this matters: these couplings explain many integration failures. They also identify where a developer must intervene first when stabilizing the system.

## 16. Common Viva / Presentation Questions With Answers
### Why did this architecture get chosen?
The repository uses a microservice-like separation because the business problem itself spans multiple domains: authentication, pharmacy inventory, customer ordering, distribution, analytics, and delivery. Separating them makes the system easier to reason about and allows each module to evolve independently, even though the current implementation is still prototype-grade.

### Why is ensemble forecasting used?
Strictly speaking, the current code does not implement a true ensemble forecasting system. The project direction suggests a hybrid or ensemble idea, but the current forecasting service uses a moving-average-plus-trend heuristic on synthetic data. In presentation, it is best to say that the architecture is prepared for more advanced ensemble forecasting, but the present implementation is simplified.

### Why is procurement deterministic first?
Because procurement directly affects cost and stock availability, deterministic rules are easier to validate and safer to explain. In the current repository, procurement is mostly a configuration concept and has not yet reached a full automated decision engine. That makes deterministic business logic the appropriate foundation before adding AI ranking.

### Is the system really real-time?
No, not in the strict sense. It is better described as on-demand and near-real-time for transactional updates, with Redis-based temporary reservations and interval-driven expiry checks. Several real-time features such as WebSocket live updates are planned but not fully implemented.

### Why reorder point instead of another inventory policy?
The actual code does not yet implement a classical reorder point calculation based on demand and lead time. What it does implement is a low-stock threshold rule. This is simpler, easier to demonstrate, and suitable for a prototype, though more advanced inventory policies are a logical future enhancement.

### What are the limitations?
The main limitations are inconsistent schemas across services, partial backend support for some frontends, prototype AI services using synthetic or mocked data, and missing end-to-end automation from forecasting to procurement.

### What happens if no supplier qualifies?
In the current code, there is no authoritative supplier qualification engine. The procurement UI can store preferences, but final automated supplier selection is not yet implemented. Therefore the safe answer is that supplier selection is currently manual or configuration-led rather than algorithmically finalized.

### What if the AI layer fails?
The transaction system should still operate because the important order and inventory paths are deterministic and do not depend on AI outputs. The AI modules are add-on analytical services rather than mandatory decision authorities.

### What is actually innovative here?
The innovation is the attempt to unify pharmacy inventory visibility, customer medicine search and ordering, pharmacy offline sales, stock reservation, distributor integration concepts, and AI-assisted forecasting/analytics within one platform. The strongest implemented innovation is the combination of pharmacy operations and order reservation logic, while forecasting and procurement automation are currently more prototype-oriented.

## 17. Report-Writing Ready Notes
### Problem Statement
Medicine supply and pharmacy operations are often fragmented across manual processes, isolated inventory systems, and delayed communication between customers, pharmacies, and distributors. This project addresses that problem by proposing an integrated medicine supply chain management platform that digitizes inventory visibility, order handling, offline pharmacy sales, administrative monitoring, and future-ready forecasting and procurement support.

### System Objective
The objective of the system is to provide a role-based platform in which customers can search and request medicines, pharmacies can manage stock and fulfill orders, administrators can monitor platform activity, distributors can be integrated into future procurement flows, and AI-assisted modules can support forecasting, invoice processing, and analytics.

### System Architecture
The repository follows a modular, service-oriented architecture. A Node.js and Express backend is split into user, inventory, order, and distributor services. Separate frontend portals exist for customers, pharmacies, distributors, and administrators. Redis is used for temporary stock reservation, while MongoDB stores persistent user, inventory, and order data. Additional FastAPI services provide prototype AI capabilities for demand forecasting, invoice parsing, and analytics.

### Forecasting Layer
The current forecasting layer is implemented as a FastAPI microservice. It does not yet consume real historical pharmacy sales from MongoDB. Instead, it synthesizes historical demand, applies a moving-average smoothing window, derives a simple directional trend, and produces a predicted demand with a bounded confidence score. This layer serves as a proof of concept for future predictive inventory planning.

### Inventory Decision Layer
The inventory decision layer is primarily threshold-based in the current system. Each inventory item contains stock quantity and a low-stock threshold. Inventory statistics are computed using available stock after subtracting active reservations. This design supports basic replenishment awareness and avoids double-committing stock during active customer order processing.

### Procurement Agent Layer
The procurement layer is conceptually present through pharmacy-side procurement configuration pages and distributor-related modules. However, it is not yet fully automated. The current code supports configuration and UI structure for future procurement logic, while actual supplier scoring and purchase-order generation remain future work.

### Data Flow
Customer requests originate in the customer portal and are submitted to backend order routes. Inventory queries are served by the inventory service. Approved orders create temporary reservations in Redis, and completed orders decrement stock. Pharmacy offline sales follow a parallel but more self-contained flow. Admin dashboards gather statistics through backend aggregation routes. AI services currently operate as optional independent endpoints rather than integrated control-plane components.

### Limitations
Important limitations include inconsistent schemas between frontends and backends, incomplete route coverage for some advanced UI features, prototype-grade AI services with synthetic data, missing live-update infrastructure, and partial separation between current implementation and aspirational documentation.

### Future Enhancements
Future enhancements include a unified inventory schema, proper hashed-password authentication, live WebSocket notifications, real GPS or geocoding support, historical-demand forecasting from actual transaction data, automated reorder point and safety stock policies, supplier scoring, procurement recommendation generation, and tighter distributor integration.

## 18. Presentation-Ready Explanation Layer
### 2-minute explanation
This project is a medicine supply chain management platform designed to connect customers, pharmacies, administrators, and future distributor operations in one digital system. Customers can search medicines and place orders, pharmacies can manage inventory and process both online and offline sales, and administrators can monitor platform activity through dashboards. On the backend, the system uses MongoDB for persistence, Redis for temporary stock reservation, and separate services for user management, inventory, and orders. In addition, the repository includes AI-oriented prototype services for demand forecasting, analytics, and invoice processing to show how intelligent decision support can be added to pharmacy operations.

### 5-minute explanation
At a practical level, the project solves the problem of fragmented pharmacy operations. Instead of handling stock manually and processing orders in disconnected channels, the platform aims to centralize these activities. The system is built as a modular architecture with separate services. The user service manages authentication and profile data for customers, pharmacies, distributors, and admins. The inventory service stores medicine stock and calculates availability based on reservations. The order service handles customer orders, controls status transitions, reserves stock in Redis, and finalizes stock deduction when orders are completed. A pharmacy-specific offline sales flow allows walk-in purchases to be recorded digitally.

The project also includes a broader future-facing layer. There are separate AI microservices for forecasting demand, processing invoices, and generating analytics. These are currently prototype services, but they demonstrate how the platform can evolve from transaction management into decision support. The repository also contains distributor and driver modules that illustrate future logistics integration. So the strongest current contribution is the transactional pharmacy platform, while the forecasting and procurement features show the roadmap toward a more intelligent supply chain system.

### Key innovation points

- unified multi-role architecture across customer, pharmacy, admin, distributor, and driver perspectives,
- Redis-based reservation before final stock deduction,
- digital support for both online and offline pharmacy order flows,
- extensible design for AI-assisted forecasting and analytics,
- clear path toward distributor and procurement integration.

### What makes the project practical

- it addresses real pharmacy workflows rather than only theoretical forecasting,
- it includes stock management, order fulfillment, and admin monitoring,
- it supports the very common real-world case of walk-in offline purchases,
- it is organized in a way that allows incremental enhancement.

### What makes it technically interesting

- multiple services and multiple portals in one repository,
- stateful order life cycle with reservation expiry,
- hybrid architecture combining transactional APIs and AI microservices,
- visible separation between current deterministic rules and future intelligent automation.

## 19. Developer Mental Model
The best way to understand this codebase is to think of it as three layers.

Layer one is the transactional core. This includes `user-service`, `inventory-service`, and `order-service`. If you want to understand what truly happens in the system, start here. These services contain the most important business logic and the most defensible implementation.

Layer two is the portal layer. This includes the customer, pharmacy, distributor, and admin frontends. These frontends reveal the intended user journeys and expose where the backend is complete versus incomplete. When a page seems very advanced, always verify whether the backend route it calls actually exists.

Layer three is the future or prototype layer. This includes the AI services, the API gateway, the tracking app, and parts of the distributor and driver ecosystem. These pieces show ambition and roadmap, but they should be interpreted carefully because they are not all integrated into the active runtime path.

If extending the project, the first thing to change should be the shared contracts:

- standardize ports,
- standardize route names,
- unify inventory schema,
- unify order item field names,
- align database collection names.

After that, the next most valuable extension would be connecting demand forecasting to actual completed-order history and then feeding that into a real replenishment recommendation engine.

The files that are most important to master first are:

- `backend/services/user-service/src/server.ts`
- `backend/services/inventory-service/src/server.ts`
- `backend/services/order-service/src/server.ts`
- `frontend/pharmacy-portal/src/pages/InventoryPage.tsx`
- `frontend/pharmacy-portal/src/pages/OfflinePurchase.tsx`
- `frontend/customer-portal/src/pages/CheckoutConfirmationPage.tsx`
- `frontend/customer-portal/src/pages/CartPage.tsx`

These files collectively explain the most concrete behaviors in the repository.

## 20. Final Truth Summary
This repository is definitely a large, multi-role medicine supply management prototype with real transactional backend components for authentication, inventory handling, customer ordering, pharmacy offline sales, and admin reporting.

It is not yet a fully unified, production-ready, end-to-end autonomous supply chain platform. The forecasting, procurement, distributor marketplace, live tracking, and AI decision modules are either simplified, partially integrated, or demonstrative.

The most production-like parts are:

- user and role management structure,
- pharmacy inventory CRUD foundations,
- Redis-backed stock reservation concept,
- customer order state transitions,
- offline pharmacy sales recording,
- admin statistics aggregation.

The most prototype or demo-like parts are:

- forecasting service,
- invoice processing service,
- analytics service,
- ICN exchange backend expectations,
- distributor procurement automation,
- tracking app,
- some driver and vehicle management flows,
- GraphQL API gateway.

The parts that should be presented confidently are the modular architecture, role-based portals, reservation-based ordering logic, pharmacy operations support, and offline sales handling.

The parts that should be presented carefully are AI accuracy, forecasting sophistication, real-time behavior, procurement automation, and distributor integration. These should be described as current prototypes or future-expansion modules rather than as fully completed production capabilities.
