#!/bin/bash

echo "🔧 Installing Medical Supply Chain Dependencies"
echo "=============================================="

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install shared library first
echo "📚 Installing shared library..."
cd frontend/shared
npm install
cd ../..

# Install frontend portals
echo "🎨 Installing Customer Portal..."
cd frontend/customer-portal
npm install
cd ../..

echo "🏥 Installing Pharmacy Portal..."
cd frontend/pharmacy-portal
npm install
cd ../..

echo "📦 Installing distributor Portal..."
cd frontend/distributor-portal
npm install
cd ../..

echo "👨‍💼 Installing Admin Portal..."
cd frontend/admin-portal
npm install
cd ../..

# Install backend services
echo "⚙️ Installing API Gateway..."
cd backend/api-gateway
npm install
cd ../..

echo "👤 Installing User Service..."
cd backend/services/user-service
npm install
cd ../../..

echo "📦 Installing Inventory Service..."
cd backend/services/inventory-service
npm install
cd ../../..

echo "📋 Installing Order Service..."
cd backend/services/order-service
npm install
cd ../../..

echo "🏢 Installing distributor Service..."
cd backend/services/distributor-service
npm install
cd ../../..

echo ""
echo "✅ All dependencies installed successfully!"
echo ""
echo "🚀 Next steps:"
echo "  1. Start infrastructure: docker-compose up -d mongodb redis rabbitmq"
echo "  2. Start services: ./scripts/start-all.sh"
echo "  3. Or start individual services: npm run dev:customer"
