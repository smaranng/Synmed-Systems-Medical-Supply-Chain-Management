# Medical Supply Chain Management System

A comprehensive web-based medical supply chain management platform that connects pharmacies, distributors, and customers to optimize medicine procurement, inventory management, and distribution processes.

## 🏥 Project Overview

This system provides role-based access for four types of users:

- **Customers**: Search medicines, check availability, place orders, and track deliveries
- **Pharmacies**: Manage inventory, view statistics, handle procurement, and participate in Inter-Clinic Network (ICN)
- **distributors**: Process orders, upload invoices, manage catalog, and handle shipments
- **Administrators**: Monitor system operations, track orders, manage users, and resolve errors

## 🚀 Key Features

### Core Features
- Multi-role authentication with secure JWT-based sessions
- Real-time inventory management with stock alerts
- AI-powered demand forecasting for automatic reordering
- AI invoice processing for distributor stock updates
- Real-time order and shipment tracking
- Inter-Clinic Network for pharmacy-to-pharmacy medicine exchange

### Technology Stack

**Frontend:**
- React.js with TypeScript
- Tailwind CSS for styling
- Shadcn-ui component library
- Vite for build tooling
- Redux Toolkit for state management
- React Query for API caching
- Recharts for data visualization

**Backend:**
- Node.js with Express.js
- GraphQL API Gateway
- Microservices architecture
- MongoDB distributed databases
- Redis for caching
- RabbitMQ for message queuing
- JWT authentication

**AI Services:**
- Python with FastAPI
- TensorFlow/PyTorch for ML models
- OCR for invoice processing
- Time series forecasting

**Infrastructure:**
- Docker & Docker Compose
- Kubernetes (production)
- Nginx reverse proxy
- Prometheus & Grafana monitoring

## 📁 Project Structure

