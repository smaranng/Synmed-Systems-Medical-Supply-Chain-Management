// ================== DRIVER DELIVERY ROUTES ==================
// Add to your server.js alongside the existing driver routes.
// These endpoints are called exclusively by the driver mobile app.
//
// Expected MongoDB collection: 'deliveries'
// Document shape:
// {
//   deliveryID:       "DEL-xxx",
//   orderID:          "ORD-xxx",
//   driverID:         "DRV-xxx",
//   distributorID:    "DIST-xxx",
//   customerName:     string,
//   customerPhone:    string,
//   deliveryAddress:  string,
//   items:            [{ name, quantity, unit }],
//   status:           "Assigned" | "Picked Up" | "In Transit" | "Delivered" | "Failed",
//   assignedAt:       Date,
//   estimatedDelivery: Date | null,
//   deliveredAt:      Date | null,
//   notes:            string | null,
// }

const VALID_STATUSES = ['Assigned', 'Picked Up', 'In Transit', 'Delivered', 'Failed'];

// ── GET all deliveries for a driver ─────────────────────────────────────────
app.get('/driver/:driverID/deliveries', verifyToken, async (req, res) => {
  try {
    const { driverID } = req.params;

    // Driver can only see their own deliveries; distributor can see any
    if (req.role === 'driver' && req.userId !== driverID) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const deliveries = await db
      .collection('deliveries')
      .find({ driverID }, { projection: { _id: 0 } })
      .sort({ assignedAt: -1 })
      .toArray();

    res.json({ deliveries, total: deliveries.length });
  } catch (err) {
    console.error('Get deliveries error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET a single delivery detail ─────────────────────────────────────────────
app.get('/driver/:driverID/deliveries/:deliveryID', verifyToken, async (req, res) => {
  try {
    const { driverID, deliveryID } = req.params;

    if (req.role === 'driver' && req.userId !== driverID) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const delivery = await db
      .collection('deliveries')
      .findOne({ deliveryID, driverID }, { projection: { _id: 0 } });

    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

    res.json(delivery);
  } catch (err) {
    console.error('Get delivery detail error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH delivery status (driver updates progress) ──────────────────────────
app.patch('/driver/:driverID/deliveries/:deliveryID/status', verifyToken, async (req, res) => {
  try {
    const { driverID, deliveryID } = req.params;
    const { status } = req.body;

    // Only the assigned driver (or distributor) can update
    if (req.role === 'driver' && req.userId !== driverID) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `status must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }

    const collection = db.collection('deliveries');

    const delivery = await collection.findOne({ deliveryID, driverID });
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

    // Guard against backwards status moves
    const ORDER = VALID_STATUSES;
    const currentIdx = ORDER.indexOf(delivery.status);
    const newIdx     = ORDER.indexOf(status);

    // Allow 'Failed' from any non-terminal status, otherwise must move forward
    const isTerminal = delivery.status === 'Delivered' || delivery.status === 'Failed';
    if (isTerminal) {
      return res.status(409).json({ error: 'Cannot update a completed delivery' });
    }
    if (status !== 'Failed' && newIdx <= currentIdx) {
      return res.status(409).json({
        error: `Cannot move status from "${delivery.status}" to "${status}"`,
      });
    }

    const now = new Date();
    const update: Record<string, any> = {
      status,
      updatedAt: now,
    };

    if (status === 'Delivered') update.deliveredAt = now;
    if (status === 'Picked Up') update.pickedUpAt  = now;

    const result = await collection.findOneAndUpdate(
      { deliveryID, driverID },
      { $set: update },
      { returnDocument: 'after', projection: { _id: 0 } }
    );

    res.json({ delivery: result });
  } catch (err) {
    console.error('Update delivery status error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── (Distributor) Create / assign a delivery to a driver ─────────────────────
// Called from the distributor web app when creating an order assignment
app.post('/driver/:driverID/deliveries', verifyToken, async (req, res) => {
  try {
    if (req.role !== 'distributor') {
      return res.status(403).json({ error: 'Only distributors can create deliveries' });
    }

    const { driverID } = req.params;
    const {
      orderID, customerName, customerPhone, deliveryAddress,
      items, estimatedDelivery, notes,
    } = req.body;

    if (!orderID || !customerName || !deliveryAddress) {
      return res.status(400).json({
        error: 'orderID, customerName, and deliveryAddress are required',
      });
    }

    // Verify driver belongs to this distributor
    const driver = await db.collection('driver_users').findOne({ driverID });
    if (!driver) return res.status(404).json({ error: 'Driver not found' });
    if (driver.distributorID !== req.userId) {
      return res.status(403).json({ error: 'Driver does not belong to your account' });
    }

    const deliveryID = `DEL-${new ObjectId().toHexString()}`;

    const delivery = {
      deliveryID,
      orderID,
      driverID,
      distributorID:    req.userId,
      customerName,
      customerPhone:    customerPhone    || '',
      deliveryAddress,
      items:            Array.isArray(items) ? items : [],
      status:           'Assigned',
      assignedAt:       new Date(),
      estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery) : null,
      deliveredAt:      null,
      pickedUpAt:       null,
      notes:            notes || null,
      createdAt:        new Date(),
      updatedAt:        new Date(),
    };

    await db.collection('deliveries').insertOne(delivery);

    const { _id, ...safeDelivery } = delivery as any;
    res.status(201).json(safeDelivery);
  } catch (err) {
    console.error('Create delivery error:', err);
    res.status(500).json({ error: err.message });
  }
});
