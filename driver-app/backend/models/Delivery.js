const orderConnection = require('../db/orderDb');
const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
}, { _id: false });

const deliverySchema = new mongoose.Schema({
  orderId:                  { type: String, required: true },
  orderNumber:              { type: String, required: true, unique: true },
  distributorID:            { type: String, required: true },
  pharmaID:                 { type: String, required: true },
  driverID:                 { type: String, required: true },
  driverName:               { type: String, required: true },
  driverPhone:              { type: String, required: true },
  driverRatingAtDispatch:   { type: Number },
  vehicleID:                { type: String, required: true },
  vehicleNumber:            { type: String, required: true },
  vehicleType:              { type: String, required: true },
  distanceKm:               { type: Number },
  allocationScore:          { type: Number },
  distributorLocation:      { type: locationSchema, required: true },
  driverLocationAtDispatch: { type: locationSchema, required: true },
  otp:                     { type: String },
  status: {
    type: String,
    default: 'DISPATCHED',
    enum: ['DISPATCHED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'CANCELLED'],
  },
}, { timestamps: true, collection: 'deliveries' });

module.exports = orderConnection.model('Delivery', deliverySchema);