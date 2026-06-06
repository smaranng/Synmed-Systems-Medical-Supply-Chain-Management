# Medical Supply Chain Website - File Structure

## Project Root Structure

```
medical-supply-chain/
├── README.md
├── package.json
├── docker-compose.yml
├── .env.example
├── .gitignore
├── docs/
│   ├── api/
│   ├── deployment/
│   └── design/
├── frontend/
│   ├── customer-portal/
│   ├── pharmacy-portal/
│   ├── distributor-portal/
│   ├── admin-portal/
│   └── shared/
├── backend/
│   ├── api-gateway/
│   ├── services/
│   ├── shared/
│   └── database/
├── ai-services/
│   ├── demand-forecasting/
│   ├── invoice-processing/
│   └── analytics-engine/
├── infrastructure/
│   ├── docker/
│   ├── kubernetes/
│   └── monitoring/
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

## Frontend Structure

### Customer Portal
```
frontend/customer-portal/
├── public/
│   ├── index.html
│   ├── favicon.ico
│   └── manifest.json
├── src/
│   ├── components/
│   │   ├── common/
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── SearchBar.tsx
│   │   │   └── LoadingSpinner.tsx
│   │   ├── medicine/
│   │   │   ├── MedicineCard.tsx
│   │   │   ├── MedicineDetails.tsx
│   │   │   └── MedicineSearch.tsx
│   │   ├── order/
│   │   │   ├── Cart.tsx
│   │   │   ├── Checkout.tsx
│   │   │   ├── OrderConfirmation.tsx
│   │   │   └── OrderTracking.tsx
│   │   └── auth/
│   │       ├── Login.tsx
│   │       ├── Register.tsx
│   │       └── Profile.tsx
│   ├── pages/
│   │   ├── HomePage.tsx
│   │   ├── SearchPage.tsx
│   │   ├── OrderPage.tsx
│   │   └── ProfilePage.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useCart.ts
│   │   ├── useOrders.ts
│   │   └── useMedicines.ts
│   ├── services/
│   │   ├── api.ts
│   │   ├── auth.ts
│   │   ├── graphql/
│   │   │   ├── queries.ts
│   │   │   ├── mutations.ts
│   │   │   └── subscriptions.ts
│   │   └── websocket.ts
│   ├── store/
│   │   ├── index.ts
│   │   ├── authSlice.ts
│   │   ├── cartSlice.ts
│   │   └── orderSlice.ts
│   ├── types/
│   │   ├── auth.ts
│   │   ├── medicine.ts
│   │   ├── order.ts
│   │   └── common.ts
│   ├── utils/
│   │   ├── constants.ts
│   │   ├── helpers.ts
│   │   └── validation.ts
│   ├── styles/
│   │   ├── globals.css
│   │   ├── components.css
│   │   └── themes.css
│   ├── App.tsx
│   ├── index.tsx
│   └── setupTests.ts
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── vite.config.ts
```

### Pharmacy Portal
```
frontend/pharmacy-portal/
├── src/
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── StatisticsCard.tsx
│   │   │   ├── SalesChart.tsx
│   │   │   ├── StockAlert.tsx
│   │   │   └── RecentOrders.tsx
│   │   ├── inventory/
│   │   │   ├── InventoryTable.tsx
│   │   │   ├── StockForm.tsx
│   │   │   ├── BatchTracker.tsx
│   │   │   └── ExpiryMonitor.tsx
│   │   ├── procurement/
│   │   │   ├── ReorderSuggestions.tsx
│   │   │   ├── distributorSelection.tsx
│   │   │   ├── PurchaseOrder.tsx
│   │   │   └── AutoReorderSettings.tsx
│   │   ├── icn/
│   │   │   ├── ExchangeBoard.tsx
│   │   │   ├── PostExchange.tsx
│   │   │   ├── RequestMedicine.tsx
│   │   │   └── ExchangeHistory.tsx
│   │   └── orders/
│   │       ├── OrderList.tsx
│   │       ├── OrderDetails.tsx
│   │       └── OrderStatus.tsx
│   ├── pages/
│   │   ├── DashboardPage.tsx
│   │   ├── InventoryPage.tsx
│   │   ├── ProcurementPage.tsx
│   │   ├── ICNPage.tsx
│   │   └── OrdersPage.tsx
│   └── [similar structure as customer portal]
```

### distributor Portal
```
frontend/distributor-portal/
├── src/
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── OrderMetrics.tsx
│   │   │   ├── RevenueChart.tsx
│   │   │   └── PerformanceKPIs.tsx
│   │   ├── orders/
│   │   │   ├── OrderQueue.tsx
│   │   │   ├── OrderDetails.tsx
│   │   │   ├── FulfillmentForm.tsx
│   │   │   └── ShippingLabel.tsx
│   │   ├── inventory/
│   │   │   ├── CatalogManager.tsx
│   │   │   ├── PriceUpdater.tsx
│   │   │   ├── StockLevels.tsx
│   │   │   └── InvoiceUpload.tsx
│   │   └── analytics/
│   │       ├── SalesAnalytics.tsx
│   │       ├── CustomerInsights.tsx
│   │       └── InventoryReports.tsx
│   └── [similar structure as other portals]
```

### Admin Portal
```
frontend/admin-portal/
├── src/
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── SystemOverview.tsx
│   │   │   ├── AlertsPanel.tsx
│   │   │   └── PerformanceMetrics.tsx
│   │   ├── tracking/
│   │   │   ├── OrderTracker.tsx
│   │   │   ├── LogisticsMap.tsx
│   │   │   ├── HubStatus.tsx
│   │   │   └── DeliveryRoutes.tsx
│   │   ├── users/
│   │   │   ├── UserManagement.tsx
│   │   │   ├── RolePermissions.tsx
│   │   │   └── distributorVerification.tsx
│   │   ├── system/
│   │   │   ├── ErrorLogs.tsx
│   │   │   ├── SystemHealth.tsx
│   │   │   ├── ConfigManager.tsx
│   │   │   └── MaintenanceMode.tsx
│   │   └── analytics/
│   │       ├── BusinessMetrics.tsx
│   │       ├── UserAnalytics.tsx
│   │       └── SystemReports.tsx
│   └── [similar structure as other portals]
```

### Shared Frontend Components
```
frontend/shared/
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Modal.tsx
│   │   ├── Table.tsx
│   │   ├── Chart.tsx
│   │   └── DatePicker.tsx
│   ├── forms/
│   │   ├── FormField.tsx
│   │   ├── Validation.tsx
│   │   └── FormBuilder.tsx
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Navbar.tsx
│   │   ├── Breadcrumb.tsx
│   │   └── PageLayout.tsx
│   └── notifications/
│       ├── Toast.tsx
│       ├── Alert.tsx
│       └── NotificationCenter.tsx
├── hooks/
│   ├── useApi.ts
│   ├── useWebSocket.ts
│   ├── useLocalStorage.ts
│   └── useDebounce.ts
├── utils/
│   ├── api.ts
│   ├── auth.ts
│   ├── formatting.ts
│   ├── validation.ts
│   └── constants.ts
├── types/
│   ├── api.ts
│   ├── user.ts
│   ├── medicine.ts
│   ├── order.ts
│   └── common.ts
└── styles/
    ├── globals.css
    ├── variables.css
    └── components.css
