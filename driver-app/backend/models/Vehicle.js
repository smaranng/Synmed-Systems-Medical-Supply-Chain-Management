const userConnection = require('../db/userDb');
const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
  vehicleID:          { type: String },
  registrationNumber: { type: String },
  vehicleType:        { type: String },
  capacity:           { type: Number },
  fuelType:           { type: String },
  ownership:          { type: String },
  distributorID:      { type: String },
  driverID:           { type: String },
  insuranceExpiry:    { type: String },
  permitExpiry:       { type: String },
  status:             { type: String, default: 'Active' },
}, { timestamps: true }); // exact collection name

module.exports = userConnection.model('Vehicle', vehicleSchema, 'distributor_vehicles');