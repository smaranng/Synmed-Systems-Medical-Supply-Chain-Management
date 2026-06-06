# 🚀 Quick Start Guide

## Get Running in 3 Minutes

### Step 1: Setup (One Command)
```bash
./scripts/setup.sh
```
This installs all dependencies for all services.

### Step 2: Start Infrastructure
```bash
docker-compose up -d mongodb redis rabbitmq
```
Wait ~10 seconds for services to initialize.

### Step 3: Choose Your Start Method

#### Option A: Start Everything
```bash
./scripts/start-all.sh
```

#### Option B: Start Individual Services
```bash
# Terminal 1 - API Gateway
cd backend/api-gateway && npm run dev

# Terminal 2 - Customer Portal
cd frontend/customer-portal && npm run dev

# Terminal 3 - Pharmacy Portal
cd frontend/pharmacy-portal && npm run dev

# Terminal 4 - distributor Portal  
cd frontend/distributor-portal && npm run dev

# Terminal 5 - Admin Portal
cd frontend/admin-portal && npm run dev
```

---

## 🌐 Access the Platform

| Portal | URL | Login |
|--------|-----|-------|
| **Customer** | http://localhost:3000 | customer@example.com |
| **Pharmacy** | http://localhost:3001 | pharmacy@example.com |
| **distributor** | http://localhost:3002 | distributor@example.com |
| **Admin** | http://localhost:3003 | admin@example.com |
| **GraphQL API** | http://localhost:4000/graphql | N/A |

**Password for all**: `password123`

---

## ✅ What You Get

### Customer Portal (Port 3000)
- 🏠 Beautiful landing page
- 🔍 Medicine search
- 🛒 Shopping cart
- 📦 Order tracking
- 👤 User profile

### Pharmacy Portal (Port 3001)
- 📊 Dashboard with charts
- 📦 Inventory management
- 🤖 AI reorder suggestions
- 🔄 ICN exchange
- 📋 Order processing

### distributor Portal (Port 3002)
- 📦 Order management
- 🚚 Shipment tracking
- 📄 Invoice processing
- 📊 Analytics

### Admin Portal (Port 3003)
- 🖥️ System monitoring
- 👥 User management
- ⚠️ Alert dashboard
- 📈 Activity feed

---

## 🐳 Docker Services

View running services:
```bash
docker ps
```

View logs:
```bash
docker-compose logs -f
```

Stop all:
```bash
docker-compose down
```

---

## 📂 Project Structure

```
medical-supply-chain/
├── frontend/        # 4 React applications
├── backend/         # API Gateway + 4 microservices
├── ai-services/     # 3 Python AI services
├── infrastructure/  # Monitoring configs
├── scripts/         # Automation scripts
└── design/          # Your design documents
```

---

## 🔧 Development

### Frontend Development
```bash
cd frontend/[portal-name]
npm run dev         # Start dev server
npm run build       # Production build
npm run lint        # Check code quality
```

### Backend Development
```bash
cd backend/[service-name]
npm run dev         # Start with hot reload
npm run build       # Compile TypeScript
npm start           # Run compiled code
```

### AI Services
```bash
cd ai-services/[service-name]
pip install -r requirements.txt
python src/app.py
```

---

## 🧪 Testing

Structure is ready for:
- Unit tests (Jest)
- Integration tests
- E2E tests (Playwright/Cypress)

---

## 📚 Documentation

- **README.md** - Full project overview
- **GETTING_STARTED.md** - Detailed setup guide
- **PROJECT_COMPLETE.md** - Complete implementation details
- **IMPLEMENTATION_SUMMARY.md** - What was built
- **This file** - Quick reference

---

## 🆘 Troubleshooting

### Port Already in Use
```bash
# Find and kill process
lsof -ti:3000 | xargs kill -9  # Replace 3000 with your port
```

### MongoDB Connection Issues
```bash
# Restart MongoDB
docker-compose restart mongodb

# View logs
docker-compose logs mongodb
```

### Clean Start
```bash
# Stop all services
docker-compose down -v

# Clean install
rm -rf node_modules
npm install

# Restart
docker-compose up -d
```

---

## 🎯 What's Included

✅ 4 Frontend Applications (React + TypeScript)  
✅ 5 Backend Services (Node.js + Express)  
✅ 3 AI Services (Python + FastAPI)  
✅ GraphQL API Gateway  
✅ MongoDB + Redis + RabbitMQ  
✅ Monitoring (Prometheus + Grafana)  
✅ Docker Configuration  
✅ Sample Data & Test Users  
✅ Complete Documentation  

---

## 💡 Quick Tips

1. **First Time?** Run `./scripts/setup.sh` first
2. **Check Services** Use `docker ps` to verify infrastructure
3. **View API** Visit GraphQL Playground at http://localhost:4000/graphql
4. **Sample Data** Already loaded - just log in!
5. **Need Help?** Check GETTING_STARTED.md

---

## 🎊 Ready to Go!

Your complete Medical Supply Chain platform is ready to use.

**Happy Coding!** 🚀

---

*For detailed information, see the comprehensive documentation in this directory.*
