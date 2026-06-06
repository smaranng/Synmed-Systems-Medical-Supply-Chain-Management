import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createClient } from 'redis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4002;

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const redisClient = createClient({ url: REDIS_URL });
redisClient.on('error', (err) => console.error('Redis error:', err));

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// ================== STORAGE ==================
const uploadsDir = path.join(__dirname, '..', 'uploads', 'prescriptions');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'prescription-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    return mime && ext ? cb(null, true) : cb(new Error('Only image files allowed'));
  }
});

// ================== MIDDLEWARE ==================
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
}));
app.use(express.json());

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.role = decoded.role;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// ================== DATABASE ==================
let db, userDb, orderDb;

const ACTIVE_STATUSES = ['PLACED', 'APPROVED', 'READY_FOR_PICKUP'];

async function connectRedis() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
    console.log('✅ Redis connected');
  }
}

async function connectDB() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
  await client.connect();

  db = client.db('inventory_pharma');
  userDb = client.db('user_db');
  orderDb = client.db('order_db');

  await connectRedis();
  console.log('✅ MongoDB connected');
}

// ================== RESERVED STOCK ==================
async function getReservedQuantity(itemId) {
  let total = 0;
  if (!itemId) return total;

  for await (const key of redisClient.scanIterator({ MATCH: `stock_reservation:*:${itemId}` })) {
    const raw = await redisClient.get(key);
    if (!raw) continue;

    try {
      const ttl = await redisClient.ttl(key);
      if (ttl <= 0) continue;

      const parts = key.split(':');
      const orderId = parts[1];
      let isActive = true;

      if (orderId && ObjectId.isValid(orderId)) {
        const order = await orderDb
          .collection('customer_to_pharma_orders')
          .findOne({ _id: new ObjectId(orderId) }, { projection: { status: 1 } });

        isActive = !!(order && ACTIVE_STATUSES.includes(order.status));
      }

      if (!isActive) continue;

      const parsed = JSON.parse(raw);
      total += Number(parsed.quantity) || 0;
    } catch {}
  }
  return total;
}

async function withAvailability(items) {
  return Promise.all((items || []).map(async item => {
    const itemId = item._id?.toString();
    const reservedStock = itemId ? await getReservedQuantity(itemId) : 0;
    const availableStock = Math.max((item.stock || 0) - reservedStock, 0);

    return { ...item, reservedStock, availableStock };
  }));
}

// ================== HEALTH ==================
app.get('/health', (req, res) => {
  res.json({ service: 'inventory-service', status: 'ok' });
});

// ================== INVENTORY ==================

