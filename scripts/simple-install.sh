#!/bin/bash

echo "🔧 Simple Installation - Medical Supply Chain"
echo "============================================="

# Install root dependencies (skip workspaces)
echo "📦 Installing root dependencies..."
npm install --ignore-workspace-root-check

# Install each service individually
echo ""
echo "🎨 Installing Customer Portal..."
cd frontend/customer-portal
# Remove the shared dependency temporarily
npm pkg delete dependencies.medical-supply-shared
npm install
cd ../..

echo "🏥 Installing Pharmacy Portal..."
cd frontend/pharmacy-portal
npm pkg delete dependencies.medical-supply-shared
npm install
cd ../..

echo "📦 Installing distributor Portal..."
cd frontend/distributor-portal
npm pkg delete dependencies.medical-supply-shared
npm install
cd ../..

echo "👨‍💼 Installing Admin Portal..."
cd frontend/admin-portal
npm pkg delete dependencies.medical-supply-shared
npm install
cd ../..

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
echo "✅ Installation completed!"
echo ""
echo "🚀 Next steps:"
echo "  1. Start infrastructure: docker-compose up -d mongodb redis rabbitmq"
echo "  2. Start individual services:"
echo "     - Customer Portal: cd frontend/customer-portal && npm run dev"
echo "     - Pharmacy Portal: cd frontend/pharmacy-portal && npm run dev"
echo "     - API Gateway: cd backend/api-gateway && npm run dev"
echo ""
echo "🌐 Access URLs:"
echo "  - Customer Portal: http://localhost:3000"
echo "  - Pharmacy Portal: http://localhost:3001"
echo "  - distributor Portal: http://localhost:3002"
echo "  - Admin Portal: http://localhost:3003"
echo "  - API Gateway: http://localhost:4000/graphql"
