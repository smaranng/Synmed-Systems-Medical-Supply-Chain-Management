const userConnection = require('../db/userDb');
const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
  driverID:       { type: String },
  distributorID:  { type: String },
  name:           { type: String, required: true },
  username:       { type: String, required: true, unique: true, lowercase: true },
  password:       { type: String, required: true },   // field is "password" not "passwordHash"
  phone:          { type: String },
  licenseNumber:  { type: String },
  licenseExpiry:  { type: String },
  dlCertificate:  { type: String },
  vehicleID:      { type: String },
  role:           { type: String, default: 'driver' },
  isActive:       { type: Boolean, default: true },
  availabilityStatus:       { type: String},
}, { timestamps: true, collection: 'driver_users' }); // exact collection name

module.exports = userConnection.model('Driver', driverSchema);