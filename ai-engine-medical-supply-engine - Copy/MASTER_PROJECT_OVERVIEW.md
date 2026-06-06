# MASTER PROJECT OVERVIEW

This document merges `project_overview_main.md` and `project_overview.md` into one unified technical reference. It reconstructs the complete medicine supply system as a combination of two layers:

1. The **Main System**: a multi-role medicine supply chain platform that manages customers, pharmacies, distributors, administrators, and delivery workflows.
2. **My Project**: an AI Medical Supply Engine that adds forecasting, inventory policy, reorder generation, supplier selection, and procurement reasoning on top of the operational platform.

The combined system should be understood in two ways at the same time. First, it is an operational platform that supports medicine ordering, stock management, offline pharmacy sales, and administrative monitoring. Second, it is an intelligence layer that turns historical demand and stock signals into procurement actions. The most honest technical position is that the transactional parts of the main system are stronger than its built-in planning intelligence, while my project is stronger in forecasting and procurement logic than in live operational integration. Together, they form a credible end-to-end architecture for a final year project report, presentation, and viva.

## 1. Complete System Executive Summary

The complete system addresses a real pharmacy supply-chain problem: medicines move through many actors and decisions, but those decisions are often fragmented. Customers want medicine availability and order tracking. Pharmacies need stock visibility, walk-in billing, online order handling, and replenishment support. Distributors need structured procurement demand. Administrators need oversight. Delivery staff need a dispatch view. If each of these functions runs separately, stockouts, overstocking, delayed ordering, and inconsistent supplier selection become common.

The Main System solves the transactional side of that problem. It provides role-based portals and services for customer ordering, pharmacy operations, inventory maintenance, order status management, offline pharmacy sales, admin reporting, distributor-side workflows, and a separate driver delivery subsystem. In practical terms, the main system is the layer that captures events: who logged in, what item was ordered, what stock exists, what order was approved, which sale was completed, and what delivery state is active.

My project solves the planning and procurement side of the same problem. It takes historical demand signals and stock snapshots, predicts upcoming medicine demand, calculates inventory control quantities such as safety stock and reorder point, identifies which medicines should be reordered, and ranks suppliers using deterministic filtering and scoring. It then exposes those decisions through a FastAPI backend and a dashboard-style frontend, including an optional LLM reasoning stream for explanation.

When both are combined into one end-to-end system, the overall pipeline becomes:

`Operational demand and stock events -> cleaned historical demand -> demand forecasting -> inventory policy -> reorder request generation -> supplier filtering and ranking -> procurement recommendation -> distributor fulfillment -> delivery and reporting`

In the ideal integrated architecture, the main system continuously produces the data that my project needs, and my project continuously returns recommendations that the main system can execute. In the current checked-in prototype, some of those links are direct and some are still substitutes. For example, the main system already stores online orders, offline sales, inventory, and reservations, but my project currently reads monthly demand from Excel workbooks and sample supplier data rather than from the live MongoDB services. That distinction matters for technical honesty, but it does not change the architectural fit: my project clearly occupies the forecasting, inventory intelligence, and procurement decision layer of the larger platform.

## 2. Relationship Between Main System and My Project

The Main System and my project are not duplicates. They solve different parts of the same business problem.

| Aspect | Main System | My Project |
| --- | --- | --- |
| Core role | Runs operational medicine workflows | Runs planning and procurement intelligence |
| Main users | Customers, pharmacies, admins, distributors, drivers | Pharmacists, procurement staff, admins |
| Primary inputs | User data, live inventory, orders, offline sales, reservations, delivery state | Demand history, stock snapshots, supplier data, pharmacy constraints |
| Primary outputs | Order records, stock updates, reservations, dashboards, delivery updates | Forecasts, reorder points, order quantities, supplier recommendations, procurement explanations |
| Strongest implemented area | Transaction handling and portal flows | Forecasting, inventory policy, supplier scoring |
| Main gap | Limited real planning intelligence | Limited live integration to production transaction sources |

The Main System is responsible for capturing and managing business activity. It authenticates roles, stores pharmacy profiles, maintains inventory items, creates customer and pharmacy orders, tracks offline sales, calculates some dashboard metrics, and manages temporary stock reservation logic. In other words, it answers the question: **what is happening in the supply chain right now?**

My project is responsible for converting business activity into future-facing replenishment decisions. It ingests demand series, predicts what will likely be needed next, computes how much stock should exist to protect against uncertainty, generates reorder candidates, and chooses the most appropriate supplier using explicit constraints and weights. It answers the question: **what should the pharmacy do next to avoid stock problems?**

My project exists because the main system, by itself, is mostly a transactional platform. It can show low-stock conditions and manage order lifecycles, but it does not contain a fully implemented, mathematically grounded planning engine. The AI microservices inside the main system are mostly demo-oriented. My project fills that gap by providing actual executable forecasting, inventory, and procurement logic.

Architecturally, my project sits between the pharmacy's operational data and the distributor-facing procurement stage. Upstream, it depends on demand history, stock state, medicine identity, and supplier constraints. Downstream, it produces reorder requests, procurement-ready order quantities, selected distributors, and explanation logs. That means it behaves as a **decision-support subsystem embedded inside the larger medicine supply platform**.

## 3. End-to-End System Flow

The complete system flow, combining both overviews into one continuous pipeline, is as follows:

1. **User and entity setup (Main System)**  
   Customers, pharmacies, admins, and distributors are created through the user-service and corresponding portals. This establishes who can place orders, manage stock, approve actions, and view reports.

2. **Inventory creation and maintenance (Main System)**  
   Pharmacies add, edit, and delete inventory items through the inventory-service. The active inventory state is stored in `inventory_pharma.inv`, and dashboard statistics are derived from that stock plus temporary reservations.

3. **Demand generation through orders and sales (Main System)**  
   Demand enters the system through two main routes. Customers place online orders through the customer portal, and pharmacists record walk-in purchases through the offline sales flow. These two channels are the most important operational origins of medicine consumption.

4. **Order processing and stock reservation (Main System)**  
   The order-service creates pharmacy-specific orders, enforces order status transitions, and uses Redis reservation keys to hold stock temporarily for approved orders. This prevents double-committing stock while an order is still being fulfilled.

5. **Operational reporting and stock signals (Main System)**  
   The admin dashboard aggregates registrations, order activity, and pharmacy performance. The inventory and ICN-style pages also surface low-stock and near-expiry warnings. These are immediate operational signals, but they are not yet a full procurement engine.