// 📊 Stats
app.get('/inventory/pharmacy/:pharmacyId/stats', verifyToken, async (req, res) => {
  try {
    const { pharmacyId } = req.params;

    const inventory = await db.collection('inv').find({ pharmacyId }).toArray();
    const inv = await withAvailability(inventory);

    const totalItems = inv.length;
    const lowStock = inv.filter(i => i.availableStock <= (i.lowStockThreshold || 0)).length;
    const expiringSoon = inv.filter(i => i.expiryDate && new Date(i.expiryDate) < new Date(Date.now() + 90 * 86400000)).length;
    const totalValue = inv.reduce((s, i) => s + i.availableStock * i.price, 0);

    res.json({ totalItems, lowStock, expiringSoon, totalValue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 📋 Get Pharmacy Inventory
app.get('/inventory/pharmacy/:pharmacyId', verifyToken, async (req, res) => {
  const { pharmacyId } = req.params;

  const data = await db.collection('inv').find({ pharmacyId }).sort({ name: 1 }).toArray();
  const response = await withAvailability(data);

  res.json(response);
});

// ➕ Add Inventory Item
app.post('/inventory/pharmacy/:pharmacyId', verifyToken, async (req, res) => {
  const { pharmacyId } = req.params;
  if (req.userId !== pharmacyId) return res.status(403).json({ error: 'Unauthorized' });

  const {
    itemType,
    name,
    category,
    stock,
    price,
    expiryDate,
    manufacturingDate,
    lowStockThreshold,
    ...extra
  } = req.body;

  if (!itemType || !name || stock == null || price == null) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const now = new Date();
  const initialStock = Number(stock);

  const doc = {
    pharmacyId,
    itemType,
    name,
    category,

    ...extra,

    stock: initialStock,
    price: Number(price),
    lowStockThreshold: Number(lowStockThreshold) || 20,

    expiryDate: expiryDate ? new Date(expiryDate) : null,
    manufacturingDate: manufacturingDate ? new Date(manufacturingDate) : null,

    availabilityStatus: initialStock > 0 ? 'AVAILABLE' : 'OUT_OF_STOCK',

    stockDetails: [{
      stockUpdated: initialStock,
      date: now,
      status: 'stock_in',
      balance: initialStock
    }],

    createdAt: now,
    lastUpdated: now,
    updatedAt: now
  };

  const result = await db.collection('inv').insertOne(doc);
  res.status(201).json({ id: result.insertedId, ...doc });
});

// ✏️ Update Item
app.put('/inventory/:itemId', verifyToken, async (req, res) => {
  try {
    const { itemId } = req.params;
    if (!ObjectId.isValid(itemId)) return res.status(400).json({ error: 'Invalid item ID' });

    const item = await db.collection('inv').findOne({ _id: new ObjectId(itemId) });
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (item.pharmacyId !== req.userId) return res.status(403).json({ error: 'Unauthorized' });

    const updateData = {};
    for (const key in req.body) {
      if (!['_id', 'pharmacyId'].includes(key)) updateData[key] = req.body[key];
    }

    if (updateData.stock != null) updateData.stock = Number(updateData.stock);
    if (updateData.price != null) updateData.price = Number(updateData.price);
    if (updateData.lowStockThreshold != null) updateData.lowStockThreshold = Number(updateData.lowStockThreshold);
    if (updateData.expiryDate) updateData.expiryDate = new Date(updateData.expiryDate);
    if (updateData.manufacturingDate) updateData.manufacturingDate = new Date(updateData.manufacturingDate);

    updateData.updatedAt = new Date();

    await db.collection('inv').updateOne({ _id: new ObjectId(itemId) }, { $set: updateData });

    const updated = await db.collection('inv').findOne({ _id: new ObjectId(itemId) });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🗑️ Delete Item
app.delete('/inventory/:itemId', verifyToken, async (req, res) => {
  const { itemId } = req.params;

  const item = await db.collection('inv').findOne({ _id: new ObjectId(itemId) });
  if (!item) return res.status(404).json({ error: 'Item not found' });
  if (item.pharmacyId !== req.userId) return res.status(403).json({ error: 'Unauthorized' });

  await db.collection('inv').deleteOne({ _id: new ObjectId(itemId) });
  res.json({ success: true });
});

// ================== CUSTOMER SEARCH ==================
app.get('/items/search', async (req, res) => {
  try {
    const { keyword, category, itemType } = req.query;

    let query = { stock: { $gt: 0 } };

    if (itemType) query.itemType = itemType;
    if (category && category !== 'ALL') query.category = category;

    if (keyword) {
      query.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { mainComposition: { $regex: keyword, $options: 'i' } },
        { equipmentType: { $regex: keyword, $options: 'i' } },
        { consumableType: { $regex: keyword, $options: 'i' } }
      ];
    }

    const items = await db.collection('inv').find(query).limit(50).toArray();
    const itemsWithAvailability = await withAvailability(items);

    const enriched = await Promise.all(itemsWithAvailability.map(async item => {
      const pharmacy = await userDb.collection('pharmacy_users_db')
        .findOne({ _id: new ObjectId(item.pharmacyId) }, { projection: { name: 1, address: 1, phone: 1, logo: 1 } });

      return {
        ...item,
        id: item._id.toString(),
        pharmacy
      };
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================== SINGLE ITEM DETAILS ==================
app.get('/items/:id', async (req, res) => {
  try {
    const item = await db.collection('inv').findOne({ _id: new ObjectId(req.params.id) });
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const pharmacy = await userDb.collection('pharmacy_users_db')
      .findOne({ _id: new ObjectId(item.pharmacyId) });

    const reservedStock = await getReservedQuantity(item._id.toString());
    const availableStock = Math.max((item.stock || 0) - reservedStock, 0);

    res.json({
      ...item,
      reservedStock,
      availableStock,
      pharmacy
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================== CART ==================
// (Your existing cart code stays unchanged — still valid)

// ================== PRESCRIPTION UPLOAD ==================
app.post("/cart/upload-prescription", verifyToken, upload.single('prescription'), async (req, res) => {
  try {
    const customerId = req.userId;
    const { itemId } = req.body;

    if (!itemId || !req.file) return res.status(400).json({ error: 'Missing file or itemId' });

    const prescriptionPath = `/uploads/prescriptions/${req.file.filename}`;

    const result = await db.collection("carts").updateOne(
      { customerId, "items.itemId": itemId },
      { $set: { "items.$.prescriptionPath": prescriptionPath, updatedAt: new Date() } }
    );

    if (!result.matchedCount) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Item not found in cart' });
    }

    res.json({ success: true, prescriptionPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================== STATIC ==================
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ================== START ==================
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Inventory Service running on port ${PORT}`);
  });
});
