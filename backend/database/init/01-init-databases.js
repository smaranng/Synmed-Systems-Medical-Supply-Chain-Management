// MongoDB initialization script
// This script runs when MongoDB container starts for the first time

// Create databases
db = db.getSiblingDB('user_db');
db.createCollection('users');
db.createCollection('addresses');
db.users.createIndex({ "email": 1 }, { unique: true });

db = db.getSiblingDB('inventory_db');
db.createCollection('medicines');
db.createCollection('inventory');
db.medicines.createIndex({ "name": 1 });
db.inventory.createIndex({ "pharmacyId": 1, "medicineId": 1 });

db = db.getSiblingDB('order_db');
db.createCollection('orders');
db.createCollection('order_items');
db.orders.createIndex({ "orderNumber": 1 }, { unique: true });
db.orders.createIndex({ "customerId": 1 });
db.orders.createIndex({ "pharmacyId": 1 });

db = db.getSiblingDB('distributor_db');
db.createCollection('distributors');
db.createCollection('distributor_catalog');
db.createCollection('invoice_processing_logs');
db.distributors.createIndex({ "licenseNumber": 1 }, { unique: true });

db = db.getSiblingDB('tracking_db');
db.createCollection('shipments');
db.createCollection('tracking_updates');
db.shipments.createIndex({ "orderId": 1 });
db.shipments.createIndex({ "trackingNumber": 1 }, { unique: true });

db = db.getSiblingDB('analytics_db');
db.createCollection('demand_forecasts');
db.createCollection('business_metrics');

print('✅ All databases initialized successfully');