6. **Demand-history assembly for planning (Integration Point)**  
   In the fully integrated architecture, the main system's order history and offline sales history should be transformed into monthly demand series per medicine. In the current implementation of my project, this step is represented by workbook ingestion from `backend/pharmacy_demand.xlsx` and a smaller legacy file `backend/data/medicine_history.xlsx`.

7. **Demand forecasting (My Project)**  
   The AI engine cleans and normalizes the monthly demand data, builds one time series per medicine, and forecasts the next month using Holt-Winters and Prophet. This produces both point forecasts and, from Prophet, uncertainty bounds.

8. **Inventory-policy calculation (My Project)**  
   Forecast results are converted into inventory decisions. The hybrid batch path computes safety stock, reorder point, target stock, reorder flag, and order quantity for each medicine. The older legacy path computes a threshold-style order plan for a single medicine.

9. **Reorder-request generation (My Project)**  
   Medicines whose current stock falls below the calculated reorder level are turned into a structured reorder payload. This is saved as `backend/data/monthly_reorder_requests.json` and also exposed through the FastAPI `/inventory` response.

10. **Supplier filtering and ranking (My Project)**  
   Each reorder request is passed to the procurement engine. Suppliers are first filtered by feasibility constraints such as distance, lead time, and minimum order value. The remaining suppliers are then scored using visible weights for distance, lead time, rating, and price.

11. **Procurement output generation (My Project -> Main System)**  
   The winning distributor and final order quantity are written into `backend/data/monthly_procurement_orders.json` and exposed through `/procurement/data`. A streaming `/procurement` endpoint can also emit visible reasoning and final JSON for dashboard display.

12. **Procurement execution and distributor interaction (Main System)**  
   In the intended full platform, the pharmacy-side procurement UI, distributor-side workflows, and any ICN or order-exchange flow would consume the recommendation and turn it into an executable purchase order. This is where my project hands control back to the main system.

13. **Delivery and fulfillment (Main System)**  
   Once procurement is executed, distributor and delivery subsystems take over. The driver backend and mobile app handle assigned deliveries and status tracking. This closes the physical supply chain loop.

14. **Monitoring, feedback, and next planning cycle (Main System + My Project)**  
   Completed sales, replenishment events, and updated stock become the next cycle's planning input. Over time, the system can evolve from isolated recommendations into a closed-loop operational planning platform.

The strongest present-day implementation is not the full closed loop above, but a partially connected version of it. The main system is stronger on live operational transactions; my project is stronger on actual forecasting and procurement intelligence. The combined architecture still forms one coherent full-system explanation.

## 4. Unified System Architecture

The combined architecture can be understood as five stacked layers.

```text
Users and Operational Roles
Customers | Pharmacists | Admins | Distributors | Drivers
        |
        v
Main System Portals and Operational Services
Customer Portal | Pharmacy Portal | Admin Portal | Distributor Portal | Driver App
User Service | Inventory Service | Order Service | Distributor Service | Delivery Backend
        |
        v
Operational Data Layer
MongoDB collections | Redis stock reservations | uploaded files | order history
        |
        v
AI Medical Supply Engine
Demand ingestion -> Forecasting -> Inventory policy -> Reorder payload -> Procurement engine
FastAPI endpoints -> /forecast | /inventory | /procurement | /procurement/data
        |
        v
Execution and Oversight
Procurement dashboards | Pharmacy procurement actions | Distributor fulfillment | Delivery tracking | Admin reporting
```

### Presentation layer

The presentation layer includes all user-facing interfaces. On the main system side, this consists of the customer portal, pharmacy portal, distributor portal, admin portal, separate order-tracking UI, and driver mobile app. On my project side, it consists of a dashboard frontend that shows forecasting outputs, reorder signals, and procurement decisions. The presentation layer is where human actors see the system, but it is not where the key planning decisions are computed.

### Transaction layer

The transaction layer is the operational core of the main system. The user-service manages authentication, registration, role-specific profile updates, password changes, and admin statistics. The inventory-service manages medicine records, stock CRUD, and derived inventory metrics. The order-service manages customer-to-pharmacy orders, pharmacy-side status transitions, offline orders, and Redis-based stock reservation. The distributor-service is much thinner, and the driver backend is a separate logistics subsystem. This layer is event-driven in the sense that it records business events as users act.

### Intelligence layer

The intelligence layer is my project. The actual decision engine lives under `backend/src/` and is wrapped by a FastAPI app under `backend/app/`. This layer has four internal stages:

1. demand ingestion and cleanup
2. next-period forecasting
3. inventory policy and reorder generation
4. supplier filtering, scoring, and procurement recommendation

An optional LLM explanation layer sits on top of the deterministic procurement result. It explains the chosen supplier but does not own the supplier-selection decision.

### Data layer

The data layer is split across both systems. The main system uses MongoDB databases such as `user_db`, `inventory_pharma`, and `order_db`, plus Redis reservation keys like `stock_reservation:{orderId}:{itemId}`. My project currently uses workbook files for demand input, static medicine metadata for current stock in the hybrid demo, sample distributor records, and generated JSON files for reorder and procurement outputs. In a future integrated deployment, the main system's databases should replace the workbook and static-data substitutes.

### Data flow, decision flow, and control flow

The **data flow** starts with user and stock events in the main platform, then moves into monthly demand history, forecasting results, policy calculations, reorder payloads, and procurement outputs. The **decision flow** starts with operational acceptance decisions such as whether an order can be approved, then moves into planning decisions such as whether a medicine must be replenished and from whom. The **control flow** alternates between user-triggered actions and scheduled or on-demand planning runs. The main system controls transactions; my project controls replenishment intelligence.

## 5. Module Breakdown - Main System

### Identity and role-management module

This module is centered on `backend/services/user-service/`. It handles customer login, pharmacy registration and login, admin registration and login, distributor user management, profile updates, password changes, and admin aggregate statistics. It is the authority for who exists in the platform and which interface they may use. Without this module, none of the other user-facing flows can be separated by responsibility.

### Customer commerce module

This module lives mainly in `frontend/customer-portal/` plus the order-service endpoints it calls. Its responsibility is medicine search, cart management, checkout confirmation, and customer-side order tracking. The customer chooses the order quantity; the quantity is not generated by an algorithm in this layer. The customer flow is therefore demand-generation logic rather than demand-planning logic.

### Pharmacy operations module

