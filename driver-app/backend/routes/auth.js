const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const Driver  = require('../models/Driver');
const Vehicle = require('../models/Vehicle');
const Distributor = require('../models/Distributor');
const router = express.Router();

// ─── POST /auth/driver/login ──────────────────────────────────────────────────

router.post('/driver/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    // Find driver in driver_users collection
    const driver = await Driver.findOne({
      username: username.trim().toLowerCase(),
      isActive: true,
    });

    if (!driver) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Password field in your DB is "password" (not "passwordHash")
    const valid = await bcrypt.compare(password, driver.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Fetch vehicle details from distributor_vehicles collection
    let vehicle = null;
    if (driver.vehicleID) {
      vehicle = await Vehicle.findOne({ vehicleID: driver.vehicleID });
    }

    let distributor = null;
if (driver.distributorID) {
  distributor = await Distributor.findOne({ distributorID: driver.distributorID })
    .select('name companyName');
}
    // Issue JWT
    const token = jwt.sign(
      {
        userId:       driver.driverID,
        username:     driver.username,
        role:         driver.role,
        distributorID: driver.distributorID,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Return token + full driver profile (no password)
    const user = {
      driverID:       driver.driverID,
      distributorID:  driver.distributorID,
      distributorName:  distributor?.name ?? driver.distributorID,
      companyName:      distributor?.companyName ?? '',
      name:           driver.name,
      username:       driver.username,
      phone:          driver.phone,
      licenseNumber:  driver.licenseNumber,
      licenseExpiry:  driver.licenseExpiry,
      dlCertificate:  driver.dlCertificate,
      vehicleID:      driver.vehicleID,
      role:           driver.role,
      isActive:       driver.isActive,
      vehicle: vehicle ? {
        vehicleID:          vehicle.vehicleID,
        registrationNumber: vehicle.registrationNumber,
        vehicleType:        vehicle.vehicleType,
        capacity:           vehicle.capacity,
        fuelType:           vehicle.fuelType,
        ownership:          vehicle.ownership,
        insuranceExpiry:    vehicle.insuranceExpiry,
        permitExpiry:       vehicle.permitExpiry,
        status:             vehicle.status,
      } : null,
    };

    return res.json({ token, user });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;