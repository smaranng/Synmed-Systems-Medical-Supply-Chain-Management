require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Driver = require('../models/Driver');
const Delivery = require('../models/Delivery');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB Atlas');

  // Clear existing data
  await Driver.deleteMany({});
  await Delivery.deleteMany({});

  // Create sample driver
  const passwordHash = await bcrypt.hash('password123', 10);

  await Driver.create({
    driverID:      'DRV001',
    distributorID: 'DIST001',
    name:          'John Driver',
    username:      'john',
    passwordHash,
    phone:         '+91 9876543210',
    licenseNumber: 'MH1234567',
    licenseExpiry: '2027-12-31',
    vehicleID:     'VEH001',
    vehicleNumber: 'MH 01 AB 1234',
    vehicleType:   'Van',
    isActive:      true,
    role:          'driver',
  });

  // Create sample deliveries
  await Delivery.insertMany([
    {
      deliveryID:        'DEL001',
      orderID:           'ORD001',
      driverID:          'DRV001',
      customerName:      'City Hospital',
      customerPhone:     '+91 9000000001',
      deliveryAddress:   '123 Main St, Mumbai',
      status:            'Assigned',
      estimatedDelivery: '2026-03-06',
      items: [
        { name: 'Paracetamol 500mg', quantity: 100, unit: 'tablets' },
        { name: 'Syringes 5ml',      quantity: 50,  unit: 'pcs' },
      ],
    },
    {
      deliveryID:        'DEL002',
      orderID:           'ORD002',
      driverID:          'DRV001',
      customerName:      'Apollo Pharmacy',
      customerPhone:     '+91 9000000002',
      deliveryAddress:   '456 Park Ave, Mumbai',
      status:            'In Transit',
      estimatedDelivery: '2026-03-05',
      items: [
        { name: 'Amoxicillin 250mg', quantity: 200, unit: 'capsules' },
      ],
    },
  ]);

  console.log('✅ Seed complete!');
  console.log('   Username: john');
  console.log('   Password: password123');
  await mongoose.disconnect();
}

seed().catch(console.error);