This is the most functionally rich portal in the main system. `frontend/pharmacy-portal/` includes inventory viewing, inventory editing, customer order processing, offline walk-in sales, dashboard statistics, ICN-related views, procurement setup pages, distributor browsing, and other operational pages. Some of those pages are backed by real routes, and some are partially wired or shell-like. Even so, this portal is the practical operational center of the main platform.

### Inventory management module

This module is implemented mainly in `backend/services/inventory-service/`. It stores medicine items in `inventory_pharma.inv`, provides pharmacy inventory CRUD, inventory statistics, item search, and prescription upload support. It also calculates availability using reserved stock from Redis. In business terms, this module answers the question: what does the pharmacy physically have, and how much of it is available for allocation?

### Online order and offline sales module

This module is implemented mainly in `backend/services/order-service/`. It creates pharmacy-specific customer orders in `customer_to_pharma_orders`, stores walk-in offline orders in `pharma_offline_orders`, enforces valid order status transitions, and creates or releases stock reservations. It is one of the strongest implemented parts of the main system because it captures the real moment where stock demand becomes operationally meaningful.

### Admin monitoring module

This module lives across `frontend/admin-portal/` and admin endpoints in the user-service. It computes counts of users and pharmacies, registration trends, and some revenue or order summary values. It does not plan replenishment, but it gives management-level visibility into the state of the platform.

### Distributor, procurement UI, and logistics module

The main system contains distributor-related UI, pharmacy-side procurement pages, a distributor portal, and a separate driver app/backend. Architecturally, these modules are important because they represent the execution side of replenishment. However, their backend support is more limited than the UI surface suggests. This is exactly where my project fits: it provides the missing intelligence that these pages were conceptually designed to consume.

### API gateway, AI demos, and support modules

The main system also includes an Apollo GraphQL gateway scaffold, three Python AI microservices, a separate tracking UI, database seed files, monitoring stubs, and design documents. These are important for architecture explanation because they show the intended system breadth, but they are less central than the user-service, inventory-service, and order-service when discussing what is concretely implemented.

## 6. Module Breakdown - My Project

### API integration layer

The service entry point is `backend/app/main.py`. It starts a FastAPI application, enables CORS, and mounts three router groups:

- `/forecast`
- `/inventory`
- `/procurement`

This layer is important because it converts script-oriented planning code into a subsystem that other interfaces can call. It is the cleanest architectural seam between my project and the main platform.

### Demand ingestion and normalization layer

This layer is implemented mainly in `backend/src/forecast.py`. It reads Excel workbooks, resolves a usable sheet, cleans column names, detects valid date/quantity pairs, converts numeric strings into numbers, removes unusable rows, groups duplicates, and builds one continuous monthly series per medicine. Missing months are inserted with zero demand. This is the point where raw historical data becomes model-ready time series.

### Forecasting layer

The forecasting logic is split across `backend/src/forecast.py` and `backend/src/prophet_model.py`. Holt-Winters produces one-step monthly demand forecasts using a model-selection ladder based on history length. Prophet provides an alternative point forecast plus interval bounds. These two outputs become the numerical basis of downstream inventory decisions.

### Inventory-policy layer

This layer is implemented primarily in `backend/src/Holtphet.py`, with older logic in `backend/src/main.py`, `backend/src/inventory_policy.py`, and `backend/src/inventory_math.py`. The newer hybrid batch path computes ensemble forecast, uncertainty-driven safety stock, reorder point, target stock, reorder flag, and order quantity for many medicines at once. The older path supports a single-medicine threshold-oriented plan. Together, they show the evolution of the subsystem from a simple planner to a more complete batch inventory engine.

### Batch orchestration and reorder-payload layer

`backend/src/holtphet_main.py` orchestrates the batch cycle. It locates the workbook, loads demand, runs Holt-Winters and Prophet, computes the hybrid policy, enriches rows with medicine names, builds a display-friendly table, and writes reorder requests to JSON. This module is the handoff point from analytics to operational action.

### Procurement decision engine

This layer is implemented in `backend/src/procurement_main.py` and `backend/src/engine/`. It normalizes reorder requests, checks whether a medicine actually requires procurement, filters candidate suppliers, scores the survivors, chooses the top-ranked supplier, and returns a procurement result. It is deterministic first, auditable, and structured in stages rather than as one opaque model.

### Explanation and reflection layer

`backend/src/engine/agent.py` and `backend/app/services/procurement_service.py` add an optional explanation layer. When configured, the subsystem can stream visible reasoning and final JSON through the `/procurement` endpoint using Groq-backed models. This layer improves interpretability for dashboards and presentations, but it does not replace the deterministic procurement decision.

### Dashboard frontend

The frontend under `frontend/src/` consumes `/forecast`, `/inventory`, and `/procurement` outputs. It presents summary cards, forecasting tables, reorder candidates, and live procurement reasoning. This is the presentation face of my subsystem. It is especially valuable in a project presentation because it makes the hidden planning pipeline visible to non-technical evaluators.

## 7. Integration Points Between Systems

This is the most important section for understanding how the two systems connect.

### 7.1 Upstream data entering my project

My project needs four categories of input:

1. **Demand history**  
   The ideal source is the main system's online orders and offline sales. Those events reflect medicine consumption and should be aggregated into monthly demand per medicine.

2. **Current stock state**  
   The ideal source is the main system's inventory-service, adjusted by Redis reservations so that available stock rather than gross stock drives replenishment.

3. **Pharmacy context and control constraints**  
   Pharmacy identity, location, and acceptable lead-time windows are needed for procurement.

4. **Supplier master data**  
   Distributor identity, location, lead days, ratings, prices, and minimum order values are required for supplier ranking.

In the current prototype, only the API shell is integration-ready. The actual data inputs are still represented by stand-ins:

- `backend/pharmacy_demand.xlsx` for monthly demand
- `backend/data/medicine_history.xlsx` for the legacy single-series flow
- `MEDICINE_NAME_MAP` in `backend/src/holtphet_main.py` for current-stock snapshots
- `SAMPLE_DISTRIBUTORS` in `backend/src/procurement_data.py` for supplier data

### 7.2 Downstream outputs leaving my project

My project produces four integration-ready outputs:

1. **Forecast snapshot** through `GET /forecast`  
   Returns medicine-wise next-month demand estimates and recent history metadata.

2. **Inventory-policy snapshot** through `GET /inventory`  
   Returns per-medicine forecast quantity, current stock, safety stock, reorder point, target stock, reorder flag, and order quantity. It also exposes reorder requests.

