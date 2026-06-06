import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import jwt from 'jsonwebtoken';
import { MongoClient, ObjectId } from 'mongodb';
import { createClient } from 'redis';

dotenv.config();

type OrderStatus =
  | 'PLACED'
  | 'APPROVED'
  | 'READY_FOR_PICKUP'
  | 'COMPLETED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED';

type OrderItem = {
  itemId: string;
  type: 'medicines' | 'emergency' | 'general';
  name: string;
  price: number;
  quantity: number;
  pharmacyId: string;
  prescriptionPath?: string;
  isPrescriptionRequired?: boolean;
};

const app = express();
const PORT = process.env.PORT || 4003;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
// const RESERVATION_TTL_SECONDS = 8 * 60 * 60; // 8 hours - production
const PHARMACY_ACTION_TIMEOUT_SECONDS =  10; // 2 minutes for pharmacy to take action on PLACED order - FOR TESTING ONLY (production: 30 * 60)
const CUSTOMER_PICKUP_TIMEOUT_SECONDS =  10; // 5 minutes for customer to pick up APPROVED order - FOR TESTING ONLY (production: 30 * 60)
const RESERVATION_TTL_SECONDS =  10; // 5 minutes for Redis reservation - FOR TESTING ONLY (production: 8 * 60 * 60)
const ORDER_COLLECTION = 'customer_to_pharma_orders';

app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003'
  ],
  credentials: true,
}));
app.use(express.json());

let orderDb: any;
let inventoryDb: any;
const redisClient = createClient({ url: REDIS_URL });

redisClient.on('error', (err) => console.error('Redis error:', err));

const verifyToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    (req as any).userId = decoded.userId;
    (req as any).role = decoded.role;
    next();
  } catch (err: any) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

function getCollectionName(type: string): string {
  if (type === 'medicines') return 'inventory';
  if (type === 'emergency') return 'emergency';
  if (type === 'general') return 'general';
  throw new Error('Invalid inventory type');
}