```

## Backend Structure

### API Gateway
```
backend/api-gateway/
├── src/
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── rateLimiter.ts
│   │   ├── cors.ts
│   │   ├── validation.ts
│   │   └── logging.ts
│   ├── routes/
│   │   ├── graphql.ts
│   │   ├── health.ts
│   │   ├── upload.ts
│   │   └── webhook.ts
│   ├── schema/
│   │   ├── typeDefs.ts
│   │   ├── resolvers.ts
│   │   └── directives.ts
│   ├── services/
│   │   ├── authService.ts
│   │   ├── serviceRegistry.ts
│   │   └── loadBalancer.ts
│   ├── utils/
│   │   ├── logger.ts
│   │   ├── errors.ts
│   │   └── metrics.ts
│   ├── config/
│   │   ├── database.ts
│   │   ├── redis.ts
│   │   └── services.ts
│   ├── app.ts
│   └── server.ts
├── package.json
├── tsconfig.json
├── Dockerfile
└── .env.example
```

### Microservices
```
backend/services/
├── user-service/
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── userController.ts
│   │   │   ├── authController.ts
│   │   │   └── profileController.ts
│   │   ├── models/
│   │   │   ├── User.ts
│   │   │   ├── Profile.ts
│   │   │   └── Permission.ts
│   │   ├── services/
│   │   │   ├── userService.ts
│   │   │   ├── authService.ts
│   │   │   └── emailService.ts
│   │   ├── routes/
│   │   │   ├── users.ts
│   │   │   ├── auth.ts
│   │   │   └── profile.ts
│   │   ├── middleware/
│   │   │   ├── validation.ts
│   │   │   └── authorization.ts
│   │   ├── utils/
│   │   │   ├── encryption.ts
│   │   │   ├── jwt.ts
│   │   │   └── validation.ts
│   │   └── app.ts
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example
├── inventory-service/
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── medicineController.ts
│   │   │   ├── stockController.ts
│   │   │   └── batchController.ts
│   │   ├── models/
│   │   │   ├── Medicine.ts
│   │   │   ├── Stock.ts
│   │   │   └── Batch.ts
│   │   ├── services/
│   │   │   ├── inventoryService.ts
│   │   │   ├── searchService.ts
│   │   │   └── alertService.ts
│   │   └── [similar structure]
├── order-service/
├── distributor-service/
├── notification-service/
├── tracking-service/
├── icn-service/
└── payment-service/
```

### Shared Backend Components
```
backend/shared/
├── database/
│   ├── connection.ts
│   ├── migrations/
│   ├── seeds/
│   └── models/
│       ├── BaseModel.ts
│       └── index.ts
├── middleware/
│   ├── errorHandler.ts
│   ├── logger.ts
│   ├── validation.ts
│   └── security.ts
├── utils/
│   ├── logger.ts
│   ├── encryption.ts
│   ├── validation.ts
│   ├── email.ts
│   └── sms.ts
├── types/
│   ├── common.ts
│   ├── api.ts
│   └── database.ts
└── config/
    ├── database.ts
    ├── redis.ts
    ├── rabbitmq.ts
    └── environment.ts