3. **Procurement batch output** through `GET /procurement/data`  
   Returns selected supplier decisions in structured JSON.

4. **Procurement reasoning stream** through `GET /procurement`  
   Streams visible reasoning and final JSON for an enterprise-style dashboard experience.

The same planning results are also persisted as files:

- `backend/data/monthly_reorder_requests.json`
- `backend/data/monthly_procurement_orders.json`

These files are useful as integration artifacts when APIs are not yet fully wired into the larger platform.

### 7.3 Concrete interface map

| Interface | Producer | Consumer | Current form | Architectural purpose |
| --- | --- | --- | --- | --- |
| Online order history | Main System order-service | My Project | Conceptual future integration | Demand source for forecasting |
| Offline sales history | Main System offline order flow | My Project | Conceptual future integration | Demand source for forecasting |
| Live inventory snapshot | Main System inventory-service | My Project | Conceptual future integration | Current stock input for reorder logic |
| Redis reservations | Main System order-service | My Project | Conceptual future integration | Available-stock correction |
| `backend/pharmacy_demand.xlsx` | Current AI-engine setup | My Project | Implemented now | Workbook substitute for live demand history |
| `MEDICINE_NAME_MAP` current stock | Current AI-engine setup | My Project | Implemented now | Demo stock snapshot |
| `SAMPLE_DISTRIBUTORS` | Current AI-engine setup | My Project | Implemented now | Demo supplier master |
| `/forecast` | My Project | Dashboard or future main UI | Implemented now | Forecast visibility |
| `/inventory` | My Project | Dashboard or future pharmacy UI | Implemented now | Reorder visibility |
| `/procurement/data` | My Project | Dashboard or future procurement UI | Implemented now | Supplier-ready order output |
| `/procurement` | My Project | Dashboard | Implemented now | Live explanation stream |
| `monthly_reorder_requests.json` | My Project inventory cycle | Procurement stage or external consumer | Implemented now | Planning-to-execution handoff |
| `monthly_procurement_orders.json` | My Project procurement cycle | Main procurement/distributor flow | Implemented now | Supplier selection handoff |

### 7.4 Assumptions behind the integration

The integration depends on several contract assumptions:

- medicine identifiers must match across inventory, demand history, and supplier catalogs
- unit definitions must be consistent across sales, stock, and procurement
- monthly demand aggregation must refer to the same medicine granularity used in stock records
- current stock should ideally be reservation-aware, not merely raw on-hand quantity
- supplier data must be trustworthy enough for ranking
- the main system must remain responsible for final purchase-order execution, fulfillment, and delivery status

This means my project is not replacing the main system. It is adding a decision layer that the main system can call and then operationalize.

## 8. Algorithms Used Across the Full System

The combined platform contains two different kinds of algorithms: operational transaction logic from the main system and planning/procurement algorithms from my project.

### 8.1 Main-system operational algorithms

The main system uses deterministic business rules to handle daily operations.

**Low-stock detection** is threshold-based. Inventory and ICN-style pages identify low-stock situations by comparing available units against a manually stored threshold. This is a warning algorithm, not a procurement algorithm. Its purpose is to surface risk, not to compute an optimized order quantity.

**Reservation-aware stock logic** is implemented through Redis. When a pharmacy approves an order, the order-service creates reservation keys of the form `stock_reservation:{orderId}:{itemId}`. Available stock is effectively computed as:

```text
available_stock = max(on_hand_stock - reserved_stock, 0)
```

This matters because the AI engine should ideally consume reservation-aware stock, not only raw stock.

**Order-state transition logic** is implemented as a finite state machine. Orders move from `PLACED` to `APPROVED` or `REJECTED`, then from `APPROVED` to `READY_FOR_PICKUP`, `COMPLETED`, `REJECTED`, or `CANCELLED`, and from `READY_FOR_PICKUP` to `COMPLETED` or `REJECTED`. This guarantees lifecycle consistency.

**Timeout and expiry logic** uses test-oriented constants. Approved and ready-for-pickup orders expire quickly because timeout values are currently set to 10 seconds for demo behavior. This is a workflow-control algorithm rather than a forecasting algorithm.

**Order total and tax calculation logic** in customer and pharmacy checkout flows computes selling price, MRP, discount, taxable value, GST, CGST, and SGST. This supports invoice-style order summaries and tax-aware offline order records.

**Offline sales total logic** aggregates item prices and quantities into a final bill amount. The formula is arithmetic rather than predictive, but it is important because it creates real demand records that should later feed forecasting.

**Admin growth and revenue aggregation** computes registration growth and dashboard revenue summaries. These are reporting formulas, not control formulas, but they show how the system turns raw events into management metrics.

**Main-system demo forecasting** also exists, but it is weak compared with my project's forecasting engine. The built-in AI microservice generates synthetic historical sales from a Poisson distribution, applies a 7-day moving average, adjusts for recent trend, and produces a confidence score based on recent variance. That service is best described as a demo endpoint, not as the authoritative planning engine of the full system.

### 8.2 My project's demand-forecasting algorithms

My project contains the real forecasting logic for the unified system.

**Demand normalization and time-series preparation**  
`backend/src/forecast.py` cleans workbook columns, chooses usable date and quantity columns, groups duplicate observations, and reindexes every medicine to a complete month-start series. Missing months are filled with zeros. The effect of this design is that the forecasting models always receive a continuous monthly signal.

**Holt-Winters forecasting**  
The function chooses model structure based on history length:

```text
if n >= 24:
    additive trend + multiplicative seasonality
    fallback to additive seasonality if multiplicative fails
elif 6 <= n < 24:
    additive trend, no seasonality
else:
    non-negative mean demand
```

This gives the engine a classical, explainable time-series forecast that remains usable for short and medium histories.

**Prophet forecasting**  
Prophet is configured with yearly seasonality, no daily or weekly seasonality, and a 95 percent interval. For each medicine, it produces:

```text
prediction = yhat(t+1)
lower = yhat_lower(t+1)
upper = yhat_upper(t+1)
```

The interval is later used as a proxy for forecast uncertainty.

**Uncertainty extraction**  
When Prophet returns lower and upper bounds, my project approximates standard deviation as:

```text
sigma ~= (upper - lower) / 4
```

This is then used inside safety-stock calculations.

### 8.3 My project's hybrid inventory algorithms

The project contains two inventory models: an older single-medicine threshold model and a newer batch hybrid model.

**Legacy threshold model** in `backend/src/main.py` uses the following logic:

```text
lead_time_months = lead_time_days / 30
forecast = next_month_forecast
mu = mean(demand)
sigma = std(demand)
expected_lead_time_demand = forecast * lead_time_months
safety_stock = Z * sigma * sqrt(lead_time_months)
reorder_point = expected_lead_time_demand + safety_stock
new_threshold = round(reorder_point)
reorder = current_stock < new_threshold
required_units = ceil(max(0, forecast + safety_stock - current_stock))
```

This model is simple and easy to explain, but it does not compute the same target-stock quantity as the newer hybrid model.

**Hybrid batch model** in `backend/src/Holtphet.py` is the more important algorithm for the full subsystem:

```text
forecast_hw = max(hw_forecast, 0)
forecast_prophet = max(prophet_prediction, 0)
weight_hw = clip(1 - sigma / abs(forecast_prophet), 0, 1)
weight_prophet = 1 - weight_hw
ensemble_forecast = weight_hw * forecast_hw + weight_prophet * forecast_prophet
demand_during_lead_time = ensemble_forecast * 0.5
safety_stock = 1.65 * sigma * sqrt(0.5)
reorder_point = demand_during_lead_time + safety_stock
target_stock = ensemble_forecast + demand_during_lead_time + safety_stock
reorder = current_stock < reorder_point
order_qty = max(0, target_stock - current_stock) if reorder else 0
```

This algorithm performs the actual replenishment decision. It converts forecasting outputs into operational stock policy outputs.

A technically important viva point is that the implemented weight formula should be explained honestly. The subsystem is clearly trying to blend Holt-Winters and Prophet, but the exact weighting rule means the influence of Prophet does not decrease in a simple way when uncertainty increases. That is a valid future improvement area.

### 8.4 Reorder-generation logic

Once the hybrid policy is computed, `backend/src/holtphet_main.py` creates reorder requests only for medicines whose `reorder` flag is true and whose rounded-up `order_quantity` is positive. Each output record contains pharmacy identity, medicine identity, medicine name, current stock, required stock, final order quantity, and a trigger reason that explains why the reorder fired.

This stage matters because it is the contract boundary between inventory planning and procurement execution.

### 8.5 Procurement logic

The procurement engine uses a two-stage algorithm.

**Stage 1: hard feasibility filters**

```text
1. Keep supplier if euclidean_distance(supplier.location, pharmacy.location) <= 50
2. Keep supplier if supplier.lead_days <= max_lead_days
3. Keep supplier if required_units * price_per_unit >= min_order_value
```

This stage removes infeasible suppliers before ranking. It makes the procurement process auditable because impossible options are excluded explicitly.

**Stage 2: weighted additive scoring**

The default weights are:

```text
distance = 0.30
lead_time = 0.30
rating = 0.25
price = 0.15
```

The raw scoring functions are:

```text
distance_score = 1 / (distance + 1)
lead_time_score = 1 / (lead_days + 1)
rating_score = rating / 5
price_score = 1 / (price_per_unit + 1)
```

The total score is the weighted sum of those components, and the top-scoring supplier wins.

This is not machine-learned supplier ranking. It is an interpretable decision rule. That is a strength for viva defense because every supplier choice can be explained in plain business terms.

### 8.6 Explanation and reflection logic

The procurement agent layer can add natural-language reasoning and a reflection summary, but it does not alter the selected supplier. The deterministic pipeline always makes the actual choice first. If the LLM path fails or is unavailable, the subsystem falls back to deterministic explanation text. This is the correct architectural story: AI explanation is optional, supplier selection is not.

### 8.7 What algorithms decide what in the full system

The full-system decision chain is therefore split clearly:

- Main-system rules decide whether a user can log in, whether an order can move to the next state, how stock is reserved, and how totals are calculated.
- My project's forecasting algorithms decide expected next-period demand.
- My project's inventory algorithms decide whether replenishment is required and how much to order.
- My project's procurement algorithms decide which supplier is operationally best under the current rules.
- Main-system execution modules decide how the recommendation is fulfilled in the real logistics workflow.

## 9. Data Flow Across Entire System

The combined system uses several distinct data domains.

| Data source | Owner | Typical content | Role in the complete system |
| --- | --- | --- | --- |
| `user_db` collections | Main System | customer, pharmacy, admin, distributor accounts | role management and access control |
| `inventory_pharma.inv` | Main System | pharmacy stock records, thresholds, dates, pricing | on-hand stock source |
| `order_db.customer_to_pharma_orders` | Main System | online medicine orders and lifecycle status | demand source and fulfillment state |
| `order_db.pharma_offline_orders` | Main System | walk-in pharmacy sales with tax metadata | additional demand source |
| Redis reservation keys | Main System | temporary stock holds per order and item | available-stock correction |
| delivery collections | Main System | assigned deliveries and logistics status | downstream execution tracking |
| `backend/pharmacy_demand.xlsx` | My Project, current prototype | monthly medicine demand history | current forecasting input |
| `backend/data/medicine_history.xlsx` | My Project, legacy path | single-series historical demand | legacy planner input |
| `MEDICINE_NAME_MAP` | My Project, current prototype | medicine names and stock snapshots | demo stock input |
| `SAMPLE_DISTRIBUTORS` | My Project, current prototype | supplier metadata | procurement input |
| `monthly_reorder_requests.json` | My Project | reorder candidates | inventory-to-procurement handoff |
| `monthly_procurement_orders.json` | My Project | final supplier-ready orders | procurement output |

### 9.1 Current implemented data movement in my project

The current executable planning flow inside my subsystem is:

```text
pharmacy_demand.xlsx
-> cleaned demand DataFrame
-> per-medicine monthly series
-> Holt-Winters forecasts
-> Prophet forecasts
-> hybrid inventory policy DataFrame
-> reorder_requests JSON
-> procurement engine
-> procurement_orders JSON
-> FastAPI responses and dashboard tables
```

At the same time, the main system runs a separate operational flow:

```text
role-based login
-> inventory CRUD
-> customer orders and offline sales
-> reservation and status transitions
-> admin summaries
-> distributor / driver / tracking views
```

### 9.2 Target integrated data movement across both systems

The ideal combined data flow is:

```text
customer orders + offline sales + stock updates + reservations
-> monthly demand extraction and stock snapshot generation
-> AI forecast and inventory policy
-> reorder requests
-> supplier ranking
-> pharmacy procurement approval
-> distributor execution
-> driver delivery updates
-> replenishment arrival
-> next planning cycle
```