function buildOrderNumber() {
  return `ORD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

async function connectDB() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  orderDb = client.db('order_db');
  inventoryDb = client.db('inventory_pharma');
  console.log('✅ Order Service: MongoDB connected');
}

async function connectRedis() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
    console.log('✅ Order Service: Redis connected');
  }
}

async function reserveStock(orderId: string, pharmacyId: string, items: OrderItem[]) {
  const operations = items.map((item) => {
    const key = `stock_reservation:${orderId}:${item.itemId}`;
    const payload = JSON.stringify({ pharmacyId, type: item.type, quantity: item.quantity });
    return redisClient.set(key, payload, { EX: RESERVATION_TTL_SECONDS });
  });
  await Promise.all(operations);
}

async function releaseReservation(orderId: string) {
  const keys: string[] = [];
  for await (const key of redisClient.scanIterator({ MATCH: `stock_reservation:${orderId}:*` })) {
    keys.push(key as string);
  }
  if (keys.length) {
    await redisClient.del(keys);
  }
}

async function decrementStock(order: any) {
  for (const item of order.items as OrderItem[]) {
    if (!ObjectId.isValid(item.itemId)) {
      throw new Error('Invalid inventory item id');
    }

    const collection = getCollectionName(item.type);
    const itemObjectId = new ObjectId(item.itemId);
    const inventoryItem = await inventoryDb.collection(collection).findOne({
      _id: itemObjectId,
      pharmacyId: order.pharmacyId,
    });

    if (!inventoryItem) {
      throw new Error('Item not found');
    }

    const currentStock = Number(inventoryItem.stock || 0);
    const quantity = Number(item.quantity || 0);

    if (quantity <= 0) {
      continue;
    }

    if (currentStock < quantity) {
      throw new Error('Item not found or insufficient stock');
    }

    const newBalance = currentStock - quantity;
    const now = new Date();
    const stockOutEntry = {
      stockUpdated: quantity,
      date: now,
      status: 'stock_out',
      balance: newBalance,
    };

    const update: any = {
      $inc: { stock: -quantity },
      $set: {
        updatedAt: now,
        lastUpdated: now,
        availabilityStatus: newBalance > 0 ? 'AVAILABLE' : 'OUT_OF_STOCK',
      },
      $push: { stockDetails: stockOutEntry },
    };

    // Keep totalUnits in sync for medicines collection if present
    if (inventoryItem.totalUnits !== undefined) {
      update.$set.totalUnits = newBalance;
    }

    const result = await inventoryDb.collection(collection).updateOne(
      {
        _id: itemObjectId,
        pharmacyId: order.pharmacyId,
        stock: { $gte: quantity },
      },
      update
    );

    if (result.matchedCount === 0) {
      throw new Error('Item not found or insufficient stock');
    }
  }
}

// Adjust reservedStock and derived availableStock when moving in/out of reservation
async function adjustReservedStock(order: any, direction: 1 | -1) {
  for (const item of order.items as OrderItem[]) {
    if (!ObjectId.isValid(item.itemId)) {
      continue;
    }

    const collection = getCollectionName(item.type);
    const itemObjectId = new ObjectId(item.itemId);
    const inventoryItem = await inventoryDb.collection(collection).findOne({
      _id: itemObjectId,
      pharmacyId: order.pharmacyId,
    });

    if (!inventoryItem) continue;

    const currentStock = Number(inventoryItem.stock || 0);
    const currentReserved = Number(inventoryItem.reservedStock || 0);
    const quantity = Number(item.quantity || 0);
    const newReserved = Math.max(0, currentReserved + direction * quantity);
    const newAvailable = Math.max(0, currentStock - newReserved);

    await inventoryDb.collection(collection).updateOne(
      { _id: itemObjectId, pharmacyId: order.pharmacyId },
      {
        $set: {
          reservedStock: newReserved,
          availableStock: newAvailable,
          lastUpdated: new Date(),
          updatedAt: new Date(),
        },
      }
    );
  }
}

function isTransitionAllowed(current: OrderStatus, next: OrderStatus) {
  if (current === 'EXPIRED' || current === 'COMPLETED' || current === 'REJECTED' || current === 'CANCELLED') return false;
  const allowed: Record<OrderStatus, OrderStatus[]> = {
    PLACED: ['APPROVED', 'REJECTED'],
    APPROVED: ['READY_FOR_PICKUP', 'COMPLETED', 'REJECTED', 'CANCELLED'],
    READY_FOR_PICKUP: ['COMPLETED', 'REJECTED'],
    COMPLETED: [],
    REJECTED: [],
    EXPIRED: [],
    CANCELLED: [],
  };
  return allowed[current]?.includes(next) || false;
}

app.get('/health', (req, res) => {
  res.json({ service: 'order-service', status: 'ok' });
});

// Create orders from cart confirmation
app.post('/orders/confirm', verifyToken, async (req, res) => {
  try {
    const customerId = (req as any).userId;
    const items = req.body.items as OrderItem[];

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items provided' });
    }

    const sanitized = items.filter((item) =>
      item.itemId && item.type && item.name && item.price != null && item.quantity != null && item.pharmacyId
    );

    if (sanitized.length !== items.length) {
      return res.status(400).json({ error: 'Missing required item fields' });
    }

    // Group by pharmacy to create one order per pharmacy
    const grouped: Record<string, OrderItem[]> = sanitized.reduce((acc, item) => {
      if (!acc[item.pharmacyId]) acc[item.pharmacyId] = [];
      acc[item.pharmacyId].push(item);
      return acc;
    }, {} as Record<string, OrderItem[]>);

    const now = Date.now();
    const created: any[] = [];

    for (const [pharmacyId, pharmacyItems] of Object.entries(grouped)) {
      const totalAmount = pharmacyItems.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
      const placedExpiresAt = new Date(now + PHARMACY_ACTION_TIMEOUT_SECONDS * 1000);
      const orderDoc = {
        orderNumber: buildOrderNumber(),
        customerId,
        pharmacyId,
        items: pharmacyItems.map(({ pharmacyId: _, ...rest }) => rest),
        totalAmount,
        status: 'PLACED' as OrderStatus,
        paymentMode: 'PAY_AT_PHARMACY',
        createdAt: new Date(now),
        updatedAt: new Date(now),
        expiresAt: placedExpiresAt,
        placedAt: new Date(now)
      };

      const result = await orderDb.collection(ORDER_COLLECTION).insertOne(orderDoc);
      const orderId = result.insertedId.toString();
      // NOTE: DO NOT reserve stock here. Stock reservation only happens when pharmacy approves (APPROVED status)
      created.push({ 
        _id: orderId, 
        ...orderDoc,
        items: orderDoc.items 
      });
    }

    // Clear cart after successful order creation
    await inventoryDb.collection('carts').deleteOne({ customerId });

    res.status(201).json({ orders: created });
  } catch (error: any) {
    console.error('Order confirm error:', error);
    res.status(500).json({ error: error.message || 'Failed to place order' });
  }
});

// Get orders for a customer (self)
app.get('/orders/customer', verifyToken, async (req, res) => {
  try {
    const customerId = (req as any).userId;
    const orders = await orderDb.collection(ORDER_COLLECTION)
      .find({ customerId })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(orders);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single order by ID with customer & pharmacy details
app.get('/orders/:orderId', verifyToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const requester = (req as any).userId;

    if (!ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'Invalid order id' });
    }

    const order = await orderDb.collection(ORDER_COLLECTION).findOne({ _id: new ObjectId(orderId) });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.customerId !== requester && order.pharmacyId !== requester) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json(order);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get orders assigned to a pharmacy
app.get('/orders/pharmacy/:pharmacyId', verifyToken, async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    const requester = (req as any).userId;
    if (pharmacyId !== requester) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { status } = req.query;
    const query: any = { pharmacyId };
    if (typeof status === 'string') {
      query.status = status;
    }

    const orders = await orderDb.collection(ORDER_COLLECTION)
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();
    res.json(orders);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update order status (pharmacy actions)
app.put('/orders/:orderId/status', verifyToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body as { status?: OrderStatus };
    const requester = (req as any).userId;

    const allowedStatuses: OrderStatus[] = ['APPROVED', 'READY_FOR_PICKUP', 'COMPLETED', 'REJECTED'];
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    if (!ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'Invalid order id' });
    }

    const order = await orderDb.collection(ORDER_COLLECTION).findOne({ _id: new ObjectId(orderId) });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.pharmacyId !== requester) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!isTransitionAllowed(order.status, status)) {
      return res.status(400).json({ error: `Cannot transition from ${order.status} to ${status}` });
    }

    // When transitioning to APPROVED, reserve stock (Redis + DB) and set new expiry for customer pickup
    if (status === 'APPROVED') {
      await reserveStock(orderId, order.pharmacyId, order.items);
      await adjustReservedStock(order, 1);
      const approveTime = Date.now();
      const pickupExpiresAt = new Date(approveTime + CUSTOMER_PICKUP_TIMEOUT_SECONDS * 1000);
      await orderDb.collection(ORDER_COLLECTION).updateOne(
        { _id: new ObjectId(orderId) },
        { 
          $set: { 
            approvedAt: new Date(approveTime),
            expiresAt: pickupExpiresAt
          } 
        }
      );
    }

    if (status === 'COMPLETED') {
      await decrementStock(order);
      await adjustReservedStock(order, -1);
      await releaseReservation(orderId);
    }

    if (status === 'REJECTED') {
      await adjustReservedStock(order, -1);
      await releaseReservation(orderId);
    }

    if (status === 'CANCELLED') {
      // Release reservation and revert reservedStock without creating stock_out audit entry
      await adjustReservedStock(order, -1);
      await releaseReservation(orderId);
    }

    await orderDb.collection(ORDER_COLLECTION).updateOne(
      { _id: new ObjectId(orderId) },
      { $set: { status, updatedAt: new Date() } }
    );

    const updated = await orderDb.collection(ORDER_COLLECTION).findOne({ _id: new ObjectId(orderId) });
    res.json(updated);
  } catch (error: any) {
    console.error('Status update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Only expire orders that are already approved / ready for pickup.
// PLACED orders must not auto-cancel due to pharmacy inaction; we only flag them in the UI.
const ACTIVE_STATUSES: OrderStatus[] = ['APPROVED', 'READY_FOR_PICKUP'];
async function expireOrdersJob() {
  const now = new Date();
  
  // Find orders that have exceeded their expiry time
  const expiring = await orderDb.collection(ORDER_COLLECTION)
    .find({ status: { $in: ACTIVE_STATUSES }, expiresAt: { $lte: now } })
    .toArray();

  for (const order of expiring) {
    // If order is APPROVED and past expiry, it means customer didn't pick up -> CANCEL
    if (order.status === 'APPROVED') {
      await orderDb.collection(ORDER_COLLECTION).updateOne(
        { _id: order._id },
        { 
          $set: { 
            status: 'CANCELLED', 
            cancellationReason: 'Timed out & cancelled',
            updatedAt: new Date() 
          } 
        }
      );
      // Return reserved quantity to availability and clear redis reservation
      await adjustReservedStock(order, -1);
      await releaseReservation(order._id.toString());
    } else {
      // For PLACED and READY_FOR_PICKUP, mark as EXPIRED
      await orderDb.collection(ORDER_COLLECTION).updateOne(
        { _id: order._id },
        { $set: { status: 'EXPIRED', updatedAt: new Date() } }
      );
      await releaseReservation(order._id.toString());
    }
  }
}

async function bootstrap() {
  await connectDB();
  await connectRedis();

  // Kick off expiry job every 10 seconds - FOR TESTING ONLY (production: 5 * 60 * 1000)
  setInterval(() => {
    expireOrdersJob().catch((err) => console.error('Expire job error:', err));
  }, 10 * 1000);

  app.listen(PORT, () => {
    console.log(`🚀 Order Service running on port ${PORT}`);
  });
}

// Get pharmacy orders that need action (stuck in PLACED for 2+ minutes)
app.get('/orders/pharmacy/:pharmacyId/action-required', verifyToken, async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    const requester = (req as any).userId;
    if (pharmacyId !== requester) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const now = new Date();
    const twoMinutesAgo = new Date(now.getTime() - PHARMACY_ACTION_TIMEOUT_SECONDS * 1000);
    
    const ordersNeedingAction = await orderDb.collection(ORDER_COLLECTION)
      .find({
        pharmacyId,
        status: 'PLACED',
        placedAt: { $lte: twoMinutesAgo }
      })
      .sort({ createdAt: -1 })
      .toArray();
    
    res.json(ordersNeedingAction);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Check expiry immediately for a specific order (called by customer portal)
app.post('/orders/:orderId/check-expiry', verifyToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    if (!ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'Invalid order id' });
    }

    const order = await orderDb.collection(ORDER_COLLECTION).findOne({ _id: new ObjectId(orderId) });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const now = new Date();
    
    // Check if order has expired
    if (order.expiresAt && order.expiresAt <= now && ['APPROVED', 'READY_FOR_PICKUP'].includes(order.status)) {
      // If order is APPROVED and past expiry, cancel it immediately
      if (order.status === 'APPROVED') {
        await orderDb.collection(ORDER_COLLECTION).updateOne(
          { _id: order._id },
          { 
            $set: { 
              status: 'CANCELLED', 
              cancellationReason: 'Timed out & cancelled',
              updatedAt: now
            } 
          }
        );
        // Return reserved quantity to availability and clear redis reservation
        await adjustReservedStock(order, -1);
        await releaseReservation(orderId);
      } else {
        // For READY_FOR_PICKUP, mark as EXPIRED
        await orderDb.collection(ORDER_COLLECTION).updateOne(
          { _id: order._id },
          { $set: { status: 'EXPIRED', updatedAt: now } }
        );
        await releaseReservation(orderId);
      }

      const updated = await orderDb.collection(ORDER_COLLECTION).findOne({ _id: new ObjectId(orderId) });
      return res.json(updated);
    }

    res.json(order);
  } catch (error: any) {
    console.error('Check expiry error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Toggle order favourite status
app.put('/orders/:orderId/favourite', verifyToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { isFavourite } = req.body as { isFavourite?: boolean };
    const customerId = (req as any).userId;

    if (!ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'Invalid order id' });
    }

    const order = await orderDb.collection(ORDER_COLLECTION).findOne({ _id: new ObjectId(orderId) });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Verify customer owns this order
    if (order.customerId !== customerId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (typeof isFavourite !== 'boolean') {
      return res.status(400).json({ error: 'isFavourite must be a boolean' });
    }

    await orderDb.collection(ORDER_COLLECTION).updateOne(
      { _id: new ObjectId(orderId) },
      { $set: { isFavourite, updatedAt: new Date() } }
    );

    const updated = await orderDb.collection(ORDER_COLLECTION).findOne({ _id: new ObjectId(orderId) });
    res.json(updated);
  } catch (error: any) {
    console.error('Toggle favourite error:', error);
    res.status(500).json({ error: error.message });
  }
});

bootstrap().catch((err) => {
  console.error('Failed to start Order Service:', err);
  process.exit(1);
});