```

## AI Services Structure

```
ai-services/
├── demand-forecasting/
│   ├── src/
│   │   ├── models/
│   │   │   ├── arima_model.py
│   │   │   ├── lstm_model.py
│   │   │   └── ensemble_model.py
│   │   ├── services/
│   │   │   ├── forecast_service.py
│   │   │   ├── data_processor.py
│   │   │   └── model_trainer.py
│   │   ├── api/
│   │   │   ├── routes.py
│   │   │   └── schemas.py
│   │   ├── utils/
│   │   │   ├── data_utils.py
│   │   │   └── model_utils.py
│   │   └── app.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── model_artifacts/
├── invoice-processing/
│   ├── src/
│   │   ├── ocr/
│   │   │   ├── text_extractor.py
│   │   │   └── image_processor.py
│   │   ├── nlp/
│   │   │   ├── field_extractor.py
│   │   │   ├── entity_recognizer.py
│   │   │   └── data_validator.py
│   │   ├── services/
│   │   │   ├── invoice_service.py
│   │   │   └── processing_service.py
│   │   ├── api/
│   │   │   ├── routes.py
│   │   │   └── schemas.py
│   │   └── app.py
│   ├── requirements.txt
│   └── Dockerfile
└── analytics-engine/
    ├── src/
    │   ├── analyzers/
    │   │   ├── sales_analyzer.py
    │   │   ├── trend_analyzer.py
    │   │   └── anomaly_detector.py
    │   ├── services/
    │   │   ├── analytics_service.py
    │   │   └── report_generator.py
    │   ├── api/
    │   │   ├── routes.py
    │   │   └── schemas.py
    │   └── app.py
    ├── requirements.txt
    └── Dockerfile
```

## Infrastructure & DevOps

```
infrastructure/
├── docker/
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   ├── nginx/
│   │   ├── nginx.conf
│   │   └── ssl/
│   └── monitoring/
│       ├── prometheus.yml
│       └── grafana/
├── kubernetes/
│   ├── namespaces/
│   ├── deployments/
│   ├── services/
│   ├── ingress/
│   ├── configmaps/
│   └── secrets/
└── monitoring/
    ├── prometheus/
    ├── grafana/
    ├── elasticsearch/
    └── kibana/
```

## Testing Structure

```
tests/
├── unit/
│   ├── frontend/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── utils/
│   ├── backend/
│   │   ├── services/
│   │   ├── controllers/
│   │   └── utils/
│   └── ai-services/
│       ├── models/
│       └── services/
├── integration/
│   ├── api/
│   ├── database/
│   └── services/
├── e2e/
│   ├── customer-portal/
│   ├── pharmacy-portal/
│   ├── distributor-portal/
│   └── admin-portal/
└── performance/
    ├── load-tests/
    └── stress-tests/
```

## Documentation Structure

```
docs/
├── api/
│   ├── graphql-schema.md
│   ├── rest-endpoints.md
│   ├── authentication.md
│   └── rate-limiting.md
├── deployment/
│   ├── docker-setup.md
│   ├── kubernetes-setup.md
│   ├── environment-variables.md
│   └── monitoring-setup.md
├── design/
│   ├── system-architecture.md
│   ├── database-schema.md
│   ├── ui-wireframes/
│   └── api-specifications/
├── development/
│   ├── setup-guide.md
│   ├── coding-standards.md
│   ├── testing-guide.md
│   └── contribution-guide.md
└── user-guides/
    ├── customer-guide.md
    ├── pharmacy-guide.md
    ├── distributor-guide.md
    └── admin-guide.md
```

This file structure provides a comprehensive organization for the Medical Supply Chain Website project, ensuring clear separation of concerns, maintainability, and scalability across all components of the system.