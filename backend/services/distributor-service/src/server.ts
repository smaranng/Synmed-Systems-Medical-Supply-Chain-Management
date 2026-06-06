import express from 'express';
import { MongoClient } from 'mongodb';

const app = express();
const PORT = process.env.PORT || 4004;

app.use(express.json());

let db: any;

async function connectDB() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
  await client.connect();
  db = client.db('distributor_db');
  console.log('✅ distributor Service: MongoDB connected');
}

app.get('/health', (req, res) => {
  res.json({ service: 'distributor-service', status: 'ok' });
});

// Get distributor catalog
app.get('/distributors/:distributorId/catalog', async (req, res) => {
  try {
    const catalog = await db.collection('distributor_catalog')
      .find({ distributorId: req.params.distributorId })
      .toArray();
    res.json(catalog);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Process invoice
app.post('/distributors/:distributorId/invoices', async (req, res) => {
  try {
    const invoice = {
      ...req.body,
      distributorId: req.params.distributorId,
      processingStatus: 'PENDING',
      createdAt: new Date(),
    };
    const result = await db.collection('invoice_processing_logs').insertOne(invoice);
    res.status(201).json({ id: result.insertedId, ...invoice });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 distributor Service running on port ${PORT}`);
  });
});
