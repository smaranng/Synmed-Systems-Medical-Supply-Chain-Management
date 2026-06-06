#!/bin/bash

# Start all services in development mode

echo "🚀 Starting Medical Supply Chain Platform..."
echo ""

# Start Docker services
echo "📦 Starting infrastructure services..."
docker-compose up -d mongodb redis rabbitmq

echo "⏳ Waiting for services to initialize..."
sleep 5

# Start backend services in background
echo "🔧 Starting backend services..."

cd backend/api-gateway && npm run dev &
cd backend/services/user-service && npm run dev &
cd backend/services/inventory-service && npm run dev &
cd backend/services/order-service && npm run dev &
cd backend/services/distributor-service && npm run dev &

# Start AI services (if Python is installed)
if command -v python3 &> /dev/null; then
    echo "🤖 Starting AI services..."
    cd ai-services/demand-forecasting && python3 src/app.py &
    cd ai-services/invoice-processing && python3 src/app.py &
    cd ai-services/analytics-engine && python3 src/app.py &
fi

sleep 5

# Start frontend services
echo "🎨 Starting frontend portals..."

cd frontend/customer-portal && npm run dev &
cd frontend/pharmacy-portal && npm run dev &
cd frontend/distributor-portal && npm run dev &
cd frontend/admin-portal && npm run dev &

echo ""
echo "✅ All services started!"
echo ""
echo "🌐 Access the portals:"
echo "  - Customer Portal: http://localhost:3000"
echo "  - Pharmacy Portal: http://localhost:3001"
echo "  - distributor Portal: http://localhost:3002"
echo "  - Admin Portal: http://localhost:3003"
echo "  - GraphQL API: http://localhost:4000/graphql"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for all background processes
wait