```
medical-supply-chain/
├── frontend/
│   ├── customer-portal/       # Customer-facing website
│   ├── pharmacy-portal/       # Pharmacy management dashboard
│   ├── distributor-portal/         # distributor order management
│   ├── admin-portal/          # Admin control panel
│   └── shared/                # Shared components and utilities
├── backend/
│   ├── api-gateway/           # GraphQL API Gateway
│   ├── services/              # Microservices
│   │   ├── user-service/
│   │   ├── inventory-service/
│   │   ├── order-service/
│   │   ├── distributor-service/
│   │   ├── notification-service/
│   │   ├── tracking-service/
│   │   ├── icn-service/
│   │   └── payment-service/
│   └── shared/                # Shared backend utilities
├── ai-services/
│   ├── demand-forecasting/    # AI demand prediction
│   ├── invoice-processing/    # AI invoice OCR
│   └── analytics-engine/      # Business analytics
├── infrastructure/
│   ├── docker/
│   ├── kubernetes/
│   └── monitoring/
├── tests/
└── docs/
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0
- Docker & Docker Compose
- MongoDB >= 7.0
- Redis >= 7.0
- Python >= 3.10 (for AI services)

### Quick Start with Docker

1. Clone the repository:
```bash
git clone <repository-url>
cd medical-supply-chain
```

2. Copy environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Start all services with Docker Compose:
```bash
docker-compose up -d
```

4. Access the portals:
- Customer Portal: http://localhost:3000
- Pharmacy Portal: http://localhost:3001
- distributor Portal: http://localhost:3002
- Admin Portal: http://localhost:3003
- API Gateway: http://localhost:4000/graphql

### Local Development Setup

1. Install dependencies:
```bash
npm install
```

2. Install frontend dependencies:
```bash
cd frontend/customer-portal && npm install
cd ../pharmacy-portal && npm install
cd ../distributor-portal && npm install
cd ../admin-portal && npm install
cd ../shared && npm install
```

3. Install backend dependencies:
```bash
cd backend/api-gateway && npm install
cd ../services/user-service && npm install
# Repeat for other services
```

4. Start MongoDB, Redis, and RabbitMQ:
```bash
docker-compose up -d mongodb redis rabbitmq
```

5. Run all services in development mode:
```bash
npm run dev
```

Or run individual services:
```bash
npm run dev:customer    # Customer portal
npm run dev:pharmacy    # Pharmacy portal
npm run dev:distributor      # distributor portal
npm run dev:admin       # Admin portal
npm run dev:gateway     # API Gateway
```

## 🧪 Testing

Run all tests:
```bash
npm test
```

Run frontend tests:
```bash
npm run test:frontend
```

Run backend tests:
```bash
npm run test:backend
```

## 📝 API Documentation

GraphQL Playground is available at: http://localhost:4000/graphql

API documentation can be found in the `/docs/api` directory.

## 🎨 UI/UX Design

### Color Scheme
- **Primary**: Dark Navy Blue (#0A1D37) - Professional and trustworthy
- **Accent**: Light Blue (#4BA3C3) - Modern and approachable
- **Success**: Medical Green (#3BB273) - Health and reliability
- **Background**: Soft White (#F9FAFB) - Clean and minimal
- **Text**: Grey Neutral (#6B7280)
- **Error**: Alert Red (#E63946)

### Design Principles
- Mobile-first responsive design
- Accessibility compliant (WCAG 2.1 AA)
- Intuitive navigation (max 3-level depth)
- Real-time updates and notifications
- Clear visual hierarchy

## 🔒 Security

- JWT-based authentication with refresh tokens
- Role-based access control (RBAC)
- Input validation and sanitization
- Rate limiting on API endpoints
- Encrypted data transmission (HTTPS)
- Password hashing with bcrypt
- PII data encryption
- Comprehensive audit logging
- GDPR compliant

## 📊 Database Schema

The system uses MongoDB with distributed databases:
- **user_db**: User accounts and authentication
- **inventory_db**: Medicines, stock, and batches
- **order_db**: Orders and order items
- **distributor_db**: distributor catalogs and information
- **tracking_db**: Shipments and tracking data
- **analytics_db**: Analytics and forecasting data

See `/docs/design/database-schema.md` for detailed schema documentation.

## 🚀 Deployment

### Production Build

```bash
npm run build
```

### Docker Production Build

```bash
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
```

### Kubernetes Deployment

```bash
kubectl apply -f infrastructure/kubernetes/
```

## 📈 Monitoring

- **Prometheus**: Metrics collection
- **Grafana**: Visualization dashboards
- **ELK Stack**: Centralized logging
- **Sentry**: Error tracking
- **New Relic**: APM monitoring

Access Grafana dashboard: http://localhost:3004 (when using Docker)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👥 Team

- Backend Development Team
- Frontend Development Team
- AI/ML Team
- DevOps Team
- QA Team

## 📞 Support

For support, email support@medicalsupplychain.com or join our Slack channel.

## 🗺️ Roadmap

### Phase 1: Core Platform (Months 1-3) ✅
- User authentication and role management
- Basic pharmacy and distributor portals
- Core inventory management features
- Customer medicine search and ordering

### Phase 2: Advanced Features (Months 4-6)
- AI integration for demand forecasting
- Advanced tracking and logistics
- Inter-Clinic Network implementation
- Admin control panel enhancements

### Phase 3: Optimization & Scale (Months 7-9)
- Performance optimization
- Advanced analytics and reporting
- Mobile application development
- Third-party integrations

### Phase 4: Enhancement (Months 10-12)
- Kiosk integration
- Advanced AI features
- Additional compliance features
- System optimization and scaling

## 🎯 Success Metrics

- User Adoption: 80% of target pharmacies onboarded within 6 months
- Order Processing: 50% reduction in processing time
- Inventory Accuracy: 95% accuracy across all pharmacies
- Customer Satisfaction: 4.5+ star rating
- System Uptime: 99.9% availability
- Cost Reduction: 30% operational cost reduction

---

Made with ❤️ for better healthcare supply chain management