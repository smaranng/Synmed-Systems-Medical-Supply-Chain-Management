const mongoose = require('mongoose');
require('dotenv').config();

// Deliveries (and pharma orders) live in order_db, not user_db.
// The MONGO_URI in .env already contains the cluster URL; we just
// swap the database name here so the driver backend reads the right DB.
const uri = process.env.MONGO_URI.replace(/\/[^/?]+(\?|$)/, '/order_db$1');

let orderConnection;

if (!orderConnection) {
  orderConnection = mongoose.createConnection(uri);

  orderConnection.on('connected', () => {
    console.log('✅ MongoDB Atlas (ORDER DB) connected');
  });

  orderConnection.on('error', (err) => {
    console.error('❌ MongoDB ORDER DB error:', err.message);
  });
}

module.exports = orderConnection;