This is the complete architecture the two overviews imply when reconstructed together.

### 9.3 Intermediate data products

The most important intermediate datasets are:

- cleaned demand frames
- `dict[str, pandas.Series]` per-medicine monthly time series
- Holt-Winters forecast dictionary
- Prophet forecast dictionary
- hybrid policy DataFrame with forecast, safety stock, reorder point, target stock, and order quantity
- normalized reorder-request payload
- filtered supplier shortlist
- scored supplier ranking
- final procurement order payload

These intermediate representations matter because they show that the system is not one black box. It is a sequence of explicit, inspectable transformations.

### 9.4 Final outputs

Across the whole system, the meaningful outputs are:

- customer-visible order confirmations and tracking states
- pharmacy-visible inventory status, order queues, and offline sale records
- admin-visible counts, growth metrics, and summary dashboards
- AI-visible forecast tables, reorder flags, and order quantities
- procurement-visible supplier recommendations and streamed reasoning
- distributor-visible purchase demand
- driver-visible delivery tasks and delivery state

## 10. Decision-Making Flow of the Whole System

The complete system makes a chain of decisions rather than one single decision.

| Decision | Where it is made | Main variables | Output |
| --- | --- | --- | --- |
| Role authorization | Main System user-service | credentials, role, profile data | login token and role-scoped access |
| Inventory availability | Main System inventory-service | stock, reservations, threshold | available quantity and low-stock signal |
| Customer order acceptance | Main System order-service | cart contents, pharmacy grouping, item metadata | order records |
| Order progression | Main System order-service | current status, requested next status | approved, rejected, ready, completed, cancelled, expired |
| Reservation creation/release | Main System order-service + Redis | order status, item quantity | temporary stock hold or release |
| Demand forecast | My Project forecasting layer | monthly demand history per medicine | next-month forecast values |
| Reorder trigger | My Project inventory layer | current stock, forecast, sigma, lead time | boolean reorder decision |
| Reorder quantity | My Project inventory layer | target stock, current stock | suggested order quantity |
| Supplier eligibility | My Project procurement filters | distance, lead days, minimum order value | shortlist of feasible suppliers |
| Supplier ranking | My Project procurement scoring | distance, lead time, rating, price | top-ranked supplier |
| Procurement explanation | My Project explanation layer | forecast, stock, reorder payload, supplier data | human-readable reasoning |
| Delivery progression | Main System driver subsystem | assigned delivery, route status | pickup, transit, delivered, failed |

### 10.1 Early operational decisions

The first group of decisions lives fully inside the main system. These include who can access which portal, whether a medicine is available, how customer orders are recorded, and whether an order may transition to the next lifecycle state. These decisions are immediate and transactional.

### 10.2 Planning decisions

The second group of decisions begins when operational data is converted into planning signals. My project decides whether a medicine should be reordered, how much should be ordered, and which supplier is best. These decisions are predictive and optimization-oriented rather than purely transactional.

### 10.3 Execution decisions

The third group of decisions returns to the main system. Once my project recommends a supplier and order quantity, pharmacy staff or downstream execution modules decide whether to confirm the purchase, which distributor process handles it, how the delivery is assigned, and when the replenishment physically arrives.

### 10.4 Why this split matters

This separation is actually a design strength. Not every decision in a medicine supply platform should be made by AI. Transaction validation and lifecycle control should remain deterministic. Planning and procurement recommendation benefit from forecasting and scoring. The combined architecture assigns each decision type to the layer that can justify it best.

## 11. System Assumptions and Constraints

The full system relies on a number of assumptions from both overviews.

### Data assumptions

- Historical demand can be meaningfully represented at monthly granularity.
- Missing months in the demand workbook are treated as zero demand rather than unknown demand.
- Medicine identifiers are stable across demand history, stock records, and procurement data.
- Current stock and historical demand refer to the same physical unit of measure.
- Offline pharmacy sales and online orders are both valid contributors to true demand.

### Inventory and forecasting assumptions

- The hybrid batch model uses a fixed lead time of 0.5 months.
- The service factor used for the hybrid safety-stock calculation is 1.65.
- Prophet interval width is a usable proxy for demand uncertainty.
- Current stock is used directly; inventory position with on-order stock is not modeled.
- The batch engine assumes one monthly forecast horizon is enough for the next procurement decision.

### Procurement assumptions

- Supplier distance can be approximated by Euclidean coordinates rather than real road distance.
- Supplier suitability can be expressed through four weighted criteria: distance, lead time, rating, and price.
- The order should be assigned to one best supplier rather than split across multiple suppliers.
- Minimum order value is a hard constraint, not a soft penalty.
- Supplier data is trustworthy and sufficiently current.

### Main-system operational assumptions

- Low-stock thresholds are entered or maintained manually.
- Reservation TTL and timeout values are currently demo values rather than production values.
- Status transitions encode the intended business policy for order fulfillment.
- Some portal flows assume backend routes and schemas that are broader than the currently implemented services.

### Integration assumptions

- The AI engine can eventually consume live data from the main system instead of spreadsheets.
- The pharmacy portal or procurement workflow can consume JSON outputs or API responses from my project.
- The main system remains the authority for execution, fulfillment, and user interaction.

### Technical constraints

- The main system contains schema, route, and port mismatches in some areas.
- My project is cleaner in internal planning logic than in live operational integration.
- Some components use static or sample data because the full data pipeline is not yet wired.

## 12. System Limitations

The unified system is strong as a prototype architecture, but it has real limitations that should be stated clearly.

### Integration limitations

- The closed loop from live transaction data to AI planning is not fully wired. My project still uses workbook-based demand input and sample supplier data.
- The main system's procurement, ICN, and distributor-facing workflows are broader at the UI level than at the backend level.
- Some field names and database assumptions differ across services, which makes full end-to-end execution fragile.

### Data limitations

- Demand forecasting in my project depends on curated workbook input rather than a continuously maintained transaction-derived dataset.
- Current stock in the batch hybrid flow is taken from a hardcoded medicine map, not the live inventory database.
- Supplier data is static and small, so the procurement result is realistic in structure but limited in market coverage.

### Modeling limitations

- Missing months are zero-filled, which may understate demand when data is absent rather than truly zero.
- Inventory position is not modeled, so in-transit purchase orders are ignored.
- Pack sizes, dosage-form conversions, and subunit constraints are not modeled.
- Lead-time uncertainty is not built into procurement or safety-stock logic beyond fixed lead-time assumptions.
- The ensemble weighting rule is transparent but not perfectly calibrated.

