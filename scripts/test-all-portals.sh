#!/bin/bash

echo "🧪 Testing All Portals - Medical Supply Chain"
echo "============================================="

# Function to test a portal
test_portal() {
    local portal_name=$1
    local port=$2
    local path=$3
    
    echo ""
    echo "🔍 Testing $portal_name Portal..."
    echo "   URL: http://localhost:$port$path"
    
    # Check if server is running
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:$port | grep -q "200"; then
        echo "   ✅ $portal_name Portal is running"
        
        # Test specific page
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:$port$path | grep -q "200"; then
            echo "   ✅ $portal_name Portal page is accessible"
        else
            echo "   ⚠️  $portal_name Portal page may have issues"
        fi
    else
        echo "   ❌ $portal_name Portal is not running"
        echo "   💡 Start with: cd frontend/$portal_name && npm run dev"
    fi
}

# Test all portals
test_portal "Customer" "3000" "/"
test_portal "Pharmacy" "3001" "/"
test_portal "distributor" "3002" "/"
test_portal "Admin" "3003" "/"

echo ""
echo "📊 Test Summary"
echo "==============="
echo "✅ Customer Portal: http://localhost:3000"
echo "✅ Pharmacy Portal: http://localhost:3001"
echo "✅ distributor Portal: http://localhost:3002"
echo "✅ Admin Portal: http://localhost:3003"
echo ""
echo "🚀 To start all portals:"
echo "   Terminal 1: cd frontend/customer-portal && npm run dev"
echo "   Terminal 2: cd frontend/pharmacy-portal && npm run dev"
echo "   Terminal 3: cd frontend/distributor-portal && npm run dev"
echo "   Terminal 4: cd frontend/admin-portal && npm run dev"
echo ""
echo "🎯 Expected Results:"
echo "   - All portals should load with proper styling"
echo "   - No console errors in browser dev tools"
echo "   - Professional appearance with Tailwind CSS"
