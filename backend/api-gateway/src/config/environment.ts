import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.GATEWAY_PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    userDb: process.env.MONGODB_USER_DB || 'user_db',
    inventoryDb: process.env.MONGODB_INVENTORY_DB || 'inventory_db',
    orderDb: process.env.MONGODB_ORDER_DB || 'order_db',
    distributorDb: process.env.MONGODB_distributor_DB || 'distributor_db',
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiry: process.env.JWT_EXPIRY || '24h',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },
  
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  
  services: {
    userService: process.env.USER_SERVICE_URL || 'http://localhost:5203',
    inventoryService: process.env.INVENTORY_SERVICE_URL || 'http://localhost:5201',
    orderService: process.env.ORDER_SERVICE_URL || 'http://localhost:5202',
    distributorService: process.env.distributor_SERVICE_URL || 'http://localhost:4004',
  },
};