### Operational limitations

- The main system's built-in AI services are still demo-oriented.
- Some frontends expect richer routes than the current backends actually provide.
- The driver and delivery subsystem is not tightly bound to the order lifecycle of the main order-service.
- Real-time behavior is limited. Most planning runs are on-demand or batch-triggered rather than event-stream based.

### Engineering limitations

- The overall architecture mixes mature modules, mock modules, and partially wired modules.
- Some contracts are hidden in code rather than formalized in a shared schema.
- The procurement output is simplified when saved; rich scoring details are not preserved in the final batch file.
- The system is more suitable for academic demonstration and architectural reasoning than for production deployment in its current state.

## 13. How To Explain This Project in Presentation

### 2 minute explanation

This project is a complete medicine supply management platform built in two layers. The first layer is the main operational system, which lets customers place medicine orders, pharmacies manage inventory and offline sales, admins monitor the platform, and logistics staff handle delivery workflows. The second layer is my project, which acts as the intelligence engine for the platform. It takes medicine demand history and stock data, predicts next-month demand, calculates reorder quantities using inventory formulas, and selects the best supplier using deterministic scoring. In short, the main system records what is happening, and my project decides what the pharmacy should do next to avoid stockouts and procure medicines intelligently.

### 5 minute explanation

The combined system solves a realistic pharmacy operations problem. Pharmacies do not only need a website or a dashboard; they need a complete loop from customer demand to stock replenishment. The main system provides that operational foundation. Customers can search and place orders, pharmacies can manage stock and walk-in billing, and the backend stores orders, inventory, reservations, and user information. However, transactional systems alone do not answer the planning question of when to reorder and from whom.

That is where my project fits in. My subsystem reads historical monthly demand, cleans the data, and builds one time series per medicine. It then forecasts the next month's demand using Holt-Winters and Prophet, computes safety stock and reorder point, and generates reorder requests only for medicines that have crossed the calculated threshold. After that, a procurement engine filters distributors by distance, lead time, and minimum order value, scores the remaining suppliers using visible weights, and chooses the most suitable distributor. The result is shown through a FastAPI backend and dashboard frontend, including optional AI-generated reasoning for explanation. So the platform becomes more than a transaction system; it becomes a decision-support system.

### Architecture explanation

The easiest way to explain the architecture is as a separation between operations and intelligence. The main system contains the multi-role portals and transactional services. My project is an internal planning engine exposed through its own API. Operational data flows upward from inventory and order history into the AI engine. Decision outputs flow back downward from the AI engine into pharmacy procurement and distributor execution. This separation is useful because it keeps forecasting and procurement logic modular without disturbing the transaction core.

### Innovation explanation

The strongest innovation is not that the system uses AI as a buzzword. The actual innovation is that it connects multiple layers of the medicine supply chain: customer demand, pharmacy inventory, walk-in sales, reorder-point logic, supplier ranking, and explainable procurement output. The design is also careful about deterministic control. Supplier choice is made through explicit filters and weights, while the LLM layer is used only to explain the result rather than to make an uncontrolled decision.

### Why the system is useful

The platform is useful because it addresses both daily operations and forward planning. A pharmacy can run orders and inventory today, and at the same time use the AI engine to decide tomorrow's replenishment. This can reduce stockouts, reduce manual threshold guesswork, and create more consistent supplier choices. It also gives administrators and evaluators a complete digital story from demand capture to procurement action.

### What makes this project unique

What makes the project unique is that it is not just a forecasting notebook and not just a portal demo. The main system provides real multi-role operational workflows. My project provides an actual decision pipeline from time-series demand to procurement recommendation. When presented together, the result is a full-system architecture that is broader than a pure AI model and more intelligent than a pure transaction system.

## 14. Viva Questions and Answers

### Q1. What is the difference between the main system and your project?

The main system is the operational platform. It manages users, inventory, customer orders, offline sales, dashboards, and delivery-related workflows. My project is the planning subsystem. It consumes demand and stock signals, forecasts future demand, calculates reorder quantities, and selects suppliers. The main system records business activity; my project turns that activity into replenishment decisions.

### Q2. Why did you keep the planning engine separate from the transaction platform?

Forecasting and procurement logic have different responsibilities from login, CRUD, and order status handling. Keeping them separate makes the architecture cleaner, allows the AI engine to evolve independently, and avoids coupling prediction code tightly to order-processing code. It also makes the system easier to explain in a report because each layer has a clear responsibility.

### Q3. Why is the main system alone not enough?

The main system can show low-stock status and manage orders, but it does not contain a fully implemented, mathematically grounded procurement engine. It knows what is happening now, but it does not fully compute what stock should exist next month or which supplier should be chosen. My project fills that missing planning layer.

### Q4. Why did you use both Holt-Winters and Prophet?

Holt-Winters is a classical, fast, interpretable model that handles trend and seasonality well for monthly demand. Prophet gives a second forecast and interval bounds that can be used to estimate uncertainty. Using both allows the subsystem to avoid depending on a single modeling assumption.

### Q5. What is safety stock in your system?

Safety stock is the protective buffer above expected lead-time demand. In the hybrid batch model, it is computed as `1.65 * sigma * sqrt(lead_time)`, where sigma comes from the Prophet interval. Its purpose is to reduce stockout risk when demand is uncertain.

### Q6. What is the reorder point?

The reorder point is the stock threshold below which a new order should be triggered. In the hybrid model it is `demand_during_lead_time + safety_stock`. If current stock is below this value, the subsystem marks the medicine for replenishment.

### Q7. How do you calculate the order quantity?

In the hybrid batch model, the system first computes a target stock level equal to next-cycle demand plus lead-time demand plus safety stock. If current stock is below the reorder point, the order quantity becomes `target_stock - current_stock`, rounded up to an integer. That means the system does not only ask whether to reorder; it also tells how much to order.

### Q8. How is the supplier selected?

Supplier selection happens in two stages. First, infeasible suppliers are removed using distance, lead-time, and minimum-order-value constraints. Second, the remaining suppliers are scored using weighted criteria for distance, lead time, rating, and price. The supplier with the highest total score is selected.

### Q9. Does the LLM choose the supplier?

No. The supplier is chosen by deterministic filters and scoring rules. The LLM layer only explains the decision or reflects on it. This is an important design choice because it keeps procurement auditable.

### Q10. How does stock reservation in the main system support your project?

