const userConnection = require('../db/userDb');
const mongoose = require('mongoose');

const distributorSchema = new mongoose.Schema({
  distributorID:  { type: String, required: true, unique: true },
  name:           { type: String, required: true },
  email:          { type: String, required: true, unique: true, lowercase: true },
  companyName:    { type: String },
  address:        { type: mongoose.Schema.Types.Mixed },
  phone:          { type: String },
}, { timestamps: true, collection: 'distributor_users' });

module.exports = userConnection.model('Distributor', distributorSchema);