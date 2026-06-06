const mongoose = require('mongoose');
require('dotenv').config();

let userConnection;

if (!userConnection) {
  userConnection = mongoose.createConnection(
    `${process.env.MONGO_URI}`
  );

  userConnection.on('connected', () => {
    console.log('✅ MongoDB Atlas (USER DB) connected');
  });

  userConnection.on('error', (err) => {
    console.error('❌ MongoDB ORDER DB error:', err.message);
  });
}

module.exports = userConnection;