Reservation logic prevents the same stock from being promised to multiple orders at once. In a fully integrated setup, my project should use reservation-aware available stock rather than raw stock. That would make the reorder decisions more realistic because reserved stock is effectively unavailable for new demand.

### Q11. What is the difference between online orders and offline sales in the full system?

Online orders originate from customers through the customer portal and go through a lifecycle such as placed, approved, ready for pickup, and completed. Offline sales originate directly at the pharmacy for walk-in customers. Both represent demand, but they are captured through different workflows and stored in different collections.

### Q12. Why is the system not called fully real-time?

Because the main planning engine runs on demand or in batch rather than through a continuous event-stream architecture. The platform has near-real-time transaction updates, especially for order status and reservations, but the forecasting and procurement stages are not yet live streaming control loops.

### Q13. What are the biggest current limitations?

The biggest limitations are incomplete live integration, schema mismatches across some main-system modules, workbook-based demand input in my subsystem, static supplier data, missing unit-conversion logic, and partially implemented procurement/distributor execution backends. These are prototype limitations, not conceptual architecture failures.

### Q14. What happens if no supplier satisfies the filters?

The procurement engine stops cleanly and returns a failure-style result indicating that no valid distributor was found. In practice, that means the pharmacy would need manual intervention, relaxed constraints, or an expanded supplier pool.

### Q15. Why did you choose deterministic procurement scoring instead of a black-box AI model?

Supplier choice affects cost, speed, and risk. Deterministic scoring is easier to audit, easier to defend in viva, and easier to tune with business logic. It lets us explain exactly why one supplier was chosen over another.

### Q16. What future work would make the system stronger?

The highest-value upgrades are live database integration for demand and stock, inventory-position tracking with in-transit orders, pack-size and dosage-form conversion, stronger ensemble calibration, richer supplier master data, and direct purchase-order execution into the main system's distributor and logistics layers.

## 15. Report Writing Notes

### Problem Statement

Pharmacy supply operations are often fragmented across manual stock tracking, isolated order records, and ad hoc supplier selection. This leads to delayed replenishment, inconsistent procurement decisions, and stockouts. The combined system addresses this problem by integrating operational medicine workflows with an AI-driven forecasting and procurement subsystem.

### Objectives

The primary objective of the main system is to digitize customer ordering, pharmacy inventory, offline billing, admin monitoring, and logistics workflows within a single role-based platform. The primary objective of my project is to extend that platform with demand forecasting, reorder-point calculation, and supplier recommendation so that pharmacies can move from reactive stock handling to planned replenishment.

### System Architecture

The full system follows a layered service-oriented architecture. The main layer contains user, inventory, order, distributor, admin, and delivery modules. Above this operational layer sits the AI Medical Supply Engine, which reads demand and stock signals, generates forecasts, computes inventory-policy outputs, and produces procurement recommendations. FastAPI endpoints provide the integration bridge between the intelligence layer and the presentation layer.

### Forecasting Layer

The forecasting layer converts historical medicine demand into one-step-ahead monthly forecasts. It first cleans and normalizes raw data, then applies Holt-Winters and Prophet. Holt-Winters contributes a classical forecast based on level, trend, and possible seasonality, while Prophet contributes a second forecast and uncertainty interval. These outputs form the basis of downstream inventory decisions.

### Inventory Layer

The inventory decision layer translates demand forecasts into operational replenishment signals. It computes safety stock, reorder point, target stock, reorder status, and order quantity. This allows the subsystem to decide not only whether stock is low, but whether it is low relative to expected demand and uncertainty.

### Procurement Layer

The procurement layer converts reorder decisions into supplier choices. Candidate distributors are filtered using hard feasibility constraints such as distance, lead time, and minimum order value. The remaining suppliers are ranked using a weighted additive model that balances logistics speed, supplier quality, and price. The output is a supplier-ready procurement recommendation.

### Integration Layer

The integration layer connects the main operational platform with the AI engine. In the current prototype, integration is represented through workbook input, JSON handoff files, and FastAPI endpoints. In the target architecture, the same layer would consume live order history, live stock snapshots, and supplier master data directly from the main system and return procurement results back into pharmacy and distributor workflows.

### Results

The system demonstrates a full technical reasoning chain from operational demand to procurement recommendation. The main system successfully captures user, order, stock, and sales workflows, while my project successfully computes forecasts, reorder candidates, and ranked suppliers. Even though the final closed loop is not yet fully live, the combined architecture already demonstrates end-to-end design thinking and executable decision logic.

### Limitations

The present system is still a prototype. Some data contracts are inconsistent, some frontends are more complete than their backends, and the AI engine still uses substitute inputs such as spreadsheets and static supplier data. These limitations should be presented honestly as current implementation boundaries rather than hidden.

### Future Work

Future work should focus on replacing static inputs with live operational data, formalizing shared schemas, tracking in-transit inventory, modeling pack-size constraints, enriching supplier data, and connecting procurement outputs directly to purchase-order execution and delivery tracking. These improvements fit naturally into the existing architecture and would move the system closer to production realism.

## 16. Final System Understanding Summary

The easiest way to remember the complete system is as a technical story.

A customer places an online medicine order, or a pharmacist records a walk-in sale. The main system stores that demand event, updates order state, and manages temporary stock reservation so that inventory is not overcommitted. The inventory-service continues to represent what the pharmacy holds, while the admin and operational portals expose the current business state to human users.

At that point, my project takes over as the intelligence layer. It collects historical demand, standardizes it into monthly time series, forecasts likely next-period demand medicine by medicine, and combines forecast and uncertainty into inventory-policy variables such as safety stock and reorder point. Whenever a medicine's stock is insufficient relative to those values, the subsystem generates a reorder request and computes how much should be purchased.

The procurement engine then converts that reorder need into a supplier decision. It removes suppliers that are too far away, too slow, or economically invalid for the order size. It ranks the remaining suppliers using explicit weights for distance, lead time, rating, and price. The best supplier is selected, logged, and optionally explained in plain language for dashboard users.

Control then returns to the main system, where pharmacy or distributor workflows can convert the recommendation into an actual procurement action. Once fulfilled, logistics modules and delivery staff carry the medicines through the physical supply chain, and the resulting sales and stock changes become future planning input.

So the complete system is not just a website and not just an AI model. It is a layered medicine supply-chain architecture in which the main system handles operations and my project provides decision intelligence. That is the most accurate, complete, and defensible way to explain how the full platform works from start to finish.
