const userConnection = require('../db/userDb');
const mongoose = require('mongoose');

const pharmaSchema = new mongoose.Schema({
  pharmaID:  { type: String, required: true, unique: true },
  name:           { type: String, required: true },
  email:          { type: String, required: true, unique: true, lowercase: true },
  phone:          { type: String },
  address:       { type: String },
  location: {
    lat: { type: Number },
    lng: { type: Number },
  },

}, { timestamps: true, collection: 'pharmacy_users' }); // exact collection name

module.exports = userConnection.model('Pharmacy', pharmaSchema);