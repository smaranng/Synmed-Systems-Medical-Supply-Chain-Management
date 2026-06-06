require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Just require → triggers connection
require('./db/orderDb');
require('./db/userDb');

const authRoutes = require('./routes/auth');
const driverRoutes = require('./routes/driver');

const app = express();
const PORT = process.env.PORT || 5203;

// Middleware
app.use(cors());
app.use(express.json());

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/auth', authRoutes);
app.use('/driver', driverRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Synmed Driver API running on port ${PORT}`);
});