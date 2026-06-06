const orderConnection = require('../db/orderDb');
const mongoose = require('mongoose');

const taxBreakdownSchema = new mongoose.Schema({
  gross:       { type: Number },
  discount:    { type: Number },
  taxable:     { type: Number },
  gst:         { type: Number },
  cgst:        { type: Number },
  sgst:        { type: Number },
}, { _id: false });

const orderItemSchema = new mongoose.Schema({
  productID_Phm:   { type: String },
  productID_Dtb:   { type: String },
  name:            { type: String, required: true },
  quantity:        { type: Number, required: true },
  price:           { type: Number },
  discountPercent: { type: Number },
  gstRate:         { type: Number },
  hsnCode:         { type: String },
  mrpPerPack:      { type: Number },
}, { _id: false });

const pharmaOrderSchema = new mongoose.Schema({
  orderNumber:    { type: String, required: true, unique: true },
  pharmaID:       { type: String, required: true },
  distributorID:  { type: String, required: true },

  items:          [orderItemSchema],

  taxBreakdown: {
    gross:       { type: Number },
    discount:    { type: Number },
    taxable:     { type: Number },
    gst:         { type: Number },
    cgst:        { type: Number },
    sgst:        { type: Number },
  },

  totalAmount:    { type: Number },
  grandTotal:     { type: Number },

  status: {
    type: String,
    default: 'PENDING',
    enum: ['PENDING', 'ACCEPTED', 'DISPATCHED', 'DELIVERED', 'CANCELLED', 'EXPIRED'],
  },

  paymentMode: {
    type: String,
    enum: ['PAY_ON_DELIVERY', 'PREPAID', 'CREDIT'],
  },
  paymentStatus: {
    type: String,
    default: 'PENDING',
    enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'],
  },

  placedAt:     { type: Date },
  acceptedAt:   { type: Date },
  dispatchedAt: { type: Date },
  expiresAt:    { type: Date },
  eta:          { type: Date },

  deliveryId:   { type: String },
  driverID:     { type: String },
  vehicleID:    { type: String },

}, { timestamps: true, collection: 'pharma_to_distributor_orders' });

module.exports = orderConnection.model('PharmaOrder', pharmaOrderSchema);