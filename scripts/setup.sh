#!/bin/bash

# Medical Supply Chain - Setup Script
# This script initializes the development environment

echo "🏥 Medical Supply Chain - Setup Script"
echo "======================================"
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js >= 18.0.0"
    exit 1
fi
echo "✅ Node.js $(node -v)"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed"
    exit 1
fi
echo "✅ npm $(npm -v)"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed"
    exit 1
fi
echo "✅ Docker $(docker -v | cut -d' ' -f3 | tr -d ',')"

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed"
    exit 1
fi
echo "✅ Docker Compose $(docker-compose -v | cut -d' ' -f4 | tr -d ',')"

echo ""
echo "📦 Installing dependencies..."

# Run the simple install script
./scripts/simple-install.sh

echo ""
echo "🐳 Setting up Docker environment..."

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "→ Creating .env file..."
    cp .env.example .env
    echo "✅ .env file created. Please update with your configuration."
fi

# Start Docker services
echo "→ Starting Docker containers..."
docker-compose up -d mongodb redis rabbitmq

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

echo ""
echo "✅ Setup completed successfully!"
echo ""
echo "📚 Next steps:"
echo "  1. Review and update .env file with your configuration"
echo "  2. Start all services: npm run dev"
echo "  3. Or start individual services:"
echo "     - Customer Portal: npm run dev:customer"
echo "     - Pharmacy Portal: npm run dev:pharmacy"
echo "     - distributor Portal: npm run dev:distributor"
echo "     - Admin Portal: npm run dev:admin"
echo "     - API Gateway: npm run dev:gateway"
echo ""
echo "🌐 Access URLs:"
echo "  - Customer Portal: http://localhost:3000"
echo "  - Pharmacy Portal: http://localhost:3001"
echo "  - distributor Portal: http://localhost:3002"
echo "  - Admin Portal: http://localhost:3003"
echo "  - API Gateway: http://localhost:4000/graphql"
echo ""
echo "📖 For more information, see GETTING_STARTED.md"
echo ""
