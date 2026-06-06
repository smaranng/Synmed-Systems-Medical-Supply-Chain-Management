const express     = require('express');
const bcrypt      = require('bcryptjs');
const Driver      = require('../models/Driver');
const Vehicle     = require('../models/Vehicle');
const Delivery    = require('../models/Delivery');
const Distributor = require('../models/Distributor');
const Pharmacy = require('../models/Pharmacy');
const PharmaOrder = require('../models/PharmaOrder');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

// ─── GET /driver/:driverID — Get driver profile with vehicle ─────────────────

router.get('/:driverID', requireAuth, async (req, res) => {
  const { driverID } = req.params; // ← BUG FIX: was missing — caused ReferenceError

  if (req.driver.userId !== driverID)
    return res.status(403).json({ error: 'Forbidden' });

  try {
    const driver = await Driver.findOne({ driverID }).select('-password');
    if (!driver) return res.status(404).json({ error: 'Driver not found' });

    let vehicle = null;
    if (driver.vehicleID) {
      vehicle = await Vehicle.findOne({ vehicleID: driver.vehicleID, ownership: 'Driver' });
    }

    let distributor = null;
    if (driver.distributorID) {
      distributor = await Distributor.findOne({ distributorID: driver.distributorID })
        .select('name companyName');
    }

    return res.json({
      ...driver.toObject(),
      vehicle,
      distributorName: distributor?.name ?? driver.distributorID,
      companyName:     distributor?.companyName ?? null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PUT /driver/:driverID/password ──────────────────────────────────────────

router.put('/:driverID/password', requireAuth, async (req, res) => {
  const { driverID } = req.params;
  const { currentPassword, newPassword } = req.body;

  if (req.driver.userId !== driverID)
    return res.status(403).json({ error: 'Forbidden' });

  if (!currentPassword || !newPassword)
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });

  if (newPassword.length < 6)
    return res.status(400).json({ error: 'New password must be at least 6 characters' });

  try {
    const driver = await Driver.findOne({ driverID });
    if (!driver) return res.status(404).json({ error: 'Driver not found' });

    const valid = await bcrypt.compare(currentPassword, driver.password);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    driver.password = await bcrypt.hash(newPassword, 12);
    await driver.save();

    return res.json({ message: 'Password updated successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /:driverID/deliveries ───────────────────────────────────────────────

router.get('/:driverID/deliveries', requireAuth, async (req, res) => {
  const { driverID } = req.params;

  if (req.driver.userId !== driverID)
    return res.status(403).json({ error: 'Forbidden' });

  try {
    const { status } = req.query;
    const filter = { driverID };
    if (status) filter.status = status;

    const deliveries = await Delivery.find(filter).sort({ createdAt: -1 });

    const orderNumbers = [...new Set(deliveries.map(d => d.orderNumber).filter(Boolean))];
    const pharmaIDs = [...new Set(deliveries.map(d => d.pharmaID).filter(Boolean))];
    const distributorIDs = [...new Set(deliveries.map(d => d.distributorID).filter(Boolean))];

    const [pharmaOrders, pharmacies, distributors] = await Promise.all([
      PharmaOrder.find({ orderNumber: { $in: orderNumbers } }),
      Pharmacy.find({ pharmaID: { $in: pharmaIDs } }),
      Distributor.find({ distributorID: { $in: distributorIDs } }),
    ]);

    const orderMap = {};
    pharmaOrders.forEach(o => { orderMap[o.orderNumber] = o.toObject(); });

    const pharmaMap = {};
    pharmacies.forEach(p => { pharmaMap[p.pharmaID] = p.toObject(); });

    const distributorMap = {};
    distributors.forEach(d => { distributorMap[d.distributorID] = d.toObject(); });

    const enriched = deliveries.map(d => {
      const order = orderMap[d.orderNumber] ?? null;
      const pharma = pharmaMap[d.pharmaID] ?? null;
      const distributor = distributorMap[d.distributorID] ?? null;

      return {
        ...d.toObject(),
        orderDetails: order,
        pharmaName: pharma?.name ?? null,
        pharmaAddress: pharma?.address ?? null,
        companyName: distributor?.companyName ?? null,
        distributorAddress: distributor?.address ?? null,
        pharmaLat:           pharma?.location.lat             ?? null,  // ← add
        pharmaLng:           pharma?.location.lng              ?? null,  // ← add  
      };
    });

    return res.json({ deliveries: enriched });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /:driverID/deliveries/:orderNumber ──────────────────────────────────

// ─── GET /:driverID/deliveries/:orderNumber ──────────────────────────────────

router.get('/:driverID/deliveries/:orderNumber', requireAuth, async (req, res) => {
  const { driverID, orderNumber } = req.params;
  if (req.driver.userId !== driverID)
    return res.status(403).json({ error: 'Forbidden' });

  try {
    const delivery = await Delivery.findOne({ orderNumber, driverID });
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

    const [orderDetails, pharma, distributor] = await Promise.all([
      delivery.orderNumber
        ? PharmaOrder.findOne({ orderNumber: delivery.orderNumber })
        : null,
      delivery.pharmaID
        ? Pharmacy.findOne({ pharmaID: delivery.pharmaID })
        : null,
      delivery.distributorID
        ? Distributor.findOne({ distributorID: delivery.distributorID })
        : null,
    ]);

    return res.json({
      ...delivery.toObject(),
      orderDetails: orderDetails?.toObject() ?? null,
      pharmaName:          pharma?.name          ?? null,
      pharmaAddress:       pharma?.address        ?? null,
      companyName:         distributor?.companyName  ?? null,
      distributorAddress:  distributor?.address      ?? null,
      pharmaLat:           pharma?.location.lat             ?? null,  // ← add
      pharmaLng:           pharma?.location.lng              ?? null,  // ← add
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PATCH /:driverID/deliveries/:orderNumber/status ────────────────────────


const VALID_STATUSES = ['DISPATCHED', 'PICKED_UP', 'DELIVERED', 'FAILED', 'CANCELLED'];

const DELIVERY_TO_ORDER_STATUS = {
  'DISPATCHED': 'DISPATCHED',
  'PICKED_UP':  'PICKED_UP',
  'DELIVERED':  'DELIVERED',
  'FAILED':     'FAILED',
  'CANCELLED':  'CANCELLED',
};

router.patch('/:driverID/deliveries/:orderNumber/status', requireAuth, async (req, res) => {
  const { driverID, orderNumber } = req.params;
  const { status, otp } = req.body;

  if (req.driver.userId !== driverID) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`
    });
  }

  try {
    const delivery = await Delivery.findOne({ orderNumber, driverID });
    if (!delivery) {
      return res.status(404).json({ error: 'Delivery not found' });
    }

    let updatedDelivery;
    const now = new Date();

    // ─────────────────────────────────────────────
    // 🔥 PICKED_UP → COMPLETE DELIVERY (WITH OTP)
    // ─────────────────────────────────────────────
    if (status === 'DELIVERED' && delivery.status === 'PICKED_UP') {

      // OTP validation
      if (!delivery.otp) {
        return res.status(400).json({ error: 'No OTP set for this delivery.' });
      }

      if (!otp) {
        return res.status(400).json({ error: 'OTP is required to complete delivery.' });
      }

      if (String(delivery.otp).trim() !== String(otp).trim()) {
        return res.status(400).json({ error: 'Invalid OTP.' });
      }

      // ✅ Mark as DELIVERED
      updatedDelivery = await Delivery.findOneAndUpdate(
        { orderNumber, driverID },
        {
          $set: {
            status: 'DELIVERED',
            deliveredAt: now,
            updatedAt: now
          },
          $unset: { otp: '' }
        },
        { new: true }
      );

      if (!updatedDelivery) {
        return res.status(500).json({ error: 'Failed to update delivery' });
      }

      // ✅ Sync order
      await PharmaOrder.findOneAndUpdate(
        { orderNumber },
        {
          $set: {
            status: 'DELIVERED',
            deliveredAt: now,
            updatedAt: now
          },
          $unset: { otp: '' }
        }
      );

      // ✅ Release driver + vehicle
      await Promise.all([
        Driver.findOneAndUpdate(
          { driverID },
          {
            $set: { availabilityStatus: 'available' },
            $inc: { deliveriesCompleted: 1, currentDeliveriesPerDay: 1 },
            $unset: { currentOrderId: '' }
          }
        ),
        Vehicle.findOneAndUpdate(
          { driverID, currentOrderId: orderNumber },
          {
            $set: { availabilityStatus: 'available', alloted: false },
            $unset: { currentDriverID: '', currentOrderId: '' }
          }
        )
      ]);

    }

    // ─────────────────────────────────────────────
    // 🔹 OTHER STATUS UPDATES (NO OTP)
    // ─────────────────────────────────────────────
    else {
      updatedDelivery = await Delivery.findOneAndUpdate(
        { orderNumber, driverID },
        {
          $set: {
            status,
            updatedAt: now
          }
        },
        { new: true }
      );

      if (!updatedDelivery) {
        return res.status(500).json({ error: 'Failed to update delivery' });
      }

      const orderStatus = DELIVERY_TO_ORDER_STATUS[status];
      if (orderStatus) {
        await PharmaOrder.findOneAndUpdate(
          { orderNumber },
          {
            $set: {
              status: orderStatus,
              updatedAt: now
            }
          }
        );
      }
    }

    // ─────────────────────────────────────────────
    // 🔹 ENRICH RESPONSE (SAFE NOW)
    // ─────────────────────────────────────────────
    const [pharma, distributor] = await Promise.all([
      updatedDelivery.pharmaID
        ? Pharmacy.findOne({ pharmaID: updatedDelivery.pharmaID })
        : null,
      updatedDelivery.distributorID
        ? Distributor.findOne({ distributorID: updatedDelivery.distributorID })
        : null,
    ]);

    return res.json({
      delivery: {
        ...updatedDelivery.toObject(),
        pharmaName:         pharma?.name ?? null,
        pharmaAddress:      pharma?.address ?? null,
        companyName:        distributor?.companyName ?? null,
        distributorAddress: distributor?.address ?? null,
        pharmaLat:          pharma?.location?.lat ?? null,
        pharmaLng:          pharma?.location?.lng ?? null,
      }